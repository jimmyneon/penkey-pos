#!/usr/bin/env python3
"""
Penkey POS Print Server
Primary: Supabase Realtime (postgres_changes) for instant job delivery
Fallback: Periodic poll to catch any jobs missed during reconnect/downtime
"""

import os
import sys
import asyncio
import signal
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

from supabase import create_client, AsyncClient
from printer import EpsonSerialPrinter
from supabase_logger import SupabaseLogHandler

# Load environment variables
load_dotenv()

# Configure logging - will add Supabase handler after client is created
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/home/jimmy/print-server/print.log')
    ]
)
logger = logging.getLogger(__name__)


class PrintServer:
    """
    Print server with dual-mode job detection:
      1. Supabase Realtime channel  — fires immediately when a new pending job is
         inserted for this printer (primary, near-zero latency)
      2. Fallback poll              — runs every POLL_INTERVAL seconds to catch
         any jobs that arrived while the realtime socket was reconnecting
    """

    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        self.printer_id = os.getenv('PRINTER_ID')
        self.poll_interval = int(os.getenv('POLL_INTERVAL', '5'))  # fallback only

        # Serial printer settings
        self.printer_device = os.getenv('PRINTER_DEVICE', '/dev/ttyUSB0')
        self.printer_baud = int(os.getenv('PRINTER_BAUD', '38400'))

        self.supabase: Optional[AsyncClient] = None
        self.printer: Optional[EpsonSerialPrinter] = None
        self.running = False
        self._shutdown_event = asyncio.Event()

        # Track jobs currently being processed to avoid double-dispatch
        self._processing: set = set()
        self._job_lock = asyncio.Lock()
        
        # Supabase log handler
        self.supabase_log_handler: Optional[SupabaseLogHandler] = None
        self._log_flush_task: Optional[asyncio.Task] = None

        # Realtime reconnection tracking
        self._realtime_healthy = False
        self._realtime_channel = None
        self._cmd_channel = None
        self._reconnect_attempts = 0

        if not all([self.supabase_url, self.supabase_key, self.printer_id]):
            raise ValueError(
                "Missing required environment variables. "
                "Check SUPABASE_URL, SUPABASE_KEY, and PRINTER_ID"
            )

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    async def connect(self) -> None:
        """Connect to Supabase and initialise printer"""
        # Disable schema caching to avoid cache mismatch errors
        self.supabase = AsyncClient(
            self.supabase_url, 
            self.supabase_key
        )
        
        logger.info("Connected to Supabase - auto-update test")
        
        # Set up Supabase log handler for remote logging (works without printer)
        try:
            self.supabase_log_handler = SupabaseLogHandler(
                self.supabase,
                self.printer_id,
                batch_size=10,
                flush_interval=5.0,
                level=logging.INFO  # Only send INFO and above to Supabase
            )
            # Add to root logger so all logs go to Supabase
            logging.getLogger().addHandler(self.supabase_log_handler)
            logger.info("[Logging] Supabase log handler initialized - logs will be sent to database")
        except Exception as e:
            logger.warning(f"[Logging] Failed to initialize Supabase log handler: {e} - continuing with local logs only")
        
        # Try to connect to printer, but don't fail if not connected
        try:
            self.printer = EpsonSerialPrinter(
                device=self.printer_device,
                baudrate=self.printer_baud
            )
            logger.info(f"[Printer] Connected to printer at {self.printer_device} ({self.printer_baud} baud)")
        except Exception as e:
            logger.warning(f"[Printer] Could not connect to printer: {e} - will run in offline mode")
            self.printer = None
    
    async def check_for_updates(self) -> bool:
        """
        Check if there are updates available on GitHub and pull them.
        Returns True if updates were pulled, False otherwise.
        """
        try:
            import subprocess
            
            logger.info("[Update] Checking for updates from GitHub...")
            
            # Fetch latest from origin
            fetch_result = subprocess.run(
                ['git', 'fetch', 'origin', 'main'],
                cwd='/home/jimmy/print-server',
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if fetch_result.returncode != 0:
                logger.warning(f"[Update] Git fetch failed: {fetch_result.stderr}")
                return False
            
            # Check if local is behind remote
            status_result = subprocess.run(
                ['git', 'rev-list', '--count', 'HEAD..origin/main'],
                cwd='/home/jimmy/print-server',
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if status_result.returncode != 0:
                logger.warning(f"[Update] Git status check failed: {status_result.stderr}")
                return False
            
            commits_behind = int(status_result.stdout.strip() or '0')
            
            if commits_behind > 0:
                logger.info(f"[Update] Found {commits_behind} new commit(s) - pulling updates...")
                
                # Pull the updates
                pull_result = subprocess.run(
                    ['git', 'pull', 'origin', 'main'],
                    cwd='/home/jimmy/print-server',
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if pull_result.returncode == 0:
                    logger.info(f"[Update] Successfully pulled updates: {pull_result.stdout}")
                    logger.info("[Update] Restarting to apply updates...")
                    return True
                else:
                    logger.error(f"[Update] Git pull failed: {pull_result.stderr}")
                    return False
            else:
                logger.info("[Update] Already up to date - no updates needed")
                return False
                
        except Exception as e:
            logger.error(f"[Update] Failed to check for updates: {e}")
            return False

    # ------------------------------------------------------------------
    # Realtime subscription
    # ------------------------------------------------------------------

    async def _subscribe_realtime(self) -> None:
        """
        Subscribe to INSERT events on print_jobs filtered to this printer.
        The callback fires immediately when the POS queues a new job.
        Includes automatic reconnection on channel errors.
        """
        async def on_insert(payload):
            record = payload.get('data', {}).get('record') or payload.get('record', {})
            if not record:
                logger.warning(f"[Realtime] Received payload with no record: {payload}")
                return

            job_id = record.get('id')
            status = record.get('status')

            if status != 'pending':
                return  # only care about fresh pending jobs

            logger.info(f"[Realtime] New job received: {job_id}")
            await self._dispatch_job(record)

        def on_subscribe(status, err=None):
            if status == 'SUBSCRIBED':
                logger.info("[Realtime] Successfully subscribed to print_jobs channel")
                self._realtime_healthy = True
                self._reconnect_attempts = 0
            elif status in ('CHANNEL_ERROR', 'TIMED_OUT'):
                logger.warning(f"[Realtime] Channel issue ({status}): {err} — fallback poll active")
                self._realtime_healthy = False
                self._reconnect_attempts += 1
                # Schedule reconnection attempt
                asyncio.ensure_future(self._reconnect_realtime())
            else:
                logger.debug(f"[Realtime] Channel status: {status}")

        channel = (
            self.supabase
            .channel(f"print-jobs-{self.printer_id}")
            .on_postgres_changes(
                event="INSERT",
                schema="public",
                table="print_jobs",
                filter=f"printer_id=eq.{self.printer_id}",
                callback=on_insert,
            )
            .subscribe(on_subscribe)
        )

        self._realtime_channel = channel
        logger.info("[Realtime] Subscribed to print_jobs INSERT events")

        # Also subscribe to printer config changes for remote restart
        def on_printer_update(payload):
            try:
                new_config = payload.get('new', {}).get('config', {}) or {}
                command = new_config.get('command')
                if command == 'restart':
                    logger.info("[Remote] Restart command received — exiting for systemd restart")
                    self.running = False
                    self._shutdown_event.set()
                elif command == 'test_print':
                    logger.info("[Remote] Test print command received")
                    if self.printer:
                        self.printer.test_print()
                elif command == 'update':
                    logger.info("[Remote] Update command received — pulling latest code")
                    try:
                        import subprocess
                        result = subprocess.run(
                            ['git', 'pull', 'origin', 'main'],
                            cwd='/home/jimmy/penkey-pos',
                            capture_output=True,
                            text=True,
                            timeout=30
                        )
                        logger.info(f"[Remote] Git pull output: {result.stdout}")
                        if result.returncode == 0:
                            logger.info("[Remote] Update successful — restarting")
                            self.running = False
                            self._shutdown_event.set()
                        else:
                            logger.error(f"[Remote] Git pull failed: {result.stderr}")
                    except Exception as update_err:
                        logger.error(f"[Remote] Update failed: {update_err}")
            except Exception as e:
                logger.error(f"[Remote] Error processing printer command: {e}")

        def on_cmd_subscribe(status, err=None):
            if status == 'SUBSCRIBED':
                logger.info("[Realtime] Subscribed to printer config changes (remote commands)")
            elif status in ('CHANNEL_ERROR', 'TIMED_OUT'):
                logger.warning(f"[Realtime] Printer config channel issue ({status}): {err}")

        cmd_channel = (
            self.supabase
            .channel(f"printer-cmd-{self.printer_id}")
            .on_postgres_changes(
                event="UPDATE",
                schema="public",
                table="printers",
                filter=f"id=eq.{self.printer_id}",
                callback=on_printer_update,
            )
            .subscribe(on_cmd_subscribe)
        )

        self._cmd_channel = cmd_channel

    async def _reconnect_realtime(self) -> None:
        """Attempt to reconnect realtime channels after an error."""
        if not self.running:
            return

        # Exponential backoff: 2s, 4s, 8s, 16s, capped at 30s
        delay = min(2 ** self._reconnect_attempts, 30)
        logger.info(f"[Realtime] Attempting reconnection in {delay}s (attempt {self._reconnect_attempts})")

        await asyncio.sleep(delay)

        if not self.running:
            return

        try:
            # Unsubscribe old channels
            await self._unsubscribe_realtime()

            # Resubscribe
            logger.info("[Realtime] Reconnecting realtime channels...")
            await self._subscribe_realtime()
            logger.info("[Realtime] Reconnection complete")
        except Exception as e:
            logger.error(f"[Realtime] Reconnection failed: {e}")
            self._realtime_healthy = False
            self._reconnect_attempts += 1
            # Schedule another attempt
            asyncio.ensure_future(self._reconnect_realtime())

    async def _unsubscribe_realtime(self) -> None:
        """Gracefully unsubscribe from all realtime channels"""
        for attr in ('_realtime_channel', '_cmd_channel'):
            try:
                channel = getattr(self, attr, None)
                if channel:
                    await self.supabase.remove_channel(channel)
                    logger.info(f"[Realtime] Unsubscribed from {attr}")
            except Exception as e:
                logger.warning(f"[Realtime] Error unsubscribing {attr}: {e}")

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------

    async def update_printer_status(self, status: str, error: Optional[str] = None) -> None:
        """Update printer status and heartbeat in Supabase"""
        if not self.supabase:
            logger.debug(f"[Status] Supabase not connected - skipping status update: {status}")
            return
        
        try:
            updates: Dict[str, Any] = {
                'status': status,
                'last_seen_at': datetime.utcnow().isoformat()
            }
            if error:
                updates['config'] = {'last_error': error}

            # Use raw table access to avoid schema cache issues
            table = self.supabase.table('printers')
            await table.update(updates).eq('id', self.printer_id).execute()
        except Exception as e:
            logger.error(f"Failed to update printer heartbeat: {e}")
            # Don't crash - continue running

    async def get_pending_jobs(self) -> list:
        """Fetch all pending jobs for this printer (fallback poll)"""
        if not self.supabase:
            logger.debug("[Jobs] Supabase not connected - skipping job fetch")
            return []
        
        try:
            response = await self.supabase.table('print_jobs') \
                .select('*') \
                .eq('printer_id', self.printer_id) \
                .eq('status', 'pending') \
                .order('created_at') \
                .execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to fetch pending jobs: {e}")
            return []

    async def update_job_status(self, job_id: str, status: str, error: Optional[str] = None) -> None:
        """Update a job's status, incrementing attempts when moving to 'printing'"""
        if not self.supabase:
            logger.debug(f"[DB] Supabase not connected - skipping job status update: {job_id} → {status}")
            return
        
        try:
            updates: Dict[str, Any] = {'status': status}

            if status == 'printing':
                try:
                    logger.info(f"[DB] Fetching current attempts for job {job_id}")
                    resp = await self.supabase.table('print_jobs') \
                        .select('attempts') \
                        .eq('id', job_id) \
                        .single() \
                        .execute()
                    current = resp.data.get('attempts', 0) if resp.data else 0
                    updates['attempts'] = current + 1
                    logger.info(f"[DB] Job {job_id} current attempts: {current}, new attempts: {updates['attempts']}")
                except Exception as e:
                    logger.warning(f"[DB] Failed to fetch attempts for job {job_id}: {e}, defaulting to 0")
                    updates['attempts'] = 0

            elif status == 'completed':
                # printed_at column doesn't exist in database
                pass

            if error:
                updates['error_message'] = error
                logger.info(f"[DB] Adding error message for job {job_id}: {error}")

            logger.info(f"[DB] Updating job {job_id} to status: {status}, updates: {updates}")
            result = await self.supabase.table('print_jobs') \
                .update(updates) \
                .eq('id', job_id) \
                .execute()
            logger.info(f"[DB] Job {job_id} → {status} (update successful)")
        except Exception as e:
            logger.error(f"[DB] Failed to update job {job_id} status: {e}", exc_info=True)

    # ------------------------------------------------------------------
    # Job dispatch (shared by realtime + fallback poll)
    # ------------------------------------------------------------------

    async def _dispatch_job(self, job: Dict[str, Any]) -> None:
        """
        Thread-safe entry point for processing a job.
        Skips jobs already being processed (prevents double-print when
        both realtime and the fallback poll fire for the same row).
        """
        job_id = job.get('id')
        if not job_id:
            return

        async with self._job_lock:
            if job_id in self._processing:
                logger.debug(f"Job {job_id} already in flight, skipping")
                return
            self._processing.add(job_id)

        try:
            await self.process_job(job)
        finally:
            async with self._job_lock:
                self._processing.discard(job_id)

    def _validate_job(self, job: Dict[str, Any]) -> tuple[bool, str]:
        """Validate job has required fields"""
        if not job.get('id'):
            return False, "Job missing 'id' field"
        return True, ""

    async def process_job(self, job: Dict[str, Any]) -> bool:
        """Process a single print job end-to-end"""
        # Validate job before processing
        is_valid, error_msg = self._validate_job(job)
        if not is_valid:
            logger.error(f"Job validation failed: {error_msg}")
            job_id = job.get('id', 'unknown')
            try:
                await self.update_job_status(job_id, 'failed', f"Invalid job: {error_msg}")
            except Exception as update_err:
                logger.error(f"Failed to mark invalid job {job_id} as failed: {update_err}")
            return False

        job_id = job['id']
        data = job.get('data', {})
        attempts = job.get('attempts', 0)
        max_attempts = job.get('max_attempts', 3)

        logger.info(f"Processing job {job_id} (attempt {attempts + 1}/{max_attempts})")

        # Prevent infinite retry loops - if already exceeded max attempts, mark as failed and don't process
        if attempts >= max_attempts:
            logger.error(f"Job {job_id} already exceeded max attempts ({attempts}/{max_attempts}), marking as failed")
            try:
                await self.update_job_status(job_id, 'failed', 'Exceeded maximum retry attempts')
            except Exception as update_err:
                logger.error(f"Failed to mark job {job_id} as failed after exceeding max attempts: {update_err}")
            return False

        await self.update_job_status(job_id, 'printing')

        try:
            # Get printer settings from job data or use defaults
            printer_settings = data.get('printer_settings', {})

            # Print as receipt for all jobs
            success = self._print_receipt(data, printer_settings)

            logger.info(f"Print operation returned: success={success}")
            if success:
                logger.info(f"Attempting to mark job {job_id} as completed...")
                await self.update_job_status(job_id, 'completed')
                return True
            else:
                raise Exception("Print command returned failure")

        except Exception as e:
            err = str(e)
            logger.error(f"Job {job_id} failed: {err}")
            # Only retry if not exceeded max attempts
            next_status = 'failed' if (attempts + 1 >= max_attempts) else 'pending'
            try:
                await self.update_job_status(job_id, next_status, err)
            except Exception as update_err:
                logger.error(f"Failed to update job {job_id} status after failure: {update_err}")
                # If status update fails, don't retry to prevent infinite loop
                return False
            return False

    # ------------------------------------------------------------------
    # Print helpers
    # ------------------------------------------------------------------

    def _print_receipt(self, data: Dict[str, Any], settings: Optional[Dict] = None) -> bool:
        """
        Print receipt - app is responsible for all layout and formatting.
        Print server acts as simple rendering layer only.
        """
        if not self.printer:
            logger.error("[Print] Printer not connected - cannot print job")
            return False
        
        logger.info(f"[Print] _print_receipt called with data keys: {list(data.keys())}")
        logger.info(f"[Print] settings: {settings}")
        receipt_text = data.get('receipt_text')
        if not receipt_text:
            logger.error("Print job missing 'receipt_text' - app must provide formatted receipt content")
            logger.error(f"[Print] Available data keys: {list(data.keys())}")
            logger.error(f"[Print] Data sample: {str(data)[:500]}")
            return False
        logger.info(f"[Print] receipt_text found, length: {len(receipt_text)}")
        logger.info(f"[Print] receipt_text first 100 chars: {receipt_text[:100]}")
        return self.printer.print_receipt(receipt_text, settings)

    # ------------------------------------------------------------------
    # Main run loop
    # ------------------------------------------------------------------

    async def run(self) -> None:
        """
        Start realtime subscription then enter a lightweight heartbeat loop.
        The fallback poll runs every POLL_INTERVAL seconds to catch any jobs
        that arrived while the websocket was reconnecting.
        """
        logger.info("Starting Penkey print server (async realtime + fallback poll)...")
        self.running = True

        await self.connect()
        
        # Check for updates on startup
        updates_pulled = await self.check_for_updates()
        if updates_pulled:
            logger.info("[Update] Updates were pulled - restarting to apply changes...")
            self.running = False
            self._shutdown_event.set()
            return
        
        # Set status based on whether printer is connected
        printer_status = 'online' if self.printer else 'offline'
        await self.update_printer_status(printer_status)

        # Start realtime subscription
        await self._subscribe_realtime()
        
        # Start periodic log flushing
        if self.supabase_log_handler:
            self._log_flush_task = asyncio.create_task(
                self.supabase_log_handler.start_periodic_flush()
            )
            logger.info("[Logging] Started periodic log flush task")

        # Process any jobs that were queued before we started (startup drain)
        logger.info("Draining any jobs queued before startup...")
        for job in await self.get_pending_jobs():
            await self._dispatch_job(job)

        # Main event loop
        while self.running and not self._shutdown_event.is_set():
            try:
                # Use shorter poll interval when realtime is unhealthy
                effective_interval = 2 if not self._realtime_healthy else self.poll_interval

                # Wait for shutdown event or poll interval
                try:
                    await asyncio.wait_for(self._shutdown_event.wait(), timeout=effective_interval)
                except asyncio.TimeoutError:
                    # Poll interval elapsed, do fallback poll
                    pass

                if not self.running:
                    break

                # Fallback poll — catches anything missed during realtime downtime
                if not self._realtime_healthy:
                    logger.info("[Fallback] Realtime unhealthy — polling for pending jobs...")
                else:
                    logger.debug("[Fallback] Polling for missed pending jobs...")
                for job in await self.get_pending_jobs():
                    await self._dispatch_job(job)
                
                # Heartbeat - update last_seen_at periodically
                printer_status = 'online' if self.printer else 'offline'
                await self.update_printer_status(printer_status)

            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                try:
                    await self.update_printer_status('error', str(e))
                except Exception:
                    pass
                await asyncio.sleep(5)

        logger.info("Print server stopped")

    def _signal_handler(self, signum, frame) -> None:
        logger.info(f"Received signal {signum}, shutting down...")
        self.running = False
        self._shutdown_event.set()

    async def shutdown(self) -> None:
        """Graceful shutdown"""
        logger.info("Shutting down print server...")
        await self._unsubscribe_realtime()
        try:
            await self.update_printer_status('offline')
        except Exception:
            pass
        if self.printer:
            self.printer._disconnect()
        
        # Stop log flushing and send remaining logs
        if self.supabase_log_handler:
            logger.info("[Logging] Flushing remaining logs to Supabase...")
            await self.supabase_log_handler.stop()
            logging.getLogger().removeHandler(self.supabase_log_handler)
        
        # AsyncClient doesn't have close(), just let it cleanup naturally

    # ------------------------------------------------------------------
    # Test mode
    # ------------------------------------------------------------------

    async def test_mode(self) -> None:
        """Print a test page and exercise the job pipeline"""
        logger.info("Running in test mode...")
        await self.connect()

        logger.info("Printing hardware test page...")
        self.printer.test_print()

        logger.info("Simulating a test job through the pipeline...")
        await self.process_job({
            'id': 'test-job',
            'job_type': 'test',
            'template': 'test',
            'data': {},
            'attempts': 0,
            'max_attempts': 3,
        })


async def main():
    server = PrintServer()
    
    # Setup signal handlers
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, server._signal_handler, sig, None)

    if '--test' in sys.argv:
        await server.test_mode()
        await server.shutdown()
        return

    try:
        await server.run()
    finally:
        await server.shutdown()


if __name__ == '__main__':
    asyncio.run(main())
