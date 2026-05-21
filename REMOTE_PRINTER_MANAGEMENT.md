# Remote Printer Management Guide

## Overview

You can now manage your Raspberry Pi print server remotely without physical access. This includes:
- **Deploying code updates** from GitHub
- **Restarting** the print server
- **Sending test prints**
- **Viewing logs** remotely

---

## 🚀 Quick Start: Deploy Updates Remotely

### Method 1: Via Supabase (Recommended - No SSH Required)

**From your POS app or Supabase dashboard:**

1. Update the printer's config in Supabase:
   ```sql
   UPDATE printers 
   SET config = '{"command": "update", "timestamp": "2026-05-21T10:00:00Z"}'::jsonb
   WHERE id = 'your-printer-id';
   ```

2. The print server will:
   - Detect the command via realtime subscription
   - Pull latest code from GitHub (`git pull origin main`)
   - Automatically restart

**Or use the API endpoint (coming soon in UI):**
```bash
curl -X POST https://your-app.com/api/printers/{printer-id}/command \
  -H "Content-Type: application/json" \
  -d '{"command": "update"}'
```

### Method 2: Via SSH (Traditional)

**One-time setup on Raspberry Pi:**

1. Create update script:
   ```bash
   cat > /home/jimmy/update-print-server.sh << 'EOF'
   #!/bin/bash
   cd /home/jimmy/penkey-pos
   git pull origin main
   sudo systemctl restart print-server
   echo "Print server updated at $(date)" >> /home/jimmy/update.log
   EOF
   
   chmod +x /home/jimmy/update-print-server.sh
   ```

2. Add to your local machine's `~/.zshrc`:
   ```bash
   alias update-pi='ssh jimmy@<pi-ip-address> "/home/jimmy/update-print-server.sh"'
   ```

3. Deploy from anywhere:
   ```bash
   update-pi
   ```

---

## 📋 Available Remote Commands

### 1. Update Code (`update`)
Pulls latest code from GitHub and restarts the print server.

**Via Supabase:**
```sql
UPDATE printers 
SET config = '{"command": "update"}'::jsonb
WHERE id = 'your-printer-id';
```

**Via API:**
```bash
POST /api/printers/{id}/command
{"command": "update"}
```

### 2. Restart Server (`restart`)
Restarts the print server without updating code.

**Via Supabase:**
```sql
UPDATE printers 
SET config = '{"command": "restart"}'::jsonb
WHERE id = 'your-printer-id';
```

### 3. Test Print (`test_print`)
Sends a test page to verify printer is working.

**Via Supabase:**
```sql
UPDATE printers 
SET config = '{"command": "test_print"}'::jsonb
WHERE id = 'your-printer-id';
```

---

## 📊 Remote Log Monitoring

### Option 1: Supabase Logs (Future Enhancement)

We can add a feature to stream logs to Supabase:

```python
# In print_server.py - add custom log handler
class SupabaseLogHandler(logging.Handler):
    def emit(self, record):
        # Send log to Supabase table
        supabase.table('printer_logs').insert({
            'printer_id': self.printer_id,
            'level': record.levelname,
            'message': record.getMessage(),
            'timestamp': datetime.utcnow().isoformat()
        }).execute()
```

### Option 2: SSH Log Viewing

**View live logs:**
```bash
ssh jimmy@<pi-ip> 'tail -f /home/jimmy/print-server/print.log'
```

**View last 100 lines:**
```bash
ssh jimmy@<pi-ip> 'tail -n 100 /home/jimmy/print-server/print.log'
```

**Search for errors:**
```bash
ssh jimmy@<pi-ip> 'grep ERROR /home/jimmy/print-server/print.log | tail -n 20'
```

**Create alias for quick access:**
```bash
# Add to ~/.zshrc
alias pi-logs='ssh jimmy@<pi-ip> "tail -f /home/jimmy/print-server/print.log"'
alias pi-errors='ssh jimmy@<pi-ip> "grep ERROR /home/jimmy/print-server/print.log | tail -n 50"'
```

### Option 3: Automated Log Sync (Advanced)

**Setup on Raspberry Pi:**
```bash
# Install rsync (usually pre-installed)
sudo apt-get install rsync

# Create cron job to sync logs every hour
crontab -e

# Add this line:
0 * * * * rsync -az /home/jimmy/print-server/print.log jimmy@your-server:/backup/logs/print-$(date +\%Y\%m\%d).log
```

