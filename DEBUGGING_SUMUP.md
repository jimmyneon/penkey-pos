# SumUp Payment Debugging Guide

## Recent Fixes

### 1. State Management Issue
**Problem:** The "missing payment information" error when clicking Check Status.

**Root Cause:** `checkoutId` and `readerId` were scoped inside the try block, making them inaccessible to error handlers.

**Fix:** 
- Moved variables to function scope
- Save to state immediately after checkout creation
- Re-save in error handlers to ensure state is set

### 2. Connection Timeout Issue
**Problem:** System saying "lost connection" even though payment is on the reader.

**Root Causes:**
1. Consecutive errors counter wasn't being reset on successful responses
2. Timeout was too short (90 seconds)
3. Error threshold was too aggressive (5 errors)

**Fixes:**
- Reset `consecutiveErrors = 0` on every successful status check
- Increased timeout to 3 minutes (90 attempts)
- Increased error threshold to 10 consecutive errors (20 seconds)

## Logging Added

### When Payment Starts
```
[Payment] Using reader: <reader_id> <reader_name>
[Payment] Checkout created: <checkout_id>
```

### During Polling
```
[Payment] Polling attempt X/90 for checkout: <checkout_id>
[Payment] Checkout status: <status> Attempt: X
```

### On Connection Loss
```
[Payment] Connection lost - checkoutId: <id> readerId: <id>
[Payment] Pending state before dialog: { pendingCheckoutId, pendingReaderId }
```

### When Check Status Clicked
```
[Payment] Retry button clicked
[Payment] Current state - checkoutId: <id> readerId: <id>
[Payment] Retrying status check for checkout: <id> reader: <id>
[Payment] Fetching: /api/sumup/checkout-status?checkoutId=<id>&reader_id=<id>
[Payment] Retry check - Status: <status>
```

## How to Debug

### 1. Check Browser Console

When the connection lost dialog appears, check the console for:

```javascript
// Should see these logs:
[Payment] Connection lost - checkoutId: <some-id> readerId: <some-id>
[Payment] Pending state before dialog: { pendingCheckoutId: '<id>', pendingReaderId: '<id>' }
```

If you see `null` values, the state wasn't saved properly.

### 2. Click Check Status Button

Watch the console for:

```javascript
[Payment] Retry button clicked
[Payment] Current state - checkoutId: <id> readerId: <id>
```

If either is `null`, that's the problem.

### 3. Check Server Logs

Look for:

```
[SumUp Checkout Status] Status: <status>
[SumUp Checkout Status] Full response: { ... }
```

This shows what SumUp API is actually returning.

## Common Issues

### Issue: "Missing payment information"
**Check:**
1. Browser console for state values when retry button clicked
2. If `pendingCheckoutId` or `pendingReaderId` is null, the state wasn't saved

**Possible Causes:**
- React state update timing issue
- Component re-render clearing state
- State update batching

**Solution:**
- State is now saved immediately after checkout creation
- State is re-saved in error handlers
- Added validation logging

### Issue: Connection lost too quickly
**Check:**
1. Count how many polling attempts happened before failure
2. Look for `consecutiveErrors` in logs

**Expected Behavior:**
- Should poll for up to 90 attempts (3 minutes)
- Should only fail after 10 consecutive errors
- Errors should reset to 0 on successful response

### Issue: Payment on reader but app says failed
**Check:**
1. What status is SumUp API returning?
2. Is polling continuing or stopping early?

**Possible Causes:**
- Polling stopped before payment completed
- Status not being recognized
- Network issues preventing status check

## Testing Checklist

1. **Normal Payment Flow**
   - [ ] Start payment
   - [ ] Wait 5-10 seconds before tapping card
   - [ ] Complete payment
   - [ ] Receipt created successfully

2. **Slow User**
   - [ ] Start payment
   - [ ] Wait 30 seconds before tapping card
   - [ ] Complete payment
   - [ ] Should not timeout

3. **Connection Loss**
   - [ ] Start payment
   - [ ] Disconnect WiFi/network
   - [ ] Connection lost dialog appears
   - [ ] Reconnect network
   - [ ] Click Check Status
   - [ ] Should retrieve payment status

4. **Timeout**
   - [ ] Start payment
   - [ ] Don't tap card for 3+ minutes
   - [ ] Should timeout with dialog
   - [ ] Tap card on reader
   - [ ] Click Check Status
   - [ ] Should complete payment

## SumUp API Endpoints

### Create Checkout
```
POST /v0.1/merchants/{merchant_code}/readers/{reader_id}/checkout
```

### Check Status
```
GET /v0.1/merchants/{merchant_code}/readers/{reader_id}/checkout/{checkout_id}
```

### Possible Status Values
- `PENDING` - Payment initiated, waiting for card
- `PAID` - Payment successful
- `SUCCESSFUL` - Payment successful (alternative)
- `FAILED` - Payment failed
- `CANCELLED` - User cancelled
- `DECLINED` - Card declined
- `EXPIRED` - Checkout expired

## Next Steps if Still Failing

1. **Check State Persistence**
   - Add `console.log` in `setPendingCheckoutId` and `setPendingReaderId`
   - Verify state updates are actually happening

2. **Check Component Re-renders**
   - Add `useEffect` to log when `pendingCheckoutId` changes
   - See if something is clearing the state

3. **Check SumUp API Response**
   - Add more detailed logging in `/api/sumup/checkout-status`
   - Verify the endpoint is being called with correct parameters

4. **Test with Longer Delays**
   - Increase timeout to 5 minutes
   - See if issue is purely timing-related

5. **Check Network Tab**
   - Open browser DevTools Network tab
   - Filter for "checkout-status"
   - See what requests are being made and what responses are returned
