# Penkey POS Print Server
# Raspberry Pi Print Server for Epson TM-series Thermal Printers

A Python-based print server that runs on Raspberry Pi to print receipts from the Penkey POS system using CUPS and ESC/POS commands.

## Features

- Real-time monitoring of Supabase print queue
- CUPS integration for printer management
- ESC/POS command generation for Epson TM-series printers
- Automatic retry on failure
- Status reporting back to Supabase
- Support for 58mm and 80mm paper widths

## Hardware Requirements

- Raspberry Pi (3B+ or 4 recommended)
- Epson TM-series thermal receipt printer (TM-T20, TM-T20II, TM-T82, etc.)
- USB cable to connect printer to Raspberry Pi
- Reliable internet connection (WiFi or Ethernet)

## Software Requirements

- Raspberry Pi OS (64-bit recommended)
- Python 3.9+
- CUPS printing system
- Epson printer driver

## Installation

### 1. Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install CUPS and printer drivers
sudo apt install -y cups cups-bsd printer-driver-escpr

# Install Python dependencies
sudo apt install -y python3-pip python3-venv python3-dev

# Add user to lpadmin group
sudo usermod -a -G lpadmin pi
```

### 2. Configure CUPS

```bash
# Start CUPS service
sudo systemctl enable cups
sudo systemctl start cups

# Allow remote admin access (optional, for web interface)
sudo cupsctl --remote-any

# Open firewall for CUPS (if needed)
sudo ufw allow 631/tcp
```

Access CUPS web interface at `http://raspberrypi.local:631`

### 3. Install Epson Printer

1. Connect your Epson printer via USB
2. In CUPS web interface, go to Administration → Add Printer
3. Select your Epson USB printer
4. Set name to something like `epson-tm-t20` (you'll need this later)
5. Select "Epson" as the make
6. Select appropriate model (e.g., "Epson TM-T20 Receipt Printer")
7. Set paper size to 80x297mm (or 58mm for narrower paper)

### 4. Install Print Server

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

### 5. Configuration

Create a `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
PRINTER_ID=your-printer-uuid-from-database
CUPS_PRINTER_NAME=epson-tm-t20
POLL_INTERVAL=5
```

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

### Testing Print Server

```bash
source venv/bin/activate
python print_server.py --test
```

### Testing Direct Print

```bash
source venv/bin/activate
python -c "from printer import EpsonPrinter; p = EpsonPrinter('epson-tm-t20'); p.test_print()"
```

## Troubleshooting

### Printer Not Found

```bash
# List USB devices
lsusb

# List CUPS printers
lpstat -p -d

# Check CUPS error log
sudo tail -f /var/log/cups/error_log
```

### Permission Issues

```bash
# Fix USB permissions
sudo usermod -a -G lp pi
sudo chmod 666 /dev/usb/lp0  # temporary
```

### Connection Issues

```bash
# Test Supabase connection
source venv/bin/activate
python -c "from supabase import create_client; import os; from dotenv import load_dotenv; load_dotenv(); sb = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY')); print(sb.table('print_jobs').select('*').limit(1).execute())"
```

## ESC/POS Commands Reference

The print server uses ESC/POS commands for direct printer control:

- `ESC @` - Initialize printer
- `ESC a 1` - Center alignment
- `ESC a 0` - Left alignment
- `ESC E 1` - Bold on
- `ESC E 0` - Bold off
- `GS ! n` - Select character size
- `GS V 0` - Cut paper

## Paper Sizes

- **80mm**: Standard thermal receipt paper (recommended)
- **58mm**: Narrow thermal receipt paper

## License

Internal use only - Penkey POS System
