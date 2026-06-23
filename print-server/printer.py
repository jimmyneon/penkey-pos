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
            # DEBUG: log first 200 chars and their hex to trace £ encoding
            sample = receipt_text[:200] if receipt_text else ''
            logger.info(f"[Print] receipt_text type={type(receipt_text).__name__}, len={len(receipt_text)}")
            logger.info(f"[Print] first 200 chars repr: {repr(sample)}")
            logger.info(f"[Print] first 200 chars hex: {sample.encode('utf-8').hex()}")
            # Check if £ is present
            pound_idx = receipt_text.find('£')
            if pound_idx >= 0:
                logger.info(f"[Print] Found £ at index {pound_idx}, ord={ord(receipt_text[pound_idx])}")
            else:
                logger.info("[Print] WARNING: No £ character found in receipt_text!")
                # Check for common alternatives
                for i, ch in enumerate(receipt_text):
                    if ord(ch) > 127:
                        logger.info(f"[Print] Non-ASCII at idx {i}: char={repr(ch)} ord={ord(ch)}")
                        if i > 20:
                            break
            commands = self._build_escpos_receipt(receipt_text, settings)
            logger.info(f"[Print] Built {len(commands)} bytes of ESC/POS commands")
            self._print_raw(commands)
            logger.info("[Print] Receipt printed successfully")
            return True
        except Exception as e:
            logger.error(f"[Print] Failed to print receipt: {e}", exc_info=True)
            logger.error(f"[Print] Exception type: {type(e).__name__}")
            logger.error(f"[Print] Exception args: {e.args}")
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
        App controls all layout, content, and settings.
        Print server applies those settings as hardware commands and renders text.
        """
        commands = bytearray()

        # All settings come from the app via printer_settings in the job data
        settings = settings or {}
        code_page = settings.get('code_page', 19)       # App decides code page (default CP858)
        feed_lines = settings.get('feed_lines_before_cut', 6)

        # Initialize printer (clean state)
        commands.extend([0x1B, 0x40])          # ESC @ — initialize/reset
        commands.extend([0x1B, 0x21, 0x00])    # ESC ! 0 — Font A, no scaling
        commands.extend([0x1B, 0x74, code_page])  # ESC t n — set code page from app settings

        # Process each line — app controls content, we just render
        for line in text.split('\n'):
            stripped = line.strip()

            if not stripped:
                commands.append(0x0A)
                continue

            # QR code marker: [QR:url]
            if stripped.startswith('[QR:') and stripped.endswith(']'):
                qr_data = stripped[4:-1]
                commands.extend(self._build_qr_command(qr_data))
                commands.append(0x0A)
                continue

            # Barcode marker: [BARCODE:data]
            if stripped.startswith('[BARCODE:') and stripped.endswith(']'):
                barcode_data = stripped[9:-1]
                commands.extend(self._build_barcode_command(barcode_data))
                commands.append(0x0A)
                continue

            # Bold markers (**text**) — app decides what is bold
            if stripped.startswith('**') and stripped.endswith('**'):
                commands.extend([0x1B, 0x45, 0x01])  # Bold on
                line = stripped[2:-2]
            else:
                commands.extend([0x1B, 0x45, 0x00])  # Bold off

            # Double-size markers (##text##) — app decides what is large
            if stripped.startswith('##') and stripped.endswith('##'):
                commands.extend([0x1D, 0x21, 0x11])  # Double width + height
                line = stripped[2:-2]
            else:
                commands.extend([0x1D, 0x21, 0x00])  # Normal size

            # Alignment — left by default, app uses markers or text structure
            commands.extend([0x1B, 0x61, 0x00])  # Left align

            # Encode text: replace £ with raw byte 0x9C (correct on CP437/CP850/CP858)
            # then encode the rest as ascii. This avoids codec mismatches entirely.
            encoded = bytearray()
            for ch in line:
                if ch == '£':
                    encoded.append(0x9C)
                else:
                    encoded.extend(ch.encode('ascii', errors='replace'))
            commands.extend(encoded)
            commands.append(0x0A)

        # Reset formatting
        commands.extend([0x1B, 0x45, 0x00])  # Bold off
        commands.extend([0x1D, 0x21, 0x00])  # Normal size
        commands.extend([0x1B, 0x61, 0x00])  # Left align

        # Feed lines before cut (app setting)
        commands.extend([0x0A] * feed_lines)

        # Cut paper
        commands.extend([0x1D, 0x56, 0x42, 0x00])  # GS V B 0

        return bytes(commands)

    def _build_qr_command(self, data: str) -> bytes:
        """
        Build ESC/POS QR code commands for Epson TM-T88IV.
        Uses GS ( k command set.
        """
        commands = bytearray()
        encoded_data = data.encode('ascii', errors='replace')

        # Set QR model: GS ( k pL pH cn fn n
        commands.extend([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00])

        # Set QR size (module size = 8): GS ( k pL pH cn fn n
        commands.extend([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x08])

        # Set error correction level M: GS ( k pL pH cn fn n
        commands.extend([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31])

        # Store data: GS ( k pL pH cn fn m d1...dk
        data_len = len(encoded_data) + 3
        commands.extend([0x1D, 0x28, 0x6B, data_len & 0xFF, (data_len >> 8) & 0xFF, 0x31, 0x50, 0x30])
        commands.extend(encoded_data)

        # Print QR code: GS ( k pL pH cn fn m
        commands.extend([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30])

        return bytes(commands)

    def _build_barcode_command(self, data: str) -> bytes:
        """
        Build ESC/POS barcode commands for Epson TM-T88IV.
        Uses GS k command with CODE128 (function B).
        """
        commands = bytearray()
        encoded_data = data.encode('ascii', errors='replace')

        # CODE128 function B: GS k m n d1...dn
        # m = 73 = CODE128, n = data length
        commands.extend([0x1D, 0x6B, 0x49, len(encoded_data)])
        commands.extend(encoded_data)

        return bytes(commands)

    def _build_escpos_text(self, text: str, settings: Optional[Dict] = None) -> bytes:
        """Build ESC/POS commands for plain text"""
        commands = bytearray()

        # Get settings or use defaults
        settings = settings or {}
        code_page = settings.get('code_page', 19)  # CP858 by default
        feed_lines = settings.get('feed_lines_before_cut', 6)

        # Initialize
        commands.extend([0x1B, 0x40])

        # Set code page
        commands.extend([0x1B, 0x74, code_page])

        # Add text
        for line in text.split('\n'):
            encoded = bytearray()
            for ch in line:
                if ch == '£':
                    encoded.append(0x9C)
                else:
                    encoded.extend(ch.encode('ascii', errors='replace'))
            commands.extend(encoded)
            commands.append(0x0A)

        # Feed lines before cut
        commands.extend([0x0A] * feed_lines)

        # Cut paper
        commands.extend([0x1D, 0x56, 0x42, 0x00])

        return bytes(commands)

    def _center(self, text: str) -> str:
        """Center text in a 42-character line (80mm paper, Font A)"""
        width = 42
        padding = (width - len(text)) // 2
        return ' ' * max(0, padding) + text

    def __del__(self):
        """Cleanup on deletion"""
        self._disconnect()


# Backward compatibility alias
EpsonPrinter = EpsonSerialPrinter
