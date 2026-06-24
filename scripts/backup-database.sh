#!/bin/bash
# Backup critical Supabase tables to CSV files
# Run this before any destructive database operations
# Usage: bash scripts/backup-database.sh

set -e

SB_URL="https://gxpdoceobcidgdejwpzf.supabase.co"
SB_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2)
BACKUP_DIR="backups/$(date +%Y-%m-%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

echo "Backing up to: $BACKUP_DIR"
echo ""

# Critical business tables — these are the ones that matter
TABLES=(
  "receipts"
  "receipt_lines"
  "items"
  "categories"
  "modifier_groups"
  "modifiers"
  "item_modifiers"
  "prices"
  "taxes"
  "discounts"
  "gift_vouchers"
  "voucher_redemptions"
  "printers"
  "org_members"
  "employee_pins"
  "roles"
  "orgs"
  "register_settings"
  "qr_codes"
  "qr_scans"
  "shifts"
  "upsell_analytics"
  "refunds"
  "payments"
  "tickets"
  "user_preferences"
)

for TABLE in "${TABLES[@]}"; do
  echo -n "  Exporting $TABLE... "
  
  # Get total count first
  COUNT=$(curl -sI "${SB_URL}/rest/v1/${TABLE}?select=id" \
    -H "apikey: ${SB_KEY}" -H "Authorization: Bearer ${SB_KEY}" \
    -H "Prefer: count=exact" -H "Range: 0-0" 2>&1 | grep -i content-range | sed 's/.*\///' | tr -d '\r')
  
  if [ -z "$COUNT" ] || [ "$COUNT" = "" ]; then
    echo "SKIP (table not found or empty)"
    continue
  fi
  
  # Export all rows (up to 100,000 per table — paginate if needed)
  OFFSET=0
  PAGE_SIZE=1000
  TOTAL_EXPORTED=0
  FIRST_PAGE=true
  
  while [ $OFFSET -lt $COUNT ]; do
    REMAINING=$((COUNT - OFFSET))
    if [ $REMAINING -lt $PAGE_SIZE ]; then
      PAGE_SIZE=$REMAINING
    fi
    
    END=$((OFFSET + PAGE_SIZE - 1))
    
    if [ "$FIRST_PAGE" = true ]; then
      # First page — create the file
      curl -s "${SB_URL}/rest/v1/${TABLE}?select=*" \
        -H "apikey: ${SB_KEY}" -H "Authorization: Bearer ${SB_KEY}" \
        -H "Range: ${OFFSET}-${END}" \
        -H "Accept: application/json" > "$BACKUP_DIR/${TABLE}.json"
      FIRST_PAGE=false
    else
      # Subsequent pages — append to array
      curl -s "${SB_URL}/rest/v1/${TABLE}?select=*" \
        -H "apikey: ${SB_KEY}" -H "Authorization: Bearer ${SB_KEY}" \
        -H "Range: ${OFFSET}-${END}" \
        -H "Accept: application/json" > "$BACKUP_DIR/${TABLE}_page_${OFFSET}.json"
    fi
    
    TOTAL_EXPORTED=$((TOTAL_EXPORTED + PAGE_SIZE))
    OFFSET=$((OFFSET + PAGE_SIZE))
  done
  
  echo "OK ($TOTAL_EXPORTED rows → ${TABLE}.json)"
done

echo ""
echo "Backup complete: $BACKUP_DIR"
echo "Files: $(ls -1 $BACKUP_DIR | wc -l | tr -d ' ')"
echo "Total size: $(du -sh $BACKUP_DIR | cut -f1)"
echo ""
echo "To restore from backup, use the Supabase SQL Editor or write an import script."
