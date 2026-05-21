# Automatic Deployment Setup

## Overview

Your print server now automatically deploys when you push code to GitHub! 🎉

**How it works:**
1. You push changes to `main` branch (print-server or print-adapters code)
2. GitHub Actions detects the changes
3. GitHub sends update command to Supabase
4. Raspberry Pi receives command via realtime subscription
5. Pi pulls latest code from GitHub and restarts
6. All logs are sent to Supabase for remote viewing

---

## One-Time Setup

### 1. Run the Migration

First, create the `printer_logs` table in Supabase:

```bash
# Copy the SQL from migrations/create_printer_logs_table.sql
# Run it in Supabase SQL Editor
```

Or via command line:
```bash
psql $DATABASE_URL < migrations/create_printer_logs_table.sql
```

### 2. Set Up GitHub Actions (Optional but Recommended)

The workflow file is at `deploy-print-server-workflow.yml`. To enable it:

1. **Create a Personal Access Token with workflow scope:**
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with `workflow` scope
   - Copy the token

2. **Update your git remote to use the token:**
   ```bash
   git remote set-url origin https://YOUR_TOKEN@github.com/jimmyneon/penkey-pos.git
   ```

3. **Move the workflow file to the correct location:**
   ```bash
   mkdir -p .github/workflows
   mv deploy-print-server-workflow.yml .github/workflows/deploy-print-server.yml
   git add .github/workflows/deploy-print-server.yml
   git commit -m "Add GitHub Actions workflow"
   git push origin main
   ```

4. **Add GitHub Secrets:**
   - Go to your repo → Settings → Secrets and variables → Actions
   - Add these secrets:

| Secret Name | Value | Where to find it |
|------------|-------|------------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (secret) | Supabase Dashboard → Settings → API |
| `PRINTER_ID` | Your printer's UUID | Query: `SELECT id FROM printers WHERE name = 'Main Printer'` |

**Alternative:** If you don't want to use GitHub Actions, you can still use the Supabase command method (see Manual Deployment section).

### 3. Update Raspberry Pi (One Last Time!)

SSH into your Raspberry Pi and pull the latest code:

```bash
ssh jimmy@<pi-ip-address>

# Pull latest code
cd /home/jimmy/penkey-pos
git pull origin main

# Restart print server
sudo systemctl restart print-server

# Check it's running
sudo systemctl status print-server

# Watch logs to confirm Supabase logging is working
tail -f /home/jimmy/print-server/print.log
```

You should see:
```
[Logging] Supabase log handler initialized - logs will be sent to database
[Logging] Started periodic log flush task
```

### 4. Test the Setup

**Test automatic deployment:**

1. Make a small change to the print server:
   ```bash
   # On your Mac
   echo "# Test deployment" >> print-server/README.md
   git add -A
   git commit -m "Test auto-deployment"
   git push origin main
   ```

2. Watch GitHub Actions:
   - Go to your repo → Actions tab
   - You should see "Deploy Print Server to Raspberry Pi" running

3. Check the Pi (optional):
   ```bash
   ssh jimmy@<pi-ip> 'tail -f /home/jimmy/print-server/print.log'
   ```

4. Verify in Supabase:
   ```sql
   SELECT * FROM printer_logs 
   WHERE printer_id = 'your-printer-id'
   ORDER BY timestamp DESC 
   LIMIT 20;
   ```

---

## Usage

### Viewing Logs Remotely

**Via Supabase SQL Editor:**
```sql
-- Recent logs
SELECT timestamp, level, message 
FROM printer_logs 
WHERE printer_id = 'your-printer-id'
ORDER BY timestamp DESC 
LIMIT 100;

-- Errors only
SELECT timestamp, message, context 
FROM printer_logs 
WHERE printer_id = 'your-printer-id'
  AND level = 'ERROR'
ORDER BY timestamp DESC;

-- Search for specific text
SELECT timestamp, level, message 
FROM printer_logs 
WHERE printer_id = 'your-printer-id'
  AND message ILIKE '%receipt%'
ORDER BY timestamp DESC;
```

**Via API:**
```bash
# Get recent logs
curl "https://your-app.com/api/printers/{printer-id}/logs?limit=50"

# Get errors only
curl "https://your-app.com/api/printers/{printer-id}/logs?level=ERROR"

# Search logs
curl "https://your-app.com/api/printers/{printer-id}/logs?search=receipt"

# Get logs since timestamp
curl "https://your-app.com/api/printers/{printer-id}/logs?since=2026-05-21T10:00:00Z"
```

### Manual Deployment

If you need to deploy without pushing code:

