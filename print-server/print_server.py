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

# Load environment variables
load_dotenv()

# Configure logging
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
        self.poll_interval = int(os.getenv('POLL_INTERVAL', '30'))  # fallback only

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
        self.supabase = AsyncClient(self.supabase_url, self.supabase_key)
        self.printer = EpsonSerialPrinter(
            device=self.printer_device,
            baudrate=self.printer_baud
        )
        logger.info(f"Connected to Supabase and printer at {self.printer_device} ({self.printer_baud} baud)")

    # ------------------------------------------------------------------
    # Realtime subscription
    # ------------------------------------------------------------------

    async def _subscribe_realtime(self) -> None:
        """
        Subscribe to INSERT events on print_jobs filtered to this printer.
        The callback fires immediately when the POS queues a new job.
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
            elif status in ('CHANNEL_ERROR', 'TIMED_OUT'):
                logger.warning(f"[Realtime] Channel issue ({status}): {err} — fallback poll active")
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

    async def _unsubscribe_realtime(self) -> None:
        """Gracefully unsubscribe from the realtime channel"""
        try:
            channel = getattr(self, '_realtime_channel', None)
            if channel:
                await self.supabase.remove_channel(channel)
                logger.info("[Realtime] Unsubscribed from channel")
        except Exception as e:
            logger.warning(f"[Realtime] Error unsubscribing: {e}")

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------

    async def update_printer_status(self, status: str, error: Optional[str] = None) -> None:
        """Update printer heartbeat in Supabase (status column not updated as it doesn't exist)"""
        try:
            updates: Dict[str, Any] = {
                'last_seen_at': datetime.utcnow().isoformat()
            }
            if error:
                updates['last_error'] = error

            # Only update last_seen_at and last_error - status column doesn't exist
            await self.supabase.table('printers') \
                .update(updates) \
                .eq('id', self.printer_id) \
                .execute()
        except Exception as e:
            logger.error(f"Failed to update printer heartbeat: {e}")

    async def get_pending_jobs(self) -> list:
        """Fetch all pending jobs for this printer (fallback poll)"""
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
        try:
            updates: Dict[str, Any] = {'status': status}

            if status == 'printing':
                try:
                    resp = await self.supabase.table('print_jobs') \
                        .select('attempts') \
                        .eq('id', job_id) \
                        .single() \
                        .execute()
                    current = resp.data.get('attempts', 0) if resp.data else 0
                    updates['attempts'] = current + 1
                except Exception as e:
                    logger.warning(f"Failed to fetch attempts for job {job_id}: {e}, defaulting to 0")
                    updates['attempts'] = 0

            elif status == 'completed':
                # printed_at column doesn't exist in database
                pass

            if error:
                updates['error_message'] = error

            logger.debug(f"[DB] Updating job {job_id} to status: {status}, updates: {updates}")
            result = await self.supabase.table('print_jobs') \
                .update(updates) \
                .eq('id', job_id) \
                .execute()
            logger.info(f"Job {job_id} → {status} (update successful)")
        except Exception as e:
            logger.error(f"Failed to update job {job_id} status: {e}")

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
        job_type = job.get('type', 'receipt')  # Default to receipt if missing
        data = job.get('data', {})
        attempts = job.get('attempts', 0)
        max_attempts = job.get('max_attempts', 3)

        logger.info(f"Processing job {job_id} (type={job_type}, attempt {attempts + 1}/{max_attempts})")

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

            # Handle any job type - treat as generic print
            if job_type == 'test':
                success = self.printer.test_print()
            elif job_type == 'report':
                success = self.printer.print_text(data.get('report_text', ''), printer_settings)
            else:
                # Default to receipt print for any other type (receipt, customer_copy, etc.)
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
        receipt_text = data.get('receipt_text') or self._format_receipt(data)
        return self.printer.print_receipt(receipt_text, settings)

    def _format_receipt(self, data: Dict[str, Any]) -> str:
        """Fallback formatter when receipt_text is not pre-built"""
        lines = [
            "Penkey Delicaf & Gifts",
            "------------------------",
            f"Receipt #{data.get('receipt_number', 'N/A')}",
            f"Date: {data.get('date', '')} {data.get('time', '')}",
            f"Served by: {data.get('employee_name', 'Staff')}",
            "",
            "------------------------",
        ]
        for line in data.get('lines', []):
            lines.append(f"{line.get('quantity', 1)}x {line.get('item_name', 'Item')}")
            for mod in line.get('modifiers', []):
                lines.append(f"  + {mod.get('name', '')}")
            lines.append(f"            \u00a3{line.get('line_total', 0):.2f}")
            lines.append("")
        lines += [
            "------------------------",
            f"Subtotal:       \u00a3{data.get('subtotal', 0):.2f}",
            f"Tax:            \u00a3{data.get('tax', 0):.2f}",
            "------------------------",
            f"TOTAL:          \u00a3{data.get('total', 0):.2f}",
            "------------------------",
            "",
            "Thank you for your custom!",
            "Please visit again soon",
            "", "",
        ]
        return "\n".join(lines)

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
        await self.update_printer_status('online')

        # Start realtime subscription
        await self._subscribe_realtime()

        # Process any jobs that were queued before we started (startup drain)
        logger.info("Draining any jobs queued before startup...")
        for job in await self.get_pending_jobs():
            await self._dispatch_job(job)

        # Main event loop
        while self.running and not self._shutdown_event.is_set():
            try:
                # Wait for shutdown event or poll interval
                try:
                    await asyncio.wait_for(self._shutdown_event.wait(), timeout=self.poll_interval)
                except asyncio.TimeoutError:
                    # Poll interval elapsed, do fallback poll
                    pass

                if not self.running:
                    break

                # Fallback poll — catches anything missed during realtime downtime
                logger.debug("[Fallback] Polling for missed pending jobs...")
                for job in await self.get_pending_jobs():
                    await self._dispatch_job(job)
                # Heartbeat: keep printer status fresh
                await self.update_printer_status('online')

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
