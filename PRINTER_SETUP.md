# Penkey POS Printer Setup Guide

This guide walks you through setting up the print queue system with a Raspberry Pi print server for Epson TM-series thermal receipt printers.

## Overview

The printer system consists of:

1. **Database Layer** — `printers` and `print_jobs` tables in Supabase
2. **Print Queue Service** — TypeScript service for managing printers and jobs
3. **Raspberry Pi Print Server** — Python daemon that listens for jobs and prints via CUPS
4. **UI Components** — Printer management interface in the POS settings

## Architecture

```
POS Frontend → API Routes → Supabase DB
                                  ↑  ↓  Realtime WebSocket (instant)
                            Print Server (Raspberry Pi) → CUPS → Epson Printer
```

When a receipt is printed:
1. POS creates a `pending` print job row in Supabase
2. Supabase Realtime broadcasts the INSERT to the print server **immediately** (WebSocket)
3. Print server receives the job, converts it to ESC/POS commands
4. Print server sends raw commands to the printer via CUPS
5. Print server updates the job status to `completed`
6. A fallback poll runs every 30 s to catch any jobs missed during a brief network drop

---

## Step 1: Database Setup

Run the Supabase migration to create the tables:

```bash
# Navigate to the database package
cd packages/database

# Apply the migration to your Supabase project
supabase db push
```

Or manually run the SQL from `packages/database/supabase/migrations/001_create_print_queue.sql` in the Supabase SQL Editor.

---

## Step 2: Raspberry Pi Setup

### Hardware Requirements

- Raspberry Pi (3B+ or 4 recommended)
- Epson TM-series thermal receipt printer (TM-T20, TM-T20II, TM-T82, etc.)
- USB cable to connect printer to Raspberry Pi
- Reliable internet connection

### Install System Dependencies

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

### Configure CUPS

```bash
# Start CUPS service
sudo systemctl enable cups
sudo systemctl start cups

# Allow remote admin access
sudo cupsctl --remote-any
```

Access CUPS web interface: `http://raspberrypi.local:631`

### Install Epson Printer in CUPS

#### Option A — Command line (recommended, fastest)

Connect the USB printer, then run:

```bash
# Check the Pi detected the USB printer
lpinfo -v | grep -i epson
# Expected output: direct usb://EPSON/TM-T20%20...

# Add the printer (adjust the URI from the output above)
sudo lpadmin -p epson-tm-t20 \
  -E \
  -v "$(lpinfo -v | grep -i 'epson\|tm-t20\|tm-t82' | head -1 | awk '{print $2}')" \
  -m everywhere

# --- CRITICAL: Set the correct paper size ---
# For 80mm paper (standard thermal roll):
sudo lpoptions -p epson-tm-t20 -o media=Custom.80x297mm
sudo lpoptions -p epson-tm-t20 -o PageSize=Custom.80x297mm

# For 58mm paper (narrow thermal roll):
sudo lpoptions -p epson-tm-t20 -o media=Custom.58x297mm
sudo lpoptions -p epson-tm-t20 -o PageSize=Custom.58x297mm

# Set as default printer
sudo lpadmin -d epson-tm-t20

# Verify settings
lpstat -p epson-tm-t20 -l
lpoptions -p epson-tm-t20
```

#### Option B — CUPS web interface

1. Open `http://raspberrypi.local:631` in a browser
2. Administration → Add Printer → log in with `pi` credentials
3. Select the Epson USB device from the list
4. Set name: `epson-tm-t20`
5. Make: **Epson**, Model: **Epson TM-T20 Receipt** (or nearest match)
6. After adding, go to **Set Default Options**:
   - **Media Size**: `Custom.80x297mm` (or `Custom.58x297mm` for 58mm paper)
   - **Cut Method**: Full Cut

> ⚠️ **The paper size setting is the most common cause of receipts printing at the wrong size or with large white margins.** Always confirm it with `lpoptions -p epson-tm-t20` after setup.

### Install Print Server

```bash
# Copy files to the Pi (from your dev machine):
scp print-server/print_server.py \
    print-server/printer.py \
    print-server/requirements.txt \
    pi@raspberrypi.local:~/penkey-print-server/

# OR clone the repo directly on the Pi:
git clone https://github.com/your-org/penkey-pos.git /tmp/penkey-pos
cp /tmp/penkey-pos/print-server/{print_server.py,printer.py,requirements.txt} \
   ~/penkey-print-server/

# Set up Python virtual environment
cd ~/penkey-print-server
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Configure Print Server

```bash
cp .env.example .env
nano .env   # or: vim .env
```

Fill in all values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key-here
PRINTER_ID=your-printer-uuid-from-database
CUPS_PRINTER_NAME=epson-tm-t20
POLL_INTERVAL=30
```

**Getting the values:**
- `SUPABASE_URL`: Supabase Dashboard → Project Settings → API → Project URL
- `SUPABASE_KEY`: Supabase Dashboard → Project Settings → API → **service_role** secret key
- `PRINTER_ID`: Add a printer in POS Settings → Printers first, then copy the UUID shown
- `CUPS_PRINTER_NAME`: Must exactly match the name you used in `lpadmin` / CUPS (`epson-tm-t20`)
- `POLL_INTERVAL`: Fallback poll interval in seconds — 30 is fine (realtime handles the rest)

### Run as System Service

```bash
# Copy service file
sudo cp print-server.service /etc/systemd/system/penkey-print-server.service

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable penkey-print-server
sudo systemctl start penkey-print-server

# Check status
sudo systemctl status penkey-print-server

# View logs
sudo journalctl -u penkey-print-server -f
```

### Test Print Server

```bash
# Test mode - prints a test page
source venv/bin/activate
python print_server.py --test
```

---

## Step 3: POS Configuration

