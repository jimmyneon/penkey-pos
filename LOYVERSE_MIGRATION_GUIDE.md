# Loyverse to Penkey POS Migration Guide

## 📊 Migration Overview

You're migrating **4,049 sales receipts** with **£33,758.50** in historical revenue from Loyverse to Penkey POS.

### Data Summary
- **Date Range**: August 2023 - May 2026
- **Total Receipts**: 4,084 (4,049 sales + 34 refunds)
- **Line Items**: 7,516 individual product sales
- **Unique Products**: 226 items
- **Revenue**: £33,758.50

### Payment Methods
- SumUp Card: 2,686 receipts
- Cash: 1,357 receipts
- Manual: 28 receipts
- Other: 12 receipts

### Top Selling Items
1. Latte - 952 units
2. Tea - 526 units
3. Cappuccino - 461 units
4. Americano - 452 units
5. Flat white - 409 units

---

## ✅ Pre-Migration Checklist

### 1. Items Already Imported ✓
You've already imported your product catalog from Loyverse. Verify all items exist:

```bash
# This was done via Items Hub UI with loyverse/export_items.csv
```

### 2. Clear Test Data
Before importing historical data, delete all test transactions:

```bash
# Run in Supabase SQL Editor
# File: delete_test_transactions.sql
```

This removes:
- All test receipts
- All test payments
- All test line items
- All test print jobs

### 3. Verify Environment
Make sure `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

---

## 🚀 Migration Steps

### Step 1: Preview the Import

Run the preview script to see what will be imported:

```bash
node preview-loyverse-import.js
```

This shows:
- Total receipts to import
- Date range
- Revenue totals
- Top items
- Payment method breakdown

### Step 2: Run the Import

**IMPORTANT**: This will import 4,049 receipts. It may take 10-20 minutes.

```bash
node import-loyverse-history.js
```

The script will:
1. Read `loyverse-data/receipts-2023-08-01-2026-05-20.csv`
2. Read `loyverse-data/receipts-by-item-2023-08-01-2026-05-20.csv`
3. Group line items by receipt
4. Create receipts in batches of 50
5. Create payment records
6. Create line items
7. Show progress every 100 receipts

### Step 3: Verify Import

After import completes, verify in Supabase:

```sql
-- Check receipt count
SELECT COUNT(*) FROM receipts;
-- Should show ~4,049

-- Check revenue total
SELECT SUM(total) FROM receipts WHERE status = 'completed';
-- Should show ~£33,758.50

-- Check date range
SELECT MIN(created_at), MAX(created_at) FROM receipts;
-- Should show Aug 2023 - May 2026

-- Check payment methods
SELECT payment_method, COUNT(*) 
FROM receipts 
GROUP BY payment_method;
-- Should show card and cash

