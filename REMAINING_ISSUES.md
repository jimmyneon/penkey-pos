# Remaining Issues to Address

## Fixed in This Commit:
1. ✅ **É encoding** - Changed all DÉLICAF to DELICAF in code
2. ✅ **Receipt Templates UI** - Fixed API to use print_templates table
3. ✅ **Idempotency keys** - Now properly saved for duplicate prevention

## Still Need to Address:

### 1. Dining Option Not Showing on Receipt
**Issue:** When you change from "Takeaway" to "Eat In" in settings, it doesn't update on the receipt.

**Root Cause:** The dining_option is set when creating the receipt based on ticket assignment, NOT from a global setting. It's determined by:
- If assigned to a table → "eat-in"
- If assigned to a customer → "takeaway"
- Default → "takeaway"

**Location:** `src/app/payment/page.tsx` lines ~1220 and ~360

**Question:** Do you want a global setting to override this? Or should it always be based on table/customer assignment?

### 2. Item Quantities - "1x" vs "2x"
**Issue:** When you add 2 lattes, it shows "1x Latte" twice instead of "2x Latte"

**Root Cause:** The cart system creates separate line items for each click instead of incrementing quantity.

**Question:** How should modifiers work?
- Option A: "2x Latte" groups identical items, but "1x Latte + Extra Shot" and "1x Latte" are separate
- Option B: Always separate lines (current behavior)

**Location:** Cart store at `src/lib/store/cart-store.ts`

### 3. Receipt Template Settings
**Status:** Should now work after this deployment
- API now uses print_templates table
- Can create/edit/delete templates
- Templates are applied to receipts

## Testing Checklist After Deployment:

- [ ] Receipt shows "PENKEY DELICAF" (no question mark)
- [ ] Settings → Receipt Templates loads without error
- [ ] Can edit template and see changes on next receipt
- [ ] No duplicate receipts created
- [ ] Idempotency keys are saved (check database)
- [ ] Order number shows when receipt syncs
- [ ] Transaction ID only shows for card payments (not temp_ IDs)
