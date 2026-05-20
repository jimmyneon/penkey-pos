# Trial Setup Guide

## ✅ Import/Export Functionality

Your POS system has **full Loyverse CSV import capability** implemented and ready to use.

### How to Import from Loyverse

1. **Export from Loyverse**
   - Go to Loyverse Backoffice
   - Navigate to Items > Export
   - Download the CSV file

2. **Import to Penkey POS**
   - Go to Items Hub in your POS
   - Click "Import" button
   - Select the Loyverse CSV file
   - Preview shows duplicate detection (yellow badges for existing items)
   - Click "Import" to proceed

### Import Features

✅ **Automatic Format Detection** - Detects Loyverse vs Penkey format  
✅ **Duplicate Handling** - Updates existing items instead of creating duplicates  
✅ **Reactivation** - Reactivates soft-deleted items automatically  
✅ **Full Data Sync** - Automatically syncs IndexedDB after import  
✅ **Modifier Support** - Converts Add-ons to modifier options correctly  
✅ **Progress Tracking** - Shows real-time import progress  

### What Gets Imported

- **Categories** - Product categories with colors
- **Items** - Products with prices, SKUs, descriptions
- **Modifiers** - Add-ons become modifier options
- **Modifier Groups** - Created from "Modifier - " columns
- **Item Links** - Automatically links items to their modifier groups

### Export Functionality

- Click "Export" in Items Hub to download current catalog as CSV
- Compatible with both Loyverse and Penkey formats
- Includes all items, categories, modifiers, and relationships

---

## 🗑️ Clearing Test Data

Before going live, you need to **delete all test transactions**.

### Quick Start

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Open `delete_test_transactions.sql`
4. Review the script
5. Click "Run" to execute

### What Gets Deleted

✅ All receipts (transactions)  
✅ All receipt items (line items)  
✅ All refunds  
✅ All receipt-related print jobs  
✅ All active carts (saved tickets)  

### What Gets Preserved

✅ Items, categories, modifiers (product catalog)  
✅ Employees, users, roles  
✅ Organization settings  
✅ Printer configurations  
✅ Register/terminal settings  

### After Deletion

1. **Clear Browser Cache**
   - Open DevTools (F12)
   - Application > Storage > Clear site data
   - Or manually clear IndexedDB

2. **Log Out & Back In**
   - Ensures fresh session
   - Resyncs local database

3. **Verify**
   - Check that no old transactions appear
   - Test creating a new transaction
   - Verify receipt numbering starts fresh

---

## 📝 Trial Checklist

### Pre-Trial Setup

- [ ] Import product catalog from Loyverse
- [ ] Verify all items imported correctly
- [ ] Check categories and modifiers
- [ ] Configure printer settings
- [ ] Test receipt printing
- [ ] Delete all test transactions
- [ ] Clear browser cache/IndexedDB
- [ ] Create employee PINs
- [ ] Set up payment methods (SumUp, cash, etc.)

### During Trial

- [ ] Note any UI glitches
- [ ] Track any calculation errors
- [ ] Document printer issues
- [ ] Record sync problems
- [ ] Test offline functionality
- [ ] Verify receipt accuracy
- [ ] Check refund process
- [ ] Test shift close procedures

### Post-Trial Review

- [ ] Review all noted issues
- [ ] Prioritize bug fixes
- [ ] Test fixes in staging
- [ ] Document any workarounds
- [ ] Update training materials

---

## 🐛 Known Issues to Watch For

Based on the system memories, here are areas to pay attention to:

### Receipt Printing
- Verify £ symbol prints correctly (should use CP858 encoding)
- Check receipt width (42 chars for 80mm paper)
- Ensure all receipt fields populate (store info, totals, etc.)

### Offline Sync
- Monitor OutboxSyncService for duplicate prevention
- Check that receipts sync properly when back online
- Verify IndexedDB contains all necessary fields for printing

### Payments
- SumUp Cloud API polling (different endpoints for v0.1 vs v2.1)
- Transaction status checking after card payment
- Proper termination of card reader sessions

### Data Import
- Modifier groups created correctly from Loyverse Add-ons
- Items only added to their designated modifier groups
- Inactive items reactivated on re-import

---

## 🆘 Quick Troubleshooting

### Import Issues
- **Duplicates created**: Should auto-update, check logs
- **Modifiers missing**: Verify "Modifier - " columns in CSV
- **Items not appearing**: Check is_active status in database

### Transaction Issues
- **Duplicate receipts**: Check OutboxSyncService, don't manually sync
- **Missing receipt data**: Verify IndexedDB has all required fields
- **Print failures**: Check printer status, code page settings

### Sync Issues
- **Data not syncing**: Clear IndexedDB, log out/in
- **Offline mode stuck**: Check network, verify OutboxSyncService
- **Stale data**: Force resync via prefetchOrgData()

---

## 📞 Support

For issues during trial:
1. Note the exact steps to reproduce
2. Check browser console for errors
3. Document any error messages
4. Note the time/date of occurrence
5. Take screenshots if helpful

Keep this document updated with any new findings during the trial period.
