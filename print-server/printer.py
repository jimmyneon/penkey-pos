#!/usr/bin/env python3
"""
Epson Printer Module
Handles ESC/POS commands and serial printing
"""

import serial
import logging
from typing import Optional, Dict
from datetime import datetime
import os

logger = logging.getLogger(__name__)


class EpsonSerialPrinter:
    """Epson TM-series printer interface using serial connection"""

    def __init__(
        self,
        device: str = None,
        baudrate: int = None,
        timeout: float = 5.0
    ):
        # Get settings from environment or use defaults
        self.device = device or os.getenv('PRINTER_DEVICE', '/dev/ttyUSB0')
        self.baudrate = baudrate or int(os.getenv('PRINTER_BAUD', '38400'))
        self.timeout = timeout

        # Serial settings: 8N1 (8 data bits, no parity, 1 stop bit)
        self.serial_config = {
            'baudrate': self.baudrate,
            'bytesize': serial.EIGHTBITS,
            'parity': serial.PARITY_NONE,
            'stopbits': serial.STOPBITS_ONE,
            'timeout': self.timeout,
            'xonxoff': False,  # No software flow control
            'rtscts': False,   # No hardware flow control
        }

        self.serial_conn = None
        self._connect()

    def _connect(self) -> None:
        """Open serial connection to printer"""
        try:
            logger.info(f"[Serial] Opening connection to {self.device} at {self.baudrate} baud")
            self.serial_conn = serial.Serial(self.device, **self.serial_config)
            logger.info(f"[Serial] Successfully connected to printer at {self.device}")
        except serial.SerialException as e:
            logger.error(f"[Serial] Failed to connect to {self.device}: {e}")
            raise
        except Exception as e:
            logger.error(f"[Serial] Unexpected error connecting to {self.device}: {e}")
            raise

    def _disconnect(self) -> None:
        """Close serial connection"""
        if self.serial_conn and self.serial_conn.is_open:
            logger.info(f"[Serial] Closing connection to {self.device}")
            self.serial_conn.close()
            logger.info(f"[Serial] Connection closed")

    def print_receipt(self, receipt_text: str, settings: Optional[Dict] = None) -> bool:
        """Print a formatted receipt - app handles all layout and formatting"""
        try:
            logger.info("[Print] Starting receipt print")
            commands = self._build_escpos_receipt(receipt_text, settings)
            self._print_raw(commands)
            logger.info("[Print] Receipt printed successfully")
            return True
        except Exception as e:
            logger.error(f"[Print] Failed to print receipt: {e}")
            return False

    def print_text(self, text: str, settings: Optional[Dict] = None) -> bool:
        """Print plain text"""
        try:
            logger.info("[Print] Starting text print")
            commands = self._build_escpos_text(text, settings)
            self._print_raw(commands)
            logger.info("[Print] Text printed successfully")
            return True
        except Exception as e:
            logger.error(f"[Print] Failed to print text: {e}")
            return False

    def test_print(self) -> bool:
        """Print a test page"""
        try:
            logger.info("[Print] Starting test print")
            test_text = f"""{self._center('Penkey POS')}
{self._center('Printer Test')}
{self._center('=' * 24)}

Printer: {self.device}
Baud Rate: {self.baudrate}
Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Status: Online

{self._center('Printer is working!')}

{self._center('Thank you')}



"""
            result = self.print_text(test_text)
            if result:
                logger.info("[Print] Test print successful")
            return result
        except Exception as e:
            logger.error(f"[Print] Test print failed: {e}")
            return False

    def _print_raw(self, data: bytes) -> None:
        """Send raw data to printer via serial"""
        try:
            # Reconnect if connection was lost
            if not self.serial_conn or not self.serial_conn.is_open:
                self._connect()

            logger.debug(f"[Serial] Writing {len(data)} bytes to printer")
            self.serial_conn.write(data)
            self.serial_conn.flush()
            logger.debug("[Serial] Data written successfully")
        except serial.SerialException as e:
            logger.error(f"[Serial] Failed to write to printer: {e}")
            # Try to reconnect
            self._connect()
            raise
        except Exception as e:
            logger.error(f"[Serial] Unexpected error writing to printer: {e}")
            raise

    def _build_escpos_receipt(self, text: str, settings: Optional[Dict] = None) -> bytes:
        """
        Build ESC/POS commands for receipt printing.
        Device-specific rendering only - app controls all layout and content.
        """
        commands = bytearray()

        # Get settings or use defaults
        settings = settings or {}
        feed_lines = settings.get('feed_lines_before_cut', 6)

        # Initialize printer
        commands.extend([0x1B, 0x40])  # ESC @

        # Process each line
        for line in text.split('\n'):
            stripped = line.strip()

            if not stripped:
                commands.append(0x0A)  # Line feed
                continue

            # Check for formatting markers
            if stripped.startswith('**') and stripped.endswith('**'):
                # Bold text
                commands.extend([0x1B, 0x45, 0x01])  # Bold on
                line = stripped[2:-2]
            else:
                commands.extend([0x1B, 0x45, 0x00])  # Bold off

            if stripped.startswith('##') and stripped.endswith('##'):
                # Double size
                commands.extend([0x1D, 0x21, 0x11])  # Double width and height
                line = stripped[2:-2]
            else:
                commands.extend([0x1D, 0x21, 0x00])  # Normal size

            # Center alignment for headers
            if stripped == stripped.upper() and len(stripped) < 30 and ('=' in stripped or any(x in stripped for x in ['Penkey', 'RECEIPT', 'TOTAL'])):
                commands.extend([0x1B, 0x61, 0x01])  # Center align
            else:
                commands.extend([0x1B, 0x61, 0x00])  # Left align

            # Add text (use latin-1 for better character support)
            commands.extend(line.encode('latin-1', errors='replace'))
            commands.append(0x0A)  # Line feed

        # Reset formatting
        commands.extend([0x1B, 0x45, 0x00])  # Bold off
        commands.extend([0x1D, 0x21, 0x00])  # Normal size
        commands.extend([0x1B, 0x61, 0x00])  # Left align

        # Feed lines before cut
        commands.extend([0x0A] * feed_lines)

        # Cut paper (full cut with feed)
        commands.extend([0x1D, 0x56, 0x42, 0x00])  # GS V B 0 - feed and cut

        return bytes(commands)

    def _build_escpos_text(self, text: str, settings: Optional[Dict] = None) -> bytes:
        """Build ESC/POS commands for plain text"""
        commands = bytearray()

        # Get settings or use defaults
        settings = settings or {}
        code_page = settings.get('code_page', 0x02)  # CP850 by default
        feed_lines = settings.get('feed_lines_before_cut', 6)

        # Initialize
        commands.extend([0x1B, 0x40])

        # Set code page
        commands.extend([0x1B, 0x74, code_page])

        # Add text
        for line in text.split('\n'):
            commands.extend(line.encode('latin-1', errors='replace'))
            commands.append(0x0A)

        # Feed lines before cut
        commands.extend([0x0A] * feed_lines)

        # Cut paper
        commands.extend([0x1D, 0x56, 0x42, 0x00])

        return bytes(commands)

    def _center(self, text: str) -> str:
        """Center text in a 58-character line (80mm paper)"""
        width = 58
        padding = (width - len(text)) // 2
        return ' ' * max(0, padding) + text

    def __del__(self):
        """Cleanup on deletion"""
        self._disconnect()


# Backward compatibility alias
EpsonPrinter = EpsonSerialPrinter
