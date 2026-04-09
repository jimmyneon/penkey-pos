#!/usr/bin/env python3
"""
Epson Printer Module
Handles ESC/POS commands and CUPS printing
"""

import cups
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class EpsonPrinter:
    """Epson TM-series printer interface using CUPS"""

    def __init__(self, cups_printer_name: str):
        self.cups_printer_name = cups_printer_name
        self.conn = cups.Connection()
        
        # Verify printer exists
        printers = self.conn.getPrinters()
        if cups_printer_name not in printers:
            available = list(printers.keys())
            raise ValueError(f"Printer '{cups_printer_name}' not found. Available: {available}")
        
        logger.info(f"Initialized printer: {cups_printer_name}")

    def print_receipt(self, receipt_text: str) -> bool:
        """Print a formatted receipt"""
        try:
            # Build ESC/POS commands
            commands = self._build_escpos_receipt(receipt_text)
            
            # Send to printer via CUPS
            self._print_raw(commands)
            
            logger.info("Receipt printed successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to print receipt: {e}")
            return False

    def print_text(self, text: str) -> bool:
        """Print plain text"""
        try:
            commands = self._build_escpos_text(text)
            self._print_raw(commands)
            logger.info("Text printed successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to print text: {e}")
            return False

    def test_print(self) -> bool:
        """Print a test page"""
        try:
            test_text = f"""{self._center('Penkey POS')}
{self._center('Printer Test')}
{self._center('=' * 24)}

Printer: {self.cups_printer_name}
Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Status: Online

{self._center('Printer is working!')}

{self._center('Thank you')}



"""
            return self.print_text(test_text)
        except Exception as e:
            logger.error(f"Test print failed: {e}")
            return False

    def _print_raw(self, data: bytes) -> None:
        """Send raw data to printer via CUPS"""
        import tempfile
        import os

        # Write to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        try:
            # Send to printer
            self.conn.printFile(
                self.cups_printer_name,
                tmp_path,
                "Print Job",
                {}
            )
        finally:
            # Clean up temp file
            os.unlink(tmp_path)

    def _build_escpos_receipt(self, text: str) -> bytes:
        """Build ESC/POS commands for receipt printing"""
        commands = bytearray()

        # Initialize printer
        commands.extend([0x1B, 0x40])  # ESC @

        # Set code page to UTF-8
        commands.extend([0x1B, 0x74, 0x10])

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

            # Add text
            commands.extend(line.encode('utf-8', errors='replace'))
            commands.append(0x0A)  # Line feed

        # Reset formatting
        commands.extend([0x1B, 0x45, 0x00])  # Bold off
        commands.extend([0x1D, 0x21, 0x00])  # Normal size
        commands.extend([0x1B, 0x61, 0x00])  # Left align

        # Cut paper
        commands.extend([0x1D, 0x56, 0x00])  # Full cut

        return bytes(commands)

    def _build_escpos_text(self, text: str) -> bytes:
        """Build ESC/POS commands for plain text"""
        commands = bytearray()

        # Initialize
        commands.extend([0x1B, 0x40])

        # Set code page
        commands.extend([0x1B, 0x74, 0x10])

        # Add text
        for line in text.split('\n'):
            commands.extend(line.encode('utf-8', errors='replace'))
            commands.append(0x0A)

        # Cut paper
        commands.extend([0x1D, 0x56, 0x00])

        return bytes(commands)

    def _center(self, text: str) -> str:
        """Center text in a 32-character line (80mm paper)"""
        width = 32
        padding = (width - len(text)) // 2
        return ' ' * max(0, padding) + text


class EpsonDirectUSB:
    """Direct USB printer control (alternative to CUPS)"""
    
    def __init__(self, device_path: str = '/dev/usb/lp0'):
        self.device_path = device_path
        
    def print_raw(self, data: bytes) -> bool:
        """Print raw data directly to USB device"""
        try:
            with open(self.device_path, 'wb') as printer:
                printer.write(data)
                printer.flush()
            return True
        except Exception as e:
            logger.error(f"Direct USB print failed: {e}")
            return False

    def print_receipt(self, text: str) -> bool:
        """Print receipt using direct USB"""
        # Build ESC/POS commands
        commands = bytearray()
        
        # Initialize
        commands.extend([0x1B, 0x40])
        
        # Add text
        for line in text.split('\n'):
            commands.extend(line.encode('utf-8', errors='replace'))
            commands.extend([0x0A, 0x0D])  # CRLF
        
        # Cut
        commands.extend([0x1D, 0x56, 0x00])
        
        return self.print_raw(bytes(commands))