**Option 1 - GitHub Actions:**
- Go to Actions → Deploy Print Server → Run workflow

**Option 2 - Supabase:**
```sql
UPDATE printers 
SET config = '{"command": "update"}'::jsonb
WHERE id = 'your-printer-id';
```

**Option 3 - API:**
```bash
curl -X POST https://your-app.com/api/printers/{id}/command \
  -H "Content-Type: application/json" \
  -d '{"command": "update"}'
```

### Cleaning Up Old Logs

Logs older than 30 days are automatically deleted. To manually clean up:

```sql
-- Delete logs older than 7 days
DELETE FROM printer_logs 
WHERE timestamp < NOW() - INTERVAL '7 days';

-- Or via API
curl -X DELETE "https://your-app.com/api/printers/{id}/logs?before=2026-05-14T00:00:00Z"
```

---

## Workflow

### Normal Development Flow

```bash
# 1. Make changes on your Mac
vim print-server/printer.py

# 2. Commit and push
git add -A
git commit -m "Fix receipt printing issue"
git push origin main

# 3. GitHub Actions automatically deploys to Pi
# (takes ~30-60 seconds)

# 4. Check logs in Supabase to verify
# No need to touch the Raspberry Pi!
```

### Troubleshooting

**Deployment failed?**

Check GitHub Actions logs:
- Repo → Actions → Click on failed run
- Look for error messages

**Printer not updating?**

1. Check printer is online:
   ```sql
   SELECT status, last_seen_at FROM printers WHERE id = 'your-printer-id';
   ```

2. Check print server logs:
   ```sql
   SELECT * FROM printer_logs 
   WHERE printer_id = 'your-printer-id'
   ORDER BY timestamp DESC LIMIT 20;
   ```

3. Manually restart if needed:
   ```bash
   ssh jimmy@<pi-ip> 'sudo systemctl restart print-server'
   ```

**Logs not appearing in Supabase?**

1. Check print server is running:
   ```bash
   ssh jimmy@<pi-ip> 'sudo systemctl status print-server'
   ```

2. Check local logs for errors:
   ```bash
   ssh jimmy@<pi-ip> 'tail -n 50 /home/jimmy/print-server/print.log'
   ```

3. Verify Supabase credentials in .env:
   ```bash
   ssh jimmy@<pi-ip> 'cat /home/jimmy/penkey-pos/print-server/.env'
   ```

---

## Architecture

```
┌─────────────┐
│   Your Mac  │
│             │
│  git push   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ GitHub Actions  │
│                 │
│ 1. Detect push  │
│ 2. Send command │
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│    Supabase      │
│                  │
│ • printers table │
│ • printer_logs   │
│ • Realtime       │
└────────┬─────────┘
         │
         │ Realtime subscription
         ▼
┌──────────────────┐
│  Raspberry Pi    │
│                  │
│ 1. Receive cmd   │
│ 2. git pull      │
│ 3. Restart       │
│ 4. Send logs     │
└──────────────────┘
```

**Log Flow:**
```
Print Server → Batched (10 logs or 5s) → Supabase → API → Your Browser
     │
     └─→ Local file (backup)
```

---

## Benefits

✅ **No more physical access needed** - Deploy from anywhere  
✅ **Automatic deployment** - Push code, it deploys automatically  
✅ **Remote logging** - View all logs in Supabase  
✅ **Searchable logs** - Query by level, time, content  
✅ **Audit trail** - See who deployed what and when  
✅ **Rollback capability** - Can revert to previous commits  
✅ **Zero downtime** - Systemd auto-restarts the service  

---

## Next Steps

### Build a Log Viewer UI (Future)

Create a page at `/settings/printers/[id]/logs` with:
- Real-time log streaming (via Supabase realtime)
- Filter by level (ERROR, WARNING, INFO)
- Search functionality
- Download logs as file
- Auto-refresh

### Add Deployment Notifications (Future)

Send notifications when deployment completes:
- Email
- Slack
- Discord
- In-app notification

### Health Monitoring (Future)

Track printer health metrics:
- Uptime
- Print success rate
- Error frequency
- Memory/disk usage

---

## Security Notes

- GitHub secrets are encrypted and never exposed in logs
- Service role key has full database access - keep it secret
- Logs are protected by RLS - users can only see their org's logs
- Old logs are auto-deleted after 30 days to save space

---

## Summary

**Before:** Unplug Pi → Connect to monitor → Pull code → Restart → Plug back in  
**After:** `git push` → Done! ✨

You'll never need to physically access the Raspberry Pi again for code updates!
