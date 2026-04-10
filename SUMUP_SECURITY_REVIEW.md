# SumUp Integration Security Review

## Current Architecture

### Dual Storage System

The system uses **two storage locations** for SumUp credentials:

1. **Database Storage (Primary)** - `org_settings` table
   - Stored in Supabase PostgreSQL
   - Org-scoped (shared across all devices/registers)
   - Used by all API routes
   - Persistent and synced

2. **LocalStorage (Mirror/Fallback)** - Browser localStorage
   - Stored with basic obfuscation (base64 + reverse)
   - Device-specific
   - Used for quick client-side checks
   - Fallback when DB is unavailable

## Security Analysis

### ✅ GOOD: Database Storage

**Location:** `org_settings.settings.sumup_credentials`

**Stored Fields:**
```json
{
  "api_key": "sup_sk_...",
  "merchant_code": "MD7HX9SL",
  "affiliate_key": "sup_afk_...",
  "updated_at": "2026-04-10T09:00:00Z"
}
```

**Security Features:**
- ✅ Stored server-side in PostgreSQL
- ✅ Never exposed to client directly
- ✅ Accessed only through authenticated API routes
- ✅ Session validation required (`validatePOSSession`)
- ✅ Uses Supabase service role key (bypasses RLS)
- ✅ HTTPS encrypted in transit
- ✅ Database-level encryption at rest (Supabase default)

**Access Pattern:**
```typescript
// All API routes use this pattern:
const session = await validatePOSSession(request);
if (!session) return unauthorizedResponse();

const dbCreds = await getStoredSumUpCredentials(session.org_id);
const apiKey = dbCreds?.api_key;
```

### ⚠️ CONCERN: LocalStorage Storage

**Location:** `localStorage['pos_sumup_credentials_v2']`

**Stored Fields (obfuscated):**
```json
{
  "apiKey": "base64(reversed(api_key))",
  "merchantCode": "base64(reversed(merchant_code))",
  "affiliateKey": "base64(reversed(affiliate_key))",
  "appId": "base64(reversed(app_id))",
  "environment": "production",
  "timestamp": 1234567890
}
```

**Security Issues:**
- ⚠️ **Obfuscation is NOT encryption** - easily reversible
- ⚠️ Accessible via browser DevTools
- ⚠️ Vulnerable to XSS attacks
- ⚠️ Persists across sessions
- ⚠️ Not cleared on logout

**Current Usage:**
- Used by payment page for quick credential check
- Used by settings page as fallback
- NOT used by API routes (they use database)

## Security Recommendations

### 🔴 CRITICAL: Remove API Key from LocalStorage

**Problem:** The API key should NEVER be stored in localStorage, even obfuscated.

**Solution:**
1. Remove `apiKey` from localStorage storage
2. Store only non-sensitive data:
   - `merchantCode` (public identifier)
   - `configured: true/false` flag
   - `updated_at` timestamp

3. Always fetch credentials from database via API

**Implementation:**
```typescript
// GOOD: Store only public info in localStorage
export function storeSumUpPublicInfo(info: {
  merchantCode: string;
  configured: boolean;
  updated_at: string;
}): void {
  localStorage.setItem('pos_sumup_public', JSON.stringify(info));
}

// BAD: Current implementation stores API key
// This should be removed
```

### 🟡 MEDIUM: Improve Database Security

**Current State:** Good, but can be improved

**Recommendations:**

1. **Add Field-Level Encryption**
   ```sql
   -- Encrypt sensitive fields before storing
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   
   -- Store encrypted
   UPDATE org_settings 
   SET settings = jsonb_set(
     settings,
     '{sumup_credentials,api_key}',
     to_jsonb(pgp_sym_encrypt(api_key, 'encryption_key'))
   );
   ```

2. **Add Audit Logging**
   ```sql
   CREATE TABLE credential_access_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     org_id UUID NOT NULL,
     accessed_by UUID NOT NULL,
     accessed_at TIMESTAMP DEFAULT NOW(),
     action TEXT NOT NULL
   );
   ```

3. **Rotate Credentials Regularly**
   - Add `expires_at` field
   - Prompt for re-authentication periodically
   - Invalidate old credentials

