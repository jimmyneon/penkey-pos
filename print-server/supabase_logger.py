#!/usr/bin/env python3
"""
Supabase Log Handler
Sends logs to Supabase for remote monitoring
"""

import logging
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
from collections import deque
import json


class SupabaseLogHandler(logging.Handler):
    """
    Custom log handler that sends logs to Supabase.
    Batches logs and sends them asynchronously to avoid blocking.
    """

    def __init__(
        self,
        supabase_client,
        printer_id: str,
        batch_size: int = 10,
        flush_interval: float = 5.0,
        level=logging.INFO
    ):
        super().__init__(level)
        self.supabase = supabase_client
        self.printer_id = printer_id
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.log_queue = deque(maxlen=1000)  # Max 1000 logs in memory
        self._flush_task = None
        self._running = False

    def emit(self, record: logging.LogRecord) -> None:
        """Queue log record for batch sending"""
        try:
            # Format the log message
            message = self.format(record)
            
            # Extract context from the record
            context = {
                'module': record.module,
                'function': record.funcName,
                'line': record.lineno,
            }
            
            # Add any extra fields from the record
            if hasattr(record, 'job_id'):
                context['job_id'] = record.job_id
            if hasattr(record, 'error_type'):
                context['error_type'] = record.error_type
            if record.exc_info:
                context['exception'] = self.formatException(record.exc_info)
            
            # Create log entry
            log_entry = {
                'printer_id': self.printer_id,
                'level': record.levelname,
                'message': message,
                'context': context,
                'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            }
            
            # Add to queue
            self.log_queue.append(log_entry)
            
            # Flush if batch size reached
            if len(self.log_queue) >= self.batch_size:
                asyncio.create_task(self._flush_logs())
                
        except Exception as e:
            # Don't let logging errors crash the app
            self.handleError(record)

    async def _flush_logs(self) -> None:
        """Send queued logs to Supabase"""
        if not self.log_queue:
            return
            
        # Get all queued logs
        logs_to_send = []
        while self.log_queue and len(logs_to_send) < self.batch_size:
            logs_to_send.append(self.log_queue.popleft())
        
        if not logs_to_send:
            return
            
        try:
            # Send to Supabase
            await self.supabase.table('printer_logs').insert(logs_to_send).execute()
        except Exception as e:
            # If sending fails, put logs back in queue (up to max size)
            for log in reversed(logs_to_send):
                if len(self.log_queue) < self.log_queue.maxlen:
                    self.log_queue.appendleft(log)
            # Log to stderr as fallback
            print(f"[SupabaseLogger] Failed to send logs: {e}", flush=True)

    async def start_periodic_flush(self) -> None:
        """Start background task to flush logs periodically"""
        self._running = True
        while self._running:
            try:
                await asyncio.sleep(self.flush_interval)
                await self._flush_logs()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[SupabaseLogger] Error in periodic flush: {e}", flush=True)

    async def stop(self) -> None:
        """Stop periodic flushing and send remaining logs"""
        self._running = False
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        # Final flush
        await self._flush_logs()

    def close(self) -> None:
        """Close handler and flush remaining logs"""
        # Note: This is synchronous, so we can't await
        # Logs may be lost if not flushed before close
        super().close()


class LocalFileHandler(logging.Handler):
    """
    Primary handler that writes to local file.
    Always works, can't be broken by network issues or Supabase changes.
    """
    
    def __init__(self, filename: str, level=logging.DEBUG):
        super().__init__(level)
        self.filename = filename
        
    def emit(self, record: logging.LogRecord) -> None:
        try:
            message = self.format(record)
            with open(self.filename, 'a') as f:
                f.write(f"{message}\n")
        except Exception:
            pass  # Silently fail - don't crash logging