-- Check line items
SELECT COUNT(*) FROM receipt_lines;
-- Should show ~7,516
```

---

## 🔧 How the Import Works

### Receipt Mapping

| Loyverse Field | Penkey Field | Notes |
|---------------|--------------|-------|
| Receipt number | receipt_number | Preserved exactly |
| Date | created_at | Converted to ISO timestamp |
| Gross sales | subtotal | Before discounts |
| Discounts | discount_total | Discount amount |
| Net sales | total | Final amount |
| Payment type | payment_method | "Sumup" → "card", others → "cash" |
| Cashier name | member_id | Mapped to org_members |
| Status | status | "Closed" → "completed" |

### Line Item Mapping

| Loyverse Field | Penkey Field | Notes |
|---------------|--------------|-------|
| Item | name | Item name |
| Item | item_id | Looked up from items table |
| Quantity | quantity | Absolute value (positive) |
| Net sales / Quantity | unit_price | Calculated |
| Net sales | line_total | Total for line |
| Modifiers applied | modifiers | JSON array |

### What Gets Skipped

- **Refunds** (34 receipts) - Will handle separately
- **Non-closed receipts** - Only "Closed" status imported
- **Duplicate receipts** - Checked by receipt_number
- **Items not in catalog** - Warns but continues

---

## ⚠️ Important Notes

### 1. Item Names Must Match
The import looks up items by **exact name match**. If an item name in Loyverse doesn't match your Penkey catalog, it will be skipped with a warning.

**Example**:
- Loyverse: "Latte" ✓
- Penkey: "Latte" ✓ (matches)

If you see warnings like:
```
⚠️  Item not found: Latte (receipt 3-1234)
```

This means the item name doesn't exist in your items table. You may need to:
1. Check for typos
2. Import missing items
3. Re-run the import

### 2. Receipt Numbers Preserved
Original Loyverse receipt numbers (e.g., "3-1773") are preserved. This helps with:
- Reconciliation
- Customer inquiries
- Audit trails

### 3. Dates Preserved
All transaction dates are preserved from Loyverse. This means:
- Historical reports will be accurate
- Sales trends will be correct
- You can analyze past performance

### 4. Employee Assignment
All imported receipts are assigned to the **first active employee** in your org. You can manually update these later if needed:

```sql
-- Update employee for specific date range
UPDATE receipts 
SET member_id = 'specific_employee_id'
WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31';
```

### 5. Store Assignment
All imported receipts are assigned to your **first store**. If you have multiple stores, you'll need to update manually.

---

## 🐛 Troubleshooting

### Import Fails with "Missing Supabase credentials"
**Solution**: Check `.env.local` has both:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Import Fails with "Missing default employee or store"
**Solution**: Ensure you have:
- At least one active employee in `org_members`
- At least one store in `stores` table

### Many "Item not found" warnings
**Solution**: 
1. Export your current items: `node test-import.js`
2. Compare with Loyverse item names
3. Import missing items via Items Hub
4. Re-run the import (duplicates will be skipped)

### Import is very slow
**Expected**: Importing 4,049 receipts takes 10-20 minutes. The script processes in batches of 50 and shows progress every 100 receipts.

### Duplicate receipts
**Safe**: The script checks for existing receipt numbers and skips them. You can safely re-run the import.

---

## 📈 Post-Migration

### 1. Clear Browser Cache
After import, clear IndexedDB in your browser:
1. Open DevTools (F12)
2. Application > Storage > Clear site data
3. Or manually clear IndexedDB

### 2. Verify in POS
1. Log into Penkey POS
2. Check Reports section
3. Verify sales data appears
4. Check date ranges work correctly

### 3. Test Reports
Run these reports to verify data:
- Sales Summary (should show historical data)
- Sales by Item (should show top sellers)
- Sales by Employee (all under one employee initially)
- Daily Sales (check various dates)

### 4. Update Employee Assignments (Optional)
If you know which employee handled which receipts:

```sql
-- Example: Update receipts by date range
UPDATE receipts 
SET member_id = 'employee_uuid'
WHERE created_at BETWEEN '2024-01-01' AND '2024-03-31';
```

---

## 🔄 Handling Refunds

The import script **skips refunds** (34 receipts). To import refunds later:

1. Modify the script to handle refunds
2. Create refund records in `refunds` table
3. Link to original receipts
4. Update receipt status to "partially_refunded" or "refunded"

This is intentionally separate to avoid complexity during initial migration.

---

## 📞 Support

If you encounter issues:

1. **Check logs**: The import script shows detailed error messages
2. **Verify data**: Use the SQL queries above
3. **Re-run safely**: The script skips duplicates, so it's safe to re-run
4. **Partial import**: If it fails partway, it will continue from where it left off

---

## ✅ Success Criteria

After successful migration, you should have:

- ✅ ~4,049 receipts in database
- ✅ ~7,516 line items
- ✅ ~£33,758.50 total revenue
- ✅ Date range: Aug 2023 - May 2026
- ✅ Payment methods: Card and Cash
- ✅ All items linked correctly
- ✅ Reports showing historical data
- ✅ No test data remaining

---

## 🎉 You're Done!

Once the import completes successfully, you can:

1. **Stop using Loyverse** - All your data is now in Penkey POS
2. **Start fresh** - Begin taking new orders with clean data
3. **Analyze history** - Use reports to see trends from Loyverse data
4. **Train staff** - Show them the historical data is preserved

Your Loyverse data is now fully migrated to Penkey POS! 🚀
