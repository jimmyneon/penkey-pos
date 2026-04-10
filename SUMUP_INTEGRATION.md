# SumUp Cloud API Integration

## Overview

This POS system integrates with SumUp Cloud API for card reader payments. The implementation follows SumUp's official API documentation and includes comprehensive error handling and payment verification.

## Architecture

### Payment Flow

1. **Pre-Payment Checks**
   - Verify SumUp credentials are configured
   - Check network connectivity
   - Fetch paired card readers from database
   - Verify reader status (online/offline, firmware updates)

2. **Checkout Creation**
   - Create checkout session on SumUp reader via API
   - Receives `client_transaction_id` for tracking
   - 60-second timeout to start payment on device

3. **Status Polling**
   - Poll every 2 seconds for checkout status
   - Handle reader states: IDLE, WAITING_FOR_CARD, WAITING_FOR_PIN, etc.
   - Maximum 90 seconds (45 attempts)
   - Dynamic user feedback based on status

4. **Payment Verification**
   - Verify transaction exists in checkout response
   - Double-check transaction status (SUCCESSFUL/PAID)
   - Extract transaction ID for refunds
   - Save receipt with full payment details

5. **Receipt Creation**
   - Store locally in IndexedDB (offline-first)
   - Queue for server sync
   - Include: transaction_id, checkout_id, payment_provider
   - Navigate to success page

## API Endpoints

### `/api/sumup/credentials`
- **GET**: Retrieve stored SumUp credentials from database
- **POST**: Save SumUp credentials (API key, merchant code, affiliate key)
- **DELETE**: Remove SumUp credentials

### `/api/sumup/pair-reader`
- **POST**: Pair a new SumUp Solo reader using pairing code
- Creates reader entry in database with reader_id

### `/api/sumup/terminals`
- **GET**: List all paired terminals from database
- **DELETE**: Unpair terminal (removes from SumUp and local DB)

### `/api/sumup/readers`
- **GET**: List readers from SumUp API (for recovery)
- **DELETE**: Unpair reader from SumUp API only

### `/api/sumup/reader-status`
- **GET**: Get current reader status
- Returns: device_status (ONLINE/OFFLINE), state (IDLE, WAITING_FOR_CARD, etc.)
- Used for pre-payment validation

### `/api/sumup/create-checkout`
- **POST**: Create checkout session on reader
- Body: `{ amount, currency, reader_id, description }`
- Returns: `{ checkout_id, client_transaction_id }`

### `/api/sumup/checkout-status`
- **GET**: Poll checkout status
- Query: `checkoutId`, `reader_id`
- Returns: `{ status, checkout, transactions }`

### `/api/sumup/refund`
- **POST**: Refund a transaction
- Body: `{ transaction_id, amount? }`
- Empty amount = full refund, specified amount = partial refund

## Error Handling

### Reader Not Found (404)
- **Cause**: Reader unpaired or doesn't exist
- **Action**: Prompt user to re-pair reader in settings
- **Recovery**: Use "Reset All" in Payment Terminals settings

### Reader Offline
- **Detection**: Reader status check before payment
- **Message**: "Card reader is offline. Please ensure it's powered on and connected."
- **Recovery**: Check reader power, WiFi connection

### Reader Updating Firmware
- **Detection**: Reader status = UPDATING_FIRMWARE
- **Message**: "Card reader is updating. Please wait and try again."
- **Recovery**: Wait for update to complete (usually 1-2 minutes)

### Checkout Timeout
- **Cause**: No card presented within 90 seconds
- **Message**: "Payment timeout. Please check the reader and try again."
- **Recovery**: Retry payment, check reader display

### Payment Declined
- **Detection**: Status = DECLINED
- **Message**: "Card declined"
- **Recovery**: Try different card or payment method

### Payment Cancelled
- **Detection**: Status = CANCELLED
- **Message**: "Payment cancelled by user"
- **Recovery**: Retry if needed

### Connection Lost During Polling
- **Detection**: 5 consecutive poll failures
- **Message**: "Lost connection to payment system. Please check the reader and verify payment status."
- **Recovery**: Check network, verify payment on reader, check receipts