### Add Printer to POS

1. Log into the POS system
2. Go to Settings
3. Scroll to "Printers" section
4. Click "Add Printer"
5. Fill in the details:
   - Name: "Main Receipt Printer" (or whatever you want)
   - Type: "epson"
   - Connection: "cups"
   - CUPS Printer Name: `epson-tm-t20` (must match CUPS)
   - Paper Width: 80 (or 58 for narrow paper)
6. Save

### Link Printer to Register

Make sure the printer's `register_id` matches your POS register. This happens automatically when you add the printer from the register's settings page.

---

## Step 4: Testing

### Test from POS

1. Create a test sale
2. Click "Print Receipt"
3. Check the print queue in Settings → Printers
4. The job should show as "pending" then "completed"

### Test from Print Server

```bash
# Check if print server is running
sudo systemctl status penkey-print-server

# View real-time logs
sudo journalctl -u penkey-print-server -f

# Manually trigger test print
source ~/penkey-print-server/venv/bin/activate
python ~/penkey-print-server/print_server.py --test
```

---

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

### Print Server Won't Start

```bash
# Check Python environment
source ~/penkey-print-server/venv/bin/activate
python print_server.py --test

# Check environment variables
cat .env

# Check Supabase connection
python -c "from supabase import create_client; import os; from dotenv import load_dotenv; load_dotenv(); sb = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY')); print(sb.table('printers').select('*').limit(1).execute())"
```

### Jobs Stuck in Pending

1. Check print server is running: `sudo systemctl status penkey-print-server`
2. Check logs: `sudo journalctl -u penkey-print-server -f`
3. Verify printer status in database is "online"
4. Check `PRINTER_ID` in `.env` matches the database

### Receipts Print at Wrong Size / Huge White Margins

This is almost always a CUPS paper size mismatch. Fix it with:

```bash
# Check what paper size is currently set
lpoptions -p epson-tm-t20
# Look for:  PageSize=... or media=...

# Reset to correct size (80mm standard roll):
sudo lpoptions -p epson-tm-t20 -o media=Custom.80x297mm
sudo lpoptions -p epson-tm-t20 -o PageSize=Custom.80x297mm
sudo lpadmin -p epson-tm-t20 -o media=Custom.80x297mm

# Reset to correct size (58mm narrow roll):
sudo lpoptions -p epson-tm-t20 -o media=Custom.58x297mm
sudo lpoptions -p epson-tm-t20 -o PageSize=Custom.58x297mm
sudo lpadmin -p epson-tm-t20 -o media=Custom.58x297mm

# Restart CUPS to apply
sudo systemctl restart cups
```

### Paper Size Reference

| Roll width | CUPS custom size | `PAPER_WIDTH` in .env |
|------------|-----------------|----------------------|
| 80mm       | `Custom.80x297mm` | `80` |
| 58mm       | `Custom.58x297mm` | `58` |

---

## File Structure

```
print-server/
├── README.md              # General documentation
├── requirements.txt       # Python dependencies
├── print_server.py        # Main print server daemon
├── printer.py             # ESC/POS printer interface
├── print-server.service   # systemd service file
└── .env.example           # Environment template

packages/database/supabase/migrations/
└── 001_create_print_queue.sql  # Database schema

src/
├── lib/
│   ├── services/
│   │   └── print-queue.ts    # Print queue service
│   └── hooks/
│       ├── use-printers.ts  # Printers React hook
│       └── use-print-jobs.ts # Print jobs React hook
├── app/
│   └── api/
│       ├── printers/
│       │   └── route.ts     # Printer API endpoints
│       ├── print-jobs/
│       │   └── route.ts     # Print job API endpoints
│       └── receipts/print/
│           └── route.ts     # Updated to use queue
└── components/
    └── printer-manager.tsx   # Printer management UI
```

---

## API Reference

### Printer API

- `GET /api/printers` - List all printers
- `POST /api/printers` - Create a printer
- `PATCH /api/printers` - Update a printer
- `DELETE /api/printers?id={id}` - Delete a printer

### Print Job API

- `GET /api/print-jobs?printer_id={id}` - List jobs for a printer
- `POST /api/print-jobs` - Create a test print job
- `PATCH /api/print-jobs` - Retry or cancel a job

### Receipt Print API

- `POST /api/receipts/print` - Create receipt print job
  - Request: `{ receipt_id: string, printer_id?: string }`
  - Response: `{ success: true, queued: true, job_id: string }`

---

## Security Considerations

1. **Use Service Role Key on Print Server Only**
   - The print server needs full database access
   - Never expose this key in client-side code

2. **CUPS Security**
   - By default, CUPS allows local connections only
   - The print server runs locally and connects to CUPS

3. **Row Level Security**
   - Database tables have RLS policies for authenticated users
   - Print server uses service role key (bypasses RLS)

---

## Maintenance

### Updating Print Server

```bash
cd ~/penkey-print-server
source venv/bin/activate

# Pull new code (via git, scp, etc.)
# Then restart
sudo systemctl restart penkey-print-server
```

### Viewing Statistics

```sql
-- View print job statistics
SELECT 
  printer_id,
  status,
  COUNT(*) as count
FROM print_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY printer_id, status;
```

### Cleaning Old Jobs

```sql
-- Delete completed jobs older than 30 days
DELETE FROM print_jobs
WHERE status = 'completed'
  AND created_at < NOW() - INTERVAL '30 days';
```

---

## Next Steps

1. Run the database migration
2. Set up the Raspberry Pi with your Epson printer
3. Configure the print server with your Supabase credentials
4. Add a printer in the POS settings
5. Test with a real receipt

For support, check the logs on the Raspberry Pi with:
```bash
sudo journalctl -u penkey-print-server -f
```
