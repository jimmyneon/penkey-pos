# Penkey POS Print Server
# Raspberry Pi Print Server for Epson TM-series Thermal Printers

A Python-based print server that runs on Raspberry Pi to print receipts from the Penkey POS system using direct serial communication and ESC/POS commands.

## Features

- Real-time monitoring of Supabase print queue
- Direct serial communication (no CUPS required)
- ESC/POS command generation for Epson TM-series printers
- Automatic retry on failure
- Status reporting back to Supabase
- Support for 58mm and 80mm paper widths

## Hardware Requirements

- Raspberry Pi (3B+ or 4 recommended)
- Epson TM-series thermal receipt printer (TM-T88IV, TM-T20, TM-T20II, TM-T82, etc.)
- USB-to-serial adapter (for TM-T88IV) or USB cable (for other models)
- Reliable internet connection (WiFi or Ethernet)

## Software Requirements

- Raspberry Pi OS (64-bit recommended)
- Python 3.9+
- pyserial library

## Installation

### 1. Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python dependencies
sudo apt install -y python3-pip python3-venv python3-dev

# Add user to dialout group for serial access
sudo usermod -a -G dialout pi
```

### 2. Install Print Server

```bash
# Create application directory
mkdir -p ~/penkey-print-server
cd ~/penkey-print-server

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python packages
pip install -r requirements.txt
```

### 3. Connect Printer

Connect your Epson printer via USB-to-serial adapter (for TM-T88IV) or direct USB (for other models).

Verify the device path:
```bash
ls /dev/ttyUSB*
# Should show /dev/ttyUSB0 or similar
```

### 4. Configuration

Create a `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
PRINTER_ID=your-printer-uuid-from-database
PRINTER_DEVICE=/dev/ttyUSB0
PRINTER_BAUD=38400
POLL_INTERVAL=5
```

**Environment Variables:**
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase service role key
- `PRINTER_ID`: UUID of the printer from your database
- `PRINTER_DEVICE`: Serial device path (default: `/dev/ttyUSB0`)
- `PRINTER_BAUD`: Baud rate for serial communication (default: `38400`)
- `POLL_INTERVAL`: Fallback poll interval in seconds (default: `30`)

### 5. Test Printer

```bash
source venv/bin/activate
python print_server.py --test
```

This should print a test page to verify the printer is working.

### 6. Run as Service

```bash
# Copy service file
sudo cp print-server.service /etc/systemd/system/
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable penkey-print-server
sudo systemctl start penkey-print-server

# Check status
sudo systemctl status penkey-print-server

# View logs
sudo journalctl -u penkey-print-server -f
```

## Development

### Testing Serial Connection

```bash
source venv/bin/activate
python -c "from printer import EpsonSerialPrinter; p = EpsonSerialPrinter('/dev/ttyUSB0', 38400); p.test_print()"
```

### Testing Print Server

```bash
source venv/bin/activate
python print_server.py --test
```

## Troubleshooting

### Permission Denied on Serial Device

```bash
# Add user to dialout group
sudo usermod -a -G dialout pi

# Logout and login again for group change to take effect
# Or use temporary fix:
sudo chmod 666 /dev/ttyUSB0
```

### Serial Device Not Found

```bash
# List USB devices
lsusb

# List serial devices
ls /dev/ttyUSB*
ls /dev/ttyACM*

# Check device permissions
ls -l /dev/ttyUSB0
```

### Connection Issues

```bash
# Test serial connection with minicom
sudo apt install minicom
minicom -D /dev/ttyUSB0 -b 38400

# Test Supabase connection
source venv/bin/activate
python -c "from supabase import create_client; import os; from dotenv import load_dotenv; load_dotenv(); sb = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY')); print(sb.table('print_jobs').select('*').limit(1).execute())"
```

### Different Baud Rates

If your printer uses a different baud rate, update the `PRINTER_BAUD` environment variable:
- 9600 (common for older printers)
- 19200
- 38400 (default for TM-T88IV)
- 57600
- 115200

## ESC/POS Commands Reference

The print server uses ESC/POS commands for direct printer control:

- `ESC @` - Initialize printer
- `ESC a 1` - Center alignment
- `ESC a 0` - Left alignment
- `ESC E 1` - Bold on
- `ESC E 0` - Bold off
- `GS ! n` - Select character size
- `GS V 0` - Cut paper

## Serial Configuration

The printer uses the following serial settings (8N1):
- 8 data bits
- No parity
- 1 stop bit
- No hardware flow control (RTS/CTS)
- No software flow control (XON/XOFF)

## Paper Sizes

- **80mm**: Standard thermal receipt paper (recommended)
- **58mm**: Narrow thermal receipt paper

## License

Internal use only - Penkey POS System
