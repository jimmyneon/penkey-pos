# 🎯 Final Setup Steps - Do This Once!

## What We Built

✅ **Remote Logging** - All print server logs go to Supabase  
✅ **Auto-Deployment** - Push code → Pi updates automatically  
✅ **Remote Commands** - Update, restart, test print from anywhere  
✅ **API Access** - View/search logs via API  

---

## Steps to Complete Setup

### 1. Create the Database Table (5 minutes)

**In Supabase SQL Editor:**

```sql
-- Copy and paste the entire contents of:
-- migrations/create_printer_logs_table.sql
```

This creates the `printer_logs` table where all remote logs will be stored.

### 2. Update the Raspberry Pi (LAST TIME! 🎉)

```bash
# SSH into the Pi
ssh jimmy@<pi-ip-address>

# Pull the latest code
cd /home/jimmy/penkey-pos
git pull origin main

# Restart the print server
sudo systemctl restart print-server

# Watch the logs to confirm it's working
tail -f /home/jimmy/print-server/print.log
```

**You should see:**
```
[Logging] Supabase log handler initialized - logs will be sent to database
[Logging] Started periodic log flush task
```

### 3. Test Remote Logging (2 minutes)

**In Supabase SQL Editor:**

```sql
-- Wait 10 seconds, then check for logs
SELECT timestamp, level, message 
FROM printer_logs 
ORDER BY timestamp DESC 
LIMIT 10;
```

You should see logs from the print server! 🎉

### 4. Test Remote Deployment (2 minutes)

**Option A - Via Supabase (Easiest):**

```sql
-- Send update command
UPDATE printers 
SET config = '{"command": "update"}'::jsonb
WHERE name = 'Main Printer';

-- Wait 30 seconds, then check status
SELECT status, last_seen_at FROM printers WHERE name = 'Main Printer';
```

**Option B - Via API:**

```bash
curl -X POST https://your-app.com/api/printers/{printer-id}/command \
  -H "Content-Type: application/json" \
  -d '{"command": "update"}'
```

---

## Optional: GitHub Actions Auto-Deployment

If you want automatic deployment when you push code:

1. See `AUTO_DEPLOYMENT_SETUP.md` for full instructions
2. Requires creating a GitHub Personal Access Token
3. Once set up, every push to `main` automatically deploys to Pi

**Without GitHub Actions:** You can still deploy manually using the Supabase command above.

---

## Usage After Setup

### Deploy New Code

**Method 1 - Automatic (if GitHub Actions is set up):**
```bash
git push origin main
# Done! Pi updates automatically in ~30 seconds
```

**Method 2 - Manual via Supabase:**
```sql
UPDATE printers SET config = '{"command": "update"}'::jsonb WHERE name = 'Main Printer';
```

### View Logs Remotely

**Recent logs:**
```sql
SELECT timestamp, level, message 
FROM printer_logs 
WHERE printer_id = 'your-printer-id'
ORDER BY timestamp DESC 
LIMIT 100;
```

**Errors only:**
```sql
SELECT timestamp, message, context 
FROM printer_logs 
WHERE level = 'ERROR'
ORDER BY timestamp DESC;
```

**Search logs:**
```sql
SELECT timestamp, level, message 
FROM printer_logs 
WHERE message ILIKE '%receipt%'
ORDER BY timestamp DESC;
```

### Remote Commands

**Restart print server:**
```sql
UPDATE printers SET config = '{"command": "restart"}'::jsonb WHERE name = 'Main Printer';
```

**Test print:**
```sql
UPDATE printers SET config = '{"command": "test_print"}'::jsonb WHERE name = 'Main Printer';
```

---

## Troubleshooting

### Logs not appearing in Supabase?

1. Check print server is running:
   ```bash
   ssh jimmy@<pi-ip> 'sudo systemctl status print-server'
   ```

2. Check for errors in local logs:
   ```bash
   ssh jimmy@<pi-ip> 'grep ERROR /home/jimmy/print-server/print.log | tail -20'
   ```

3. Verify Supabase connection:
   ```bash
   ssh jimmy@<pi-ip> 'cat /home/jimmy/penkey-pos/print-server/.env | grep SUPABASE'
   ```

### Deployment not working?

1. Check printer status:
   ```sql
   SELECT status, last_seen_at, config FROM printers WHERE name = 'Main Printer';
   ```

2. Check recent logs:
   ```sql
   SELECT * FROM printer_logs WHERE level = 'ERROR' ORDER BY timestamp DESC LIMIT 10;
   ```

3. Manual restart:
   ```bash
   ssh jimmy@<pi-ip> 'cd /home/jimmy/penkey-pos && git pull && sudo systemctl restart print-server'
   ```

---

## What's Next?

After this setup is complete, you'll **never need to physically access the Raspberry Pi again** for:
- Code updates
- Viewing logs  
- Debugging issues
- Testing the printer

Everything can be done remotely! 🚀

---

## Files to Reference

- `AUTO_DEPLOYMENT_SETUP.md` - Complete deployment guide
- `REMOTE_PRINTER_MANAGEMENT.md` - Remote management overview
- `migrations/create_printer_logs_table.sql` - Database schema
- `deploy-print-server-workflow.yml` - GitHub Actions workflow (optional)

---

## Summary

**Before:** Physical access required for everything  
**After:** Everything remote via Supabase + GitHub

**Time to set up:** ~10 minutes  
**Time saved:** Hours every week  

Do these steps once, then enjoy remote management forever! ✨
