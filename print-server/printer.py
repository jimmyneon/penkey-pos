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

    def print_receipt(self, receipt_text: str, settings: Optional[Dict] = None, data: Optional[Dict] = None) -> bool:
        """Print a formatted receipt"""
        try:
            logger.info("[Print] Starting receipt print")
            # Use dynamic receipt building if structured data is provided
            if data and data.get('lines'):
                commands = self._build_dynamic_receipt(data, settings)
            else:
                # Fall back to text-based receipt for compatibility
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
        code_page = settings.get('code_page', 0x02)  # CP850 by default
        feed_lines = settings.get('feed_lines_before_cut', 6)

        # Initialize printer
        commands.extend([0x1B, 0x40])  # ESC @

        # Set code page from settings
        commands.extend([0x1B, 0x74, code_page])

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

    def _horizontal_rule(self, width: int = 42) -> str:
        """Generate a horizontal rule of specified width"""
        return '-' * width

    def _build_aligned_line(self, left: str, right: str, width: int = 42) -> str:
        """Build a line with left and right aligned text"""
        # Calculate spacing needed
        spacing = width - len(left) - len(right)
        if spacing < 1:
            spacing = 1
        return left + ' ' * spacing + right

    def _wrap_text(self, text: str, width: int = 42) -> list:
        """Wrap text to fit within specified width"""
        words = text.split()
        lines = []
        current_line = ''
        
        for word in words:
            if len(current_line) + len(word) + 1 <= width:
                if current_line:
                    current_line += ' ' + word
                else:
                    current_line = word
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        
        if current_line:
            lines.append(current_line)
        
        return lines

    def _build_dynamic_receipt(self, data: Dict, settings: Optional[Dict] = None) -> bytes:
        """
        Build a dynamic receipt using ESC/POS commands and helper functions.
        This replaces the hardcoded template approach.
        """
        commands = bytearray()
        
        # Get settings or use defaults
        settings = settings or {}
        code_page = settings.get('code_page', 19)  # CP858 for £ symbol
        feed_lines = settings.get('feed_lines_before_cut', 6)
        width = 42  # 42 characters per line for 80mm paper

        # Initialize printer
        commands.extend([0x1B, 0x40])  # ESC @ - Initialize
        commands.extend([0x1B, 0x74, code_page])  # Set code page

        # Header (centre aligned using ESC/POS commands)
        commands.extend([0x1B, 0x61, 0x01])  # Center align
        commands.extend('PENKEY DELICAF'.encode('latin-1', errors='replace'))
        commands.append(0x0A)
        commands.extend('5 New Street, Lymington'.encode('latin-1', errors='replace'))
        commands.append(0x0A)
        commands.extend('WhatsApp Pre-orders: 01590 619472'.encode('latin-1', errors='replace'))
        commands.append(0x0A)
        
        # Blank line
        commands.append(0x0A)

        # Divider (left aligned)
        commands.extend([0x1B, 0x61, 0x00])  # Left align
        commands.extend(self._horizontal_rule(width).encode('latin-1', errors='replace'))
        commands.append(0x0A)

        # Items (left/right aligned)
        items = data.get('lines', [])
        for item in items:
            item_name = item.get('item_name', 'Item')
            price = f"£{item.get('line_total', 0):.2f}"
            line = self._build_aligned_line(item_name, price, width)
            commands.extend(line.encode('latin-1', errors='replace'))
            commands.append(0x0A)

        # Divider
        commands.extend(self._horizontal_rule(width).encode('latin-1', errors='replace'))
        commands.append(0x0A)

        # Totals
        subtotal = f"£{data.get('subtotal', 0):.2f}"
        total = f"£{data.get('total', 0):.2f}"
        
        commands.extend(self._build_aligned_line('Subtotal', subtotal, width).encode('latin-1', errors='replace'))
        commands.append(0x0A)
        
        # TOTAL (bold)
        commands.extend([0x1B, 0x45, 0x01])  # Bold on
        commands.extend(self._build_aligned_line('TOTAL', total, width).encode('latin-1', errors='replace'))
        commands.append(0x0A)
        commands.extend([0x1B, 0x45, 0x00])  # Bold off

        # Blank line
        commands.append(0x0A)

        # Payment + metadata
        payment_method = data.get('payment_method', 'Cash')
        date = data.get('date', '')
        time = data.get('time', '')
        receipt_number = data.get('receipt_number', '')
        
        commands.extend(payment_method.encode('latin-1', errors='replace'))
        commands.append(0x0A)
        commands.extend(f'{date} {time}'.encode('latin-1', errors='replace'))
        commands.append(0x0A)
        commands.extend(f'Order #{receipt_number}'.encode('latin-1', errors='replace'))
        commands.append(0x0A)

        # Blank line
        commands.append(0x0A)

        # Footer (centre aligned)
        commands.extend([0x1B, 0x61, 0x01])  # Center align
        commands.extend('Thank you for visiting'.encode('latin-1', errors='replace'))
        commands.append(0x0A)

        # Blank lines
        commands.extend([0x0A] * 3)

        # Reset formatting
        commands.extend([0x1B, 0x45, 0x00])  # Bold off
        commands.extend([0x1B, 0x61, 0x00])  # Left align

        # Feed lines before cut
        commands.extend([0x0A] * feed_lines)

        # Cut paper
        commands.extend([0x1D, 0x56, 0x42, 0x00])  # GS V B 0 - feed and cut

        return bytes(commands)

    def print_debug_alignment(self) -> bool:
        """Print alignment debug mode to verify centering"""
        try:
            logger.info("[Print] Starting alignment debug print")
            commands = bytearray()
            
            # Initialize printer
            commands.extend([0x1B, 0x40])  # ESC @
            commands.extend([0x1B, 0x74, 19])  # CP858

            # Debug line 1: 42-character ruler
            commands.extend('123456789012345678901234567890123456789012'.encode('latin-1', errors='replace'))
            commands.append(0x0A)

            # Debug line 2: Centre X
            commands.extend([0x1B, 0x61, 0x01])  # Center align
            commands.extend('X'.encode('latin-1', errors='replace'))
            commands.append(0x0A)

            # Debug line 3: Header
            commands.extend('PENKEY DELICAF'.encode('latin-1', errors='replace'))
            commands.append(0x0A)

            # Reset
            commands.extend([0x1B, 0x61, 0x00])  # Left align

            # Feed and cut
            commands.extend([0x0A] * 6)
            commands.extend([0x1D, 0x56, 0x42, 0x00])

            self._print_raw(commands)
            logger.info("[Print] Alignment debug print successful")
            return True
        except Exception as e:
            logger.error(f"[Print] Alignment debug print failed: {e}")
            return False

    def __del__(self):
        """Cleanup on deletion"""
        self._disconnect()


# Backward compatibility alias
EpsonPrinter = EpsonSerialPrinter
