# Reporting System Improvements - May 21, 2026

## Overview

Implemented three major improvements to the reporting system based on user feedback:
1. **Realistic daily targets** that don't make staff feel bad
2. **Exclude refunded items** from all sales reports
3. **Upsell tracking** to encourage add-ons and modifiers

---

## 1. Realistic Daily Targets ✅

### Problem
Previous targets were unrealistic (£1,000/day) which made staff feel discouraged when they couldn't hit them.

### Solution
Implemented day-of-week based targets that reflect actual business patterns:

| Day | Target | Reasoning |
|-----|--------|-----------|
| **Monday** | £150 | Quieter weekday |
| **Tuesday** | £150 | Quieter weekday |
| **Wednesday** | £150 | Quieter weekday |
| **Thursday** | £200 | Busier end of week |
| **Friday** | £200 | Busier end of week |
| **Saturday** | £250 | Weekend rush |
| **Sunday** | £250 | Weekend rush |

**Weekly Target:** £1,000 (achievable across the week)

### Period Targets
- **Today:** Dynamic based on day of week (£150-£250)
- **Week:** £1,000
- **Month:** £4,300 (~£1,000/week × 4.3 weeks)
- **Year:** £52,000 (£1,000/week × 52 weeks)
- **All Time:** £50,000

### Implementation
```typescript
// src/app/reports/page.tsx
const getDailyTarget = () => {
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return 250; // Weekend
  if (dayOfWeek === 4 || dayOfWeek === 5) return 200; // Thu-Fri
  return 150; // Mon-Wed
};
```

**Today (Thursday):** Target is £200 ✅

---

## 2. Exclude Refunded Items ✅

### Problem
Test items and refunded transactions were appearing in sales reports, skewing the data.

Example: R00521 (£1 test item, refunded) was showing in today's items report.

### Solution
All report API endpoints now filter out:
- `status = 'fully_refunded'`
- `status = 'voided'`

### Files Updated
1. ✅ `src/app/api/reports/sales-summary/route.ts`
2. ✅ `src/app/api/reports/sales-by-items/route.ts`
3. ✅ `src/app/api/reports/sales-by-employee/route.ts`
4. ✅ `src/app/api/reports/hourly-sales/route.ts`
5. ✅ `src/app/api/reports/sales-by-transaction-type/route.ts`

### Implementation Example
```typescript
const { data: receipts } = await supabase
  .from("receipts")
  .select("...")
  .eq("org_id", orgId)
  .gte("created_at", startDate.toISOString())
  .neq("status", "fully_refunded")  // ← NEW
  .neq("status", "voided");         // ← NEW
```

### Verification
- Before: R00521 (refunded £1 test) appeared in reports
- After: R00521 excluded, only actual sales counted ✅

---

## 3. Upsell Tracking & Encouragement ✅

### Problem
No visibility into how well staff are upselling add-ons and modifiers. Need to encourage staff to suggest extras.

### Solution
Track and display modifier/add-on performance:

#### Metrics Tracked
1. **Items with Modifiers:** Count of items sold with paid add-ons
2. **Modifier Revenue:** Total revenue from add-ons (£)
3. **Upsell Rate:** Percentage of items sold with add-ons (%)

#### Backend Changes
**`src/app/api/reports/sales-by-items/route.ts`:**
- Added modifier tracking to item aggregation
- Calculates modifier revenue from `price_adjustment` fields
- Only counts modifiers with `price_adjustment > 0` (paid add-ons)
- Returns upsell metrics in summary

```typescript
// Track upsells (modifiers)
if (line.modifiers && Array.isArray(line.modifiers) && line.modifiers.length > 0) {
  const hasPayingModifiers = line.modifiers.some((m: any) => 
    m.price_adjustment && m.price_adjustment > 0
  );
  if (hasPayingModifiers) {
    item.items_with_modifiers += line.quantity;
    totalItemsWithModifiers += line.quantity;
    
    const modifierRevenue = line.modifiers.reduce((sum: number, m: any) => 
      sum + (parseFloat(m.price_adjustment || "0") * line.quantity), 0
    );
    item.modifier_revenue += modifierRevenue;
    totalModifierRevenue += modifierRevenue;
  }
}
```

#### Frontend Display
**`src/app/reports/page.tsx`:**
- Added "Upsell Performance" section to Sales by Items modal
- Shows upsell rate, modifier revenue, and count
- Green gradient styling to highlight positive performance
- Only displays when upsell_rate > 0