### 🟢 LOW: Additional Hardening

1. **Content Security Policy**
   ```typescript
   // next.config.js
   headers: [
     {
       key: 'Content-Security-Policy',
       value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline';"
     }
   ]
   ```

2. **Secure Cookie for Session**
   ```typescript
   // Ensure session cookies are secure
   cookies: {
     secure: true,
     httpOnly: true,
     sameSite: 'strict'
   }
   ```

3. **Rate Limiting**
   ```typescript
   // Add rate limiting to credential endpoints
   import rateLimit from 'express-rate-limit';
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 5 // 5 requests per window
   });
   ```

## Current Security Status

### ✅ What's Working Well

1. **API Routes are Secure**
   - All routes validate session
   - Credentials fetched from database
   - Never exposed to client
   - HTTPS encrypted

2. **Database Storage**
   - Server-side only
   - Requires authentication
   - Encrypted in transit and at rest

3. **Separation of Concerns**
   - Client never directly accesses SumUp API
   - All SumUp calls go through backend
   - Credentials never in frontend code

### ⚠️ What Needs Fixing

1. **LocalStorage Contains API Key**
   - Should only store public info
   - Remove sensitive credentials
   - Use API calls for credential checks

2. **No Credential Rotation**
   - Credentials never expire
   - No forced re-authentication
   - No audit trail

3. **No Field-Level Encryption**
   - Database stores credentials in plaintext JSON
   - Should use PostgreSQL encryption

## Recommended Changes

### Phase 1: Immediate (Critical)

1. **Remove API Key from LocalStorage**
   ```typescript
   // src/lib/services/sumup-credentials.ts
   export function storeSumUpPublicInfo(info: {
     merchantCode: string;
     configured: boolean;
   }): void {
     localStorage.setItem('pos_sumup_public', JSON.stringify(info));
   }
   
   export function getSumUpPublicInfo(): { merchantCode: string; configured: boolean } | null {
     const stored = localStorage.getItem('pos_sumup_public');
     return stored ? JSON.parse(stored) : null;
   }
   ```

2. **Update Payment Page**
   ```typescript
   // Check if configured via API, not localStorage
   const checkSumUpConfigured = async () => {
     const res = await fetch('/api/sumup/credentials');
     const data = await res.json();
     return data.configured;
   };
   ```

### Phase 2: Short-term (Important)

1. **Add Credential Expiry**
   ```typescript
   interface SumUpCredentials {
     api_key: string;
     merchant_code: string;
     affiliate_key: string;
     updated_at: string;
     expires_at: string; // Add this
   }
   ```

2. **Add Access Logging**
   ```typescript
   async function logCredentialAccess(orgId: string, action: string) {
     await supabase.from('credential_access_log').insert({
       org_id: orgId,
       action,
       accessed_at: new Date().toISOString()
     });
   }
   ```

### Phase 3: Long-term (Enhanced Security)

1. **Field-Level Encryption**
2. **Credential Rotation System**
3. **Multi-Factor Authentication for Credential Changes**
4. **Security Audit Dashboard**

## Compliance Considerations

### PCI DSS Compliance

SumUp handles the actual card data, so you're not directly subject to PCI DSS. However:

- ✅ You don't store card numbers
- ✅ You don't process card data directly
- ✅ API keys are stored server-side
- ⚠️ API keys in localStorage is a concern

### GDPR Compliance

- ✅ Credentials are org-scoped, not user-scoped
- ✅ Can be deleted via API
- ⚠️ No audit trail of who accessed credentials

## Conclusion

**Current Security Level: GOOD with CONCERNS**

### Strengths:
- API routes are properly secured
- Database storage is appropriate
- Session validation is enforced
- HTTPS encryption throughout

### Weaknesses:
- API key stored in localStorage (easily accessible)
- No credential rotation
- No field-level encryption
- No access audit trail

### Priority Actions:
1. **CRITICAL:** Remove API key from localStorage
2. **HIGH:** Add credential expiry and rotation
3. **MEDIUM:** Add field-level encryption
4. **LOW:** Add comprehensive audit logging

The system is functional and reasonably secure for a POS system, but removing the API key from localStorage should be done immediately to prevent potential security issues.