### Transaction Verification Failed
- **Detection**: No transaction in successful checkout OR transaction status mismatch
- **Message**: "Payment verification failed. Please check receipts."
- **Recovery**: Manual verification in receipts, contact support if needed

## Payment Verification

The system implements multiple layers of verification:

1. **Checkout Status**: Must be PAID or SUCCESSFUL
2. **Transaction Exists**: Checkout must contain at least one transaction
3. **Transaction Status**: Transaction status must be SUCCESSFUL or PAID
4. **Transaction ID**: Must be present for refund capability

This ensures:
- Payment was actually processed by SumUp
- Money was transferred
- Transaction can be refunded if needed
- Receipt is linked to actual transaction

## Refund Flow

1. **Refund Request**: User initiates refund from receipts page
2. **Payment Check**: System checks if payment was via SumUp card
3. **SumUp Refund**: Calls SumUp refund API with transaction_id
4. **Verification**: Only proceeds with local refund if SumUp refund succeeds
5. **Receipt Update**: Marks receipt as partially/fully refunded

### Refund Types
- **Full Refund**: Empty request body to `/api/sumup/refund`
- **Partial Refund**: Include `amount` in request body

## Database Schema

### `terminals` Table
```sql
CREATE TABLE terminals (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    reader_id TEXT NOT NULL UNIQUE,
    location TEXT,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'pairing')),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### `receipts` Table (SumUp fields)
- `payment_method`: "card"
- `payment_provider`: "sumup"
- `transaction_id`: SumUp transaction ID (for refunds)
- `checkout_id`: SumUp checkout session ID

## Configuration

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `SUMUP_API_BASE`: SumUp API base URL (default: https://api.sumup.com)

### Database Storage
SumUp credentials are stored in `org_settings` table:
```json
{
  "sumup_credentials": {
    "api_key": "sup_sk_...",
    "merchant_code": "...",
    "affiliate_key": "sup_afk_...",
    "updated_at": "2026-04-10T09:00:00Z"
  }
}
```

## Security

- Credentials stored in database, not localStorage
- Service role key used for database operations (bypasses RLS)
- API key never exposed to client
- Session validation on all API endpoints
- HTTPS required for all SumUp API calls

## Testing

### Test Payment Flow
1. Pair a reader in Settings → Payment Terminals
2. Add items to cart
3. Select Card payment method
4. Present test card to reader
5. Verify receipt creation
6. Check transaction in SumUp dashboard

### Test Refund Flow
1. Find card payment receipt
2. Click Refund
3. Select full or partial refund
4. Verify refund in SumUp dashboard
5. Check receipt status updated

### Test Error Scenarios
- Power off reader → Verify offline detection
- Cancel payment on reader → Verify cancellation handling
- Use declined test card → Verify decline message
- Disconnect network during payment → Verify timeout handling

## Troubleshooting

### "No card readers paired"
- Go to Settings → Payment Terminals
- Click "Pair New Reader"
- Enter pairing code from reader

### "Card reader is offline"
- Check reader power
- Check WiFi connection
- Verify reader shows "Ready" on screen

### "Failed to save terminal to database"
- Run migrations in Supabase
- Check RLS policies on terminals table
- Verify service role key is set

### "Affiliate key can't be blank"
- Ensure affiliate key is saved in settings
- Check database for sumup_credentials
- Verify affiliate field format in API request

### Payment stuck on "Waiting for card..."
- Check reader display
- Ensure reader is in IDLE state
- Try terminating checkout and retrying

## SumUp API Documentation

- Cloud API: https://developer.sumup.com/terminal-payments/cloud-api
- Readers API: https://developer.sumup.com/api/readers
- Refunds: https://developer.sumup.com/online-payments/guides/refund
- Transactions: https://developer.sumup.com/api/transactions

## Support

For SumUp-specific issues:
- SumUp Developer Portal: https://developer.sumup.com
- SumUp Support: https://help.sumup.com

For POS integration issues:
- Check server logs for detailed error messages
- Review browser console for client-side errors
- Verify database state in Supabase