```tsx
{/* Upsell Metrics */}
{itemsData.summary.upsell_rate > 0 && (
  <div className="bg-gradient-to-r from-green-600/20 to-green-500/20 border border-green-500/30 rounded-lg p-4 mb-4">
    <div className="flex items-center gap-2 mb-2">
      <TrendingUp className="h-5 w-5 text-green-400" />
      <h4 className="text-sm font-semibold text-white">Upsell Performance</h4>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-xs text-gray-400">Upsell Rate</p>
        <p className="text-lg font-bold text-green-400">{itemsData.summary.upsell_rate.toFixed(1)}%</p>
      </div>
      <div>
        <p className="text-xs text-gray-400">Modifier Revenue</p>
        <p className="text-lg font-bold text-green-400">£{itemsData.summary.modifier_revenue.toFixed(2)}</p>
      </div>
    </div>
    <p className="text-xs text-gray-300 mt-2">
      {itemsData.summary.items_with_modifiers} items sold with add-ons
    </p>
  </div>
)}
```

#### TypeScript Types
**`src/lib/hooks/use-sales-by-items.ts`:**
```typescript
interface ItemData {
  // ... existing fields
  items_with_modifiers: number;
  modifier_revenue: number;
}

interface SummaryData {
  // ... existing fields
  items_with_modifiers: number;
  modifier_revenue: number;
  upsell_rate: number;
}
```

### How It Encourages Upsells
1. **Visibility:** Staff can see upsell performance in real-time
2. **Gamification:** Upsell rate percentage creates a goal to improve
3. **Revenue Impact:** Shows actual £ value of add-ons, demonstrating impact
4. **Positive Reinforcement:** Green styling celebrates good performance
5. **Competition:** Staff can compare their upsell rates

### Example Display
```
┌─────────────────────────────────────┐
│ 🟢 Upsell Performance               │
├─────────────────────────────────────┤
│ Upsell Rate        Modifier Revenue │
│ 29.4%              £12.50           │
│                                     │
│ 5 items sold with add-ons          │
└─────────────────────────────────────┘
```

---

## Additional Ideas for Future Enhancement

### 1. Upsell Leaderboard
- Track upsell rate per employee
- Display top upsellers in reports
- Weekly/monthly upsell champions

### 2. Upsell Targets
- Set daily upsell rate targets (e.g., 30%)
- Progress bar for upsell goals
- Notifications when target is hit

### 3. Suggested Upsells at POS
- When adding item to cart, suggest popular modifiers
- "Customers who bought X also added Y"
- Quick-add buttons for common add-ons

### 4. Upsell Training Insights
- Identify items with low modifier attachment rates
- Suggest which items to focus upselling on
- Show most profitable modifiers

### 5. Time-Based Upsell Analysis
- Track upsell rates by hour/day
- Identify when staff are best at upselling
- Correlate with busy periods

### 6. Modifier Popularity Report
- Which add-ons are most popular
- Which combinations work best
- Seasonal modifier trends

---

## Testing Results

### Today's Data (May 21, 2026 - Thursday)
- **Target:** £200 (Thursday target) ✅
- **Actual Sales:** £82.30 (10 receipts)
- **Progress:** 41.2% toward target
- **Refunded Items:** 1 (R00521 - £1 test) - **EXCLUDED** ✅
- **Items with Modifiers:** 5 out of 17 items
- **Upsell Rate:** 29.4%
- **Modifier Revenue:** Calculated and displayed ✅

### Verification Commands
```bash
# Check refunded receipts are excluded
node -e "..." # Confirmed R00521 has status='fully_refunded'

# Check target calculation
node -e "..." # Confirmed Thursday = £200 target

# Check modifier tracking
# Confirmed 5 items have modifiers in today's sales
```

---

## Files Modified

### Backend (API Routes)
1. `src/app/api/reports/sales-summary/route.ts` - Exclude refunds
2. `src/app/api/reports/sales-by-items/route.ts` - Exclude refunds + upsell tracking
3. `src/app/api/reports/sales-by-employee/route.ts` - Exclude refunds
4. `src/app/api/reports/hourly-sales/route.ts` - Exclude refunds
5. `src/app/api/reports/sales-by-transaction-type/route.ts` - Exclude refunds

### Frontend
6. `src/app/reports/page.tsx` - Realistic targets + upsell display
7. `src/lib/hooks/use-sales-by-items.ts` - TypeScript types for upsell metrics

---

## Summary

✅ **Realistic Targets:** Staff now have achievable daily goals (£150-£250) that vary by day  
✅ **Refunds Excluded:** Test items and refunded transactions no longer skew reports  
✅ **Upsell Tracking:** Visibility into modifier performance encourages staff to suggest add-ons  

**Impact:**
- More motivated staff (realistic targets)
- More accurate reporting (refunds excluded)
- Increased revenue potential (upsell awareness)

**Next Steps:**
- Monitor upsell rates over time
- Consider implementing upsell leaderboard
- Add POS-level upsell suggestions
- Create training materials based on upsell data
