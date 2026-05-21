#!/bin/bash
# Print server wrapper - handles updates and robust logging before main server starts

LOG_FILE="/home/jimmy/print-server/print.log"
CODE_DIR="/home/jimmy/penkey-pos/print-server"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "=== Print Server Starting ==="

# Step 1: Check for updates FIRST (can't be broken by updates)
log "[Update] Checking for updates from GitHub..."
cd /home/jimmy/penkey-pos

# Fetch latest
if git fetch origin main 2>> "$LOG_FILE"; then
    # Check if behind
    COMMITS_BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
    
    if [ "$COMMITS_BEHIND" -gt "0" ]; then
        log "[Update] Found $COMMITS_BEHIND new commit(s) - pulling updates..."
        
        if git pull origin main >> "$LOG_FILE" 2>&1; then
            log "[Update] Successfully pulled updates - restarting to apply..."
            # Restart systemd service (this will re-run this script)
            systemctl restart print-server
            exit 0
        else
            log "[Update] ERROR: Git pull failed - continuing with current version"
        fi
    else
        log "[Update] Already up to date"
    fi
else
    log "[Update] WARNING: Git fetch failed - continuing with current version"
fi

# Step 2: Start the main print server
log "[Server] Starting main print server..."
cd "$CODE_DIR"
python3 print_server.py >> "$LOG_FILE" 2>&1

log "[Server] Print server exited"
