# CRITICAL BUG FIX - Reports Showing Wrong Day's Data

**Date Fixed**: May 21, 2026  
**Severity**: 🔴 **CRITICAL**  
**Status**: ✅ **FIXED**

## The Problem

**All reports were showing the WRONG day's data!**

When you selected "Today" in reports, it was actually showing **yesterday's** sales. When you selected "Week", it was showing 8 days ago to yesterday, missing today entirely.

### User Impact
- "Today" showed £0 when you actually had £82.30 in sales
- Item counts were wrong
- All period selections were off by 1 day
- Historical comparisons were comparing wrong periods

## Root Cause

All report API endpoints had the same date calculation bug:

```typescript
// ❌ WRONG (old code)
const startDate = new Date();
startDate.setDate(startDate.getDate() - days);  // days=1 goes back 1 day = YESTERDAY!
```

When `days=1` (Today), this calculated:
- `getDate() - 1` = **yesterday at midnight**
- So "Today" fetched receipts from yesterday onwards

## The Fix

```typescript
// ✅ CORRECT (new code)
const startDate = new Date();
startDate.setDate(startDate.getDate() - (days - 1));  // days=1 goes back 0 days = TODAY!
```

Now when `days=1` (Today):
- `getDate() - (1 - 1)` = `getDate() - 0` = **today at midnight**
- "Today" correctly fetches receipts from today onwards

### Logic Explanation
- **days=1** (Today) → go back **0 days** → today at midnight ✅
- **days=7** (Week) → go back **6 days** → 6 days ago + today = 7 days total ✅
- **days=30** (Month) → go back **29 days** → 29 days ago + today = 30 days total ✅
- **days=365** (Year) → go back **364 days** → 364 days ago + today = 365 days total ✅

## Files Fixed

All report API endpoints were updated:

1. ✅ `src/app/api/reports/sales-summary/route.ts`
2. ✅ `src/app/api/reports/sales-by-items/route.ts`
3. ✅ `src/app/api/reports/sales-by-employee/route.ts`
4. ✅ `src/app/api/reports/hourly-sales/route.ts`
5. ✅ `src/app/api/reports/sales-by-transaction-type/route.ts`

## Verification

**Before Fix:**
```
Today's report: £0 (showing yesterday's data when yesterday had no sales)
Actual today's receipts in database: £82.30 (10 receipts)
```

**After Fix:**
```
Today's report: £82.30 ✅
Matches database: £82.30 ✅
```

**Today's Actual Sales (May 21, 2026):**
- R00521: £1.00 - Test
- R00522: £7.20 - 2x Cappuccino 7oz
- R00523: £3.00 - Breakfast Tea
- R00524: £27.00 - Mixed order (Cappuccino, Latte, Bacon Bap)
- R00525: £9.00 - Sausage Bap + Tea
- R00526: £3.00 - Decaf Tea
- R00527: £3.00 - Americano
- R00528: £9.50 - Ham Toastie + Tea
- R00529: £11.40 - 2x Iced Latte + Americano
- R00530: £8.20 - Iced Latte + Milkshake

**Total: £82.30** (10 receipts) - Now showing correctly! ✅

## Impact on Historical Data

This bug also affected:
- **Week view** - was missing today, showing 8 days ago to yesterday
- **Month view** - was missing today, showing 31 days ago to yesterday
- **Year view** - was missing today, showing 366 days ago to yesterday
- **All Time view** - was missing today (though less noticeable with 3 years of data)

All period views now correctly include today's data.

## Testing Performed

- [x] Verified date calculation logic with test script
- [x] Checked today's receipts in database (£82.30)
- [x] Confirmed all 10 receipts from today are now visible
- [x] Verified line items match receipt totals
- [x] Tested all period selections (Today, Week, Month, Year, All Time)
- [x] Changes committed and pushed to GitHub

## Lessons Learned

When calculating date ranges:
- **Inclusive ranges**: For "last N days", subtract `(N - 1)` to include today
- **Exclusive ranges**: For "N days ago", subtract `N` to exclude today
- Always test with actual data to verify date calculations
- Off-by-one errors in dates are easy to miss but have major impact

## Related Issues

This fix resolves the user's concern: *"The items and the amount doesn't, don't seem to be right... if I look at the receipts and stuff, it doesn't add up to the same amount I'm seeing in reporting for today."*

The reports were correct for the data they were fetching - they were just fetching the **wrong day's data**!
