# QR Code Integration Guide

## Overview
The QR code system allows customers to scan QR codes to leave Google Reviews, with full tracking of scans and analytics.

## Features
- **Google Review QR Codes**: Displayed on payment success screen
- **Scan Tracking**: Logs every scan with timestamp, receipt ID, and store
- **Analytics**: View scan statistics by date, store, and recent activity
- **Unique Tracking URLs**: Each QR code has a unique short code (e.g., `/qr/ABC123`)

## Database Schema

### qr_codes Table
- `id`: UUID primary key
- `org_id`: Organization reference
- `store_id`: Optional store reference
- `code_type`: 'google_review' | 'website' | 'custom'
- `name`: Display name
- `target_url`: Destination URL
- `unique_code`: 8-character unique code for tracking URL
- `is_active`: Boolean
- `config`: JSONB for appearance settings

### qr_scans Table
- `id`: UUID primary key
- `qr_code_id`: Reference to qr_codes
- `receipt_id`: Optional receipt reference
- `store_id`: Optional store reference
- `user_agent`: Browser user agent
- `ip_address`: Optional IP for analytics
- `referrer`: Optional referrer
- `scanned_at`: Timestamp

## API Endpoints

### QR Codes Management
- `POST /api/qr-codes` - Create new QR code
- `GET /api/qr-codes?org_id={id}` - List QR codes for organization
- `GET /api/qr-codes/{id}` - Get single QR code
- `PATCH /api/qr-codes/{id}` - Update QR code
- `DELETE /api/qr-codes/{id}` - Delete QR code

### Analytics
- `GET /api/qr-codes/{id}/stats` - Get scan statistics
  - Total scans
  - Scans by day (last 30 days)
  - Scans by store
  - Recent scans (last 10)

### Public Tracking
- `GET /qr/{code}?receipt_id={id}` - Public redirect endpoint
  - Logs the scan
  - Redirects to target URL
  - Optional receipt_id for transaction tracking

## Setup Instructions

### 1. Run Database Migration
```bash
# Apply the migration to create qr_codes and qr_scans tables
supabase db push
```

### 2. Seed Google Review QR Code
```bash
# Update the GOOGLE_REVIEW_URL in scripts/seed-google-review-qr.js
# Then run:
node scripts/seed-google-review-qr.js
```

### 3. Update Google Review URL
Edit `scripts/seed-google-review-qr.js` and replace:
```javascript
const GOOGLE_REVIEW_URL = 'https://g.page/r/YOUR_GOOGLE_BUSINESS_ID/review';
```
With your actual Google Business Profile review link.

## Usage

### Payment Success Screen
After a successful payment, customers see a "Leave a Review" button (yellow star icon). Clicking opens a modal with the QR code.

### Tracking URL Format
```
https://your-domain.com/qr/{UNIQUE_CODE}?receipt_id={RECEIPT_ID}
```

Example:
```
https://penkey-pos.vercel.app/qr/ABC123?receipt_id=temp_1234567890
```

## Components

### QRCodeModal
Located: `src/components/qr-code-modal.tsx`

Props:
- `open`: boolean - Modal open state
- `onClose`: function - Close handler
- `qrCodeUrl`: string - Tracking URL
- `title`: string - Modal title (default: "Leave a Review")
- `description`: string - Modal description
- `receiptId`: string - Optional receipt ID for tracking

## Future Enhancements

### Receipt Integration
- Add QR code to printed receipts (requires print server changes)
- Small QR code (2-3cm) in footer
- Links to Google Review with receipt tracking

### Settings Page
- QR code management UI
- Create/edit/delete QR codes
- View scan statistics
- Generate printable QR codes for table tents

### Advanced Features
- Custom QR codes (website, promotions)
- A/B testing different QR codes
- Time-limited QR codes
- Campaign tracking

## Privacy Considerations
- IP logging is optional (currently disabled)
- No personal data stored
- GDPR compliant
- User agent stored for analytics only

## Troubleshooting

### QR Code Not Showing on Payment Success
1. Check that a Google Review QR code exists for your org
2. Verify `is_active` is true
3. Check browser console for errors

### Scans Not Being Tracked
1. Verify the tracking URL format is correct
2. Check that the QR code is active
3. Check Supabase logs for errors

### Migration Failed
1. Ensure Supabase CLI is installed
2. Check database connection
3. Verify service role key permissions
