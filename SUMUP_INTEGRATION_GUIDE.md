# SumUp Cloud API Integration Guide

## Overview

This integration enables SumUp Solo terminal payments using the Cloud API in your Next.js POS system.

## Environment Variables

The following environment variables are now configured:

```env
# SUMUP CLOUD API VARIABLES:
SUMUP_API_KEY=sup_pk_0PwvVddKZ5avKKWoZFAfJhc46PwQkyCi8
SUMUP_AFFILIATE_KEY=sup_afk_yWdogkB7dlcBlXw0rl4mmrMIeaicEjkP
SUMUP_MERCHANT_CODE=MD7HX9SL
SUMUP_API_BASE=https://api.sumup.com
```

## Database Schema

A new `terminals` table has been created to store paired SumUp readers:

```sql
CREATE TABLE terminals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  reader_id TEXT NOT NULL UNIQUE,
  location TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'pairing')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Routes Created

### 1. Pair Reader
- **POST** `/api/sumup/pair-reader`
- Body: `{ pairingCode: string, name: string }`
- Response: `{ success: true, terminal: Terminal }`

### 2. Create Checkout
- **POST** `/api/sumup/create-checkout`
- Body: `{ amount: number, currency: string, reader_id: string, description: string }`
- Response: `{ success: true, checkout_id: string }`

### 3. Check Payment Status
- **GET** `/api/sumup/checkout-status?checkoutId=...`
- Response: `{ success: true, checkout: CheckoutData, status: string }`

### 4. Manage Terminals
- **GET** `/api/sumup/terminals` - List all terminals
- **DELETE** `/api/sumup/terminals?id=...` - Delete terminal

## UI Components

### 1. Payment Terminals Settings Page
- **URL**: `/settings/payment-terminals`
- Features: List terminals, add new terminals, delete terminals
- Includes pairing flow with helpful instructions

### 2. SumUp Payment Flow Component
- **Component**: `SumUpPaymentFlow`
- Props: `{ amount, currency?, description?, onPaymentComplete? }`
- Features: Terminal selection, payment processing, status polling

### 3. Payment Hook
- **Hook**: `useSumUpPayment`
- Functions: `createCheckout`, `checkPaymentStatus`, `pollPaymentStatus`

## Integration Steps

### 1. Pair Your First Terminal

1. Go to `/settings/payment-terminals`
2. Click "Add Terminal"
3. On your SumUp Solo device: Settings → Connections → API → Connect
4. Enter the 6-digit pairing code within 5 minutes
5. Give your terminal a descriptive name

### 2. Integrate Payment Flow

In your payment page/modal:

```tsx
import { SumUpPaymentFlow } from '@/components/SumUpPaymentFlow';

function PaymentModal({ totalAmount, onPaymentSuccess }) {
  return (
    <SumUpPaymentFlow
      amount={totalAmount}
      currency="GBP"
      description="POS Payment"
      onPaymentComplete={(success, checkoutId) => {
        if (success) {
          onPaymentSuccess(checkoutId);
        }
      }}
    />
  );
}
```

### 3. Update POS Payment Flow

Replace or enhance your existing cash payment flow:

```tsx
// In your sell page or payment modal
const [showCardPayment, setShowCardPayment] = useState(false);

// When customer wants to pay by card
const handleCardPayment = () => {
  setShowCardPayment(true);
};

// Payment completion handler
const handlePaymentComplete = (success: boolean, checkoutId?: string) => {
  if (success) {
    // Mark order as paid
    // Save checkout ID for reference
    // Print receipt
    // Reset cart
  }
  setShowCardPayment(false);
};

return (
  <>
    {/* Your existing payment buttons */}
    <Button onClick={handleCardPayment}>Take Card Payment</Button>
    
    {/* SumUp payment modal */}
    {showCardPayment && (
      <SumUpPaymentFlow
        amount={cartTotal}
        onPaymentComplete={handlePaymentComplete}
      />
    )}
  </>
);
```

## Payment Flow

1. **Terminal Selection**: User selects an online terminal
2. **Checkout Creation**: API creates payment request
3. **Customer Interaction**: Customer presents card to terminal
4. **Status Polling**: System checks payment status every 2 seconds
5. **Completion**: Payment marked as PAID, FAILED, or CANCELLED

## Error Handling

The integration handles:
- Expired pairing codes
- Terminal offline status
- Network errors
- Payment failures
- Duplicate checkouts

## Security Notes

- All SumUp API calls are server-side only
- API keys are stored in environment variables
- Pairing codes are not stored (only reader IDs)
- RLS policies restrict database access

## Testing

1. Pair a test terminal using the settings page
2. Create a small test payment (£0.01)
3. Verify payment flow and status updates
4. Check terminal status changes

## Production Deployment

1. Ensure all environment variables are set in Vercel
2. Run the database migration
3. Test with a real SumUp Solo terminal
4. Monitor payment logs for any issues

## Troubleshooting

### "Invalid pairing code"
- Generate a fresh code on the SumUp device
- Use within 5 minutes
- Ensure device is connected to internet

### "Terminal not available"
- Check terminal is powered on and connected
- Verify terminal appears as "online" in settings
- Try pairing again if needed

### "Payment failed"
- Check card has sufficient funds
- Ensure NFC chip is working
- Try payment again with same card

## Support

For SumUp API issues, check the [SumUp Developer Docs](https://developer.sumup.com/).
For POS integration issues, review the API logs and database status.