---

## 🔧 Workflow: Making Changes

### Typical Development Flow

1. **Make changes on your Mac:**
   ```bash
   # Edit files in /Users/johnhopwood/penkey-pos/print-server/
   git add -A
   git commit -m "Fix receipt printing issue"
   git push origin main
   ```

2. **Deploy to Raspberry Pi (choose one):**

   **Option A - Via Supabase (no physical access needed):**
   ```sql
   UPDATE printers SET config = '{"command": "update"}'::jsonb WHERE name = 'Main Printer';
   ```

   **Option B - Via SSH:**
   ```bash
   update-pi
   ```

3. **Monitor the deployment:**
   ```bash
   pi-logs
   ```

4. **Test the changes:**
   - Print a test receipt from POS
   - Check logs for any errors

---

## 🛠️ Troubleshooting

### Print server won't update

**Check if print server is running:**
```bash
ssh jimmy@<pi-ip> 'sudo systemctl status print-server'
```

**Manually pull and restart:**
```bash
ssh jimmy@<pi-ip> 'cd /home/jimmy/penkey-pos && git pull origin main && sudo systemctl restart print-server'
```

### Can't see logs

**Check log file exists:**
```bash
ssh jimmy@<pi-ip> 'ls -lh /home/jimmy/print-server/print.log'
```

**Check permissions:**
```bash
ssh jimmy@<pi-ip> 'sudo chmod 644 /home/jimmy/print-server/print.log'
```

### Git pull fails

**Check for uncommitted changes:**
```bash
ssh jimmy@<pi-ip> 'cd /home/jimmy/penkey-pos && git status'
```

**Reset to clean state (WARNING: loses local changes):**
```bash
ssh jimmy@<pi-ip> 'cd /home/jimmy/penkey-pos && git reset --hard origin/main'
```

---

## 🎯 Future Enhancements

### 1. Web-Based Log Viewer
Add a page in the POS app to view printer logs in real-time:
- `/settings/printers/[id]/logs`
- Stream logs via Supabase realtime
- Filter by level (ERROR, WARNING, INFO)
- Download logs as file

### 2. Automated Health Checks
Print server pings Supabase every 5 minutes with:
- Status (online/offline)
- Last successful print
- Error count
- Disk space
- Memory usage

### 3. Rollback Feature
Store last 5 deployments and allow one-click rollback:
```sql
UPDATE printers 
SET config = '{"command": "rollback", "version": "v1.2.3"}'::jsonb
WHERE id = 'printer-id';
```

### 4. Multi-Printer Management
Bulk update all printers at once:
```sql
UPDATE printers 
SET config = '{"command": "update"}'::jsonb
WHERE org_id = 'your-org-id';
```

---

## 📝 Notes

- **Security**: The update command only works for authenticated users with proper permissions
- **Systemd**: The print server is configured to auto-restart on failure
- **Git Authentication**: Ensure the Raspberry Pi has SSH keys set up for GitHub access
- **Network**: Raspberry Pi must have internet access to pull from GitHub

---

## 🔐 SSH Setup (One-Time)

If you haven't set up SSH access yet:

1. **On Raspberry Pi:**
   ```bash
   sudo systemctl enable ssh
   sudo systemctl start ssh
   ```

2. **On your Mac:**
   ```bash
   # Generate SSH key if you don't have one
   ssh-keygen -t ed25519 -C "your-email@example.com"
   
   # Copy key to Raspberry Pi
   ssh-copy-id jimmy@<pi-ip-address>
   
   # Test connection
   ssh jimmy@<pi-ip-address>
   ```

3. **Find Pi IP address:**
   ```bash
   # On Raspberry Pi
   hostname -I
   
   # Or from your router's admin panel
   ```

---

## Summary

You now have **three ways** to manage your print server remotely:

1. **Supabase Commands** (easiest, no SSH needed)
2. **SSH Aliases** (traditional, reliable)
3. **API Endpoints** (for automation)

**Recommended workflow:**
- Use Supabase commands for quick updates
- Use SSH for troubleshooting and log viewing
- Build UI controls for non-technical users

No more unplugging and moving the Raspberry Pi! 🎉
