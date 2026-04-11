#!/usr/bin/env python3
"""
Serial Printer Test Script
Tests direct serial communication to Epson TM-series printer
"""

import os
import sys
from dotenv import load_dotenv
from printer import EpsonSerialPrinter

# Load environment variables
load_dotenv()

def test_serial_printer():
    """Test serial printer connection and print a test receipt"""

    # Get settings from environment or use defaults
    device = os.getenv('PRINTER_DEVICE', '/dev/ttyUSB0')
    baudrate = int(os.getenv('PRINTER_BAUD', '38400'))

    print(f"[Test] Testing serial printer at {device} ({baudrate} baud)")
    print(f"[Test] Make sure your Epson TM-series printer is connected via USB-to-serial adapter")
    print(f"[Test] Press Ctrl+C to cancel\n")

    try:
        # Initialize printer
        print(f"[Test] Initializing printer...")
        printer = EpsonSerialPrinter(device=device, baudrate=baudrate)
        print(f"[Test] Printer initialized successfully\n")

        # Print test receipt
        print(f"[Test] Printing test receipt...")
        success = printer.test_print()

        if success:
            print(f"[Test] Test receipt printed successfully!")
            print(f"[Test] Check your printer for the test page\n")
            return True
        else:
            print(f"[Test] Failed to print test receipt\n")
            return False

    except Exception as e:
        print(f"[Test] Error: {e}")
        print(f"[Test] Troubleshooting:")
        print(f"[Test] 1. Check if printer is connected: ls /dev/ttyUSB*")
        print(f"[Test] 2. Check permissions: ls -l {device}")
        print(f"[Test] 3. Add user to dialout group: sudo usermod -a -G dialout $USER")
        print(f"[Test] 4. Try different baud rate if needed\n")
        return False

if __name__ == '__main__':
    success = test_serial_printer()
    sys.exit(0 if success else 1)
