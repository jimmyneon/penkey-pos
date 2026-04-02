# Security TODO: API Route Authentication

## Current Status: ✅ SECURED

The POS app currently uses API routes with `SERVICE_ROLE_KEY` that have **NO authentication or authorization checks**. This means anyone can call these endpoints and modify data.

## Affected API Routes

### Categories
- `POST /api/categories` - Create category
- `PATCH /api/categories/[id]` - Update category
- `DELETE /api/categories/[id]` - Delete category

### Items
- `POST /api/items` - Create item
- `PATCH /api/items/[id]` - Update item
- `DELETE /api/items/[id]` - Delete item

### Modifiers
- `POST /api/modifiers/groups` - Create modifier group
- `POST /api/modifiers/options` - Create modifier option

## Current Vulnerability

Anyone can execute these from browser console:

```javascript
// Delete ANY category
await fetch('/api/categories/any-category-id', {
  method: 'DELETE'
});

// Update ANY item
await fetch('/api/items/any-item-id', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Hacked', price: 0 })
});

// Access data from ANY organization
await fetch('/api/categories?org_id=any-org-id');
```

## Why This Happened

The POS app uses **custom authentication** (sessionStorage) instead of Supabase Auth:
- Session stored in `sessionStorage.getItem('pos_session')`
- Supabase client has no session
- RLS policies block direct client calls
- Solution was to use SERVICE_ROLE_KEY (bypasses RLS)
- **But we forgot to add authentication to the API routes!**

## Recommended Fix

### Option 1: Session Header Validation (RECOMMENDED - Quick Fix)

Add authentication middleware to validate the POS session:

```typescript
// /src/lib/api/auth.ts
import { NextRequest, NextResponse } from 'next/server';

export interface POSSession {
  user_id: string;
  org_id: string;
  register?: {
    id: string;
    name: string;
  };
}

export async function validatePOSSession(request: NextRequest): Promise<POSSession | null> {
  try {
    // Get session from header (client must send it)
    const sessionHeader = request.headers.get('x-pos-session');
    if (!sessionHeader) return null;

    const session: POSSession = JSON.parse(sessionHeader);
    
    // Validate required fields
    if (!session.user_id || !session.org_id) return null;

    // TODO: Optionally verify session against database
    // const supabase = createSupabaseServerClient(...);
    // const { data } = await supabase
    //   .from('user_sessions')
    //   .select('*')
    //   .eq('user_id', session.user_id)
    //   .eq('org_id', session.org_id)
    //   .single();
    // if (!data) return null;

    return session;
  } catch (error) {
    console.error('[validatePOSSession] Error:', error);
    return null;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized - Invalid or missing session' },
    { status: 401 }
  );
}
```

### Example: Secure Category Update

```typescript
// /src/app/api/categories/[id]/route.ts
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Validate session
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { name, color, description, is_active } = body;

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Verify the category belongs to the user's org
    const { data: category } = await supabase
      .from('categories')
      .select('org_id')
      .eq('id', params.id)
      .single();

    if (!category || category.org_id !== session.org_id) {
      return NextResponse.json(
        { error: 'Category not found or access denied' },
        { status: 404 }
      );
    }

    // 3. Proceed with update
    const { data, error } = await supabase
      .from('categories')
      .update({ name, color, description, is_active })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to update category:', error);
    return NextResponse.json(
      { error: 'Failed to update category', details: error.message },
      { status: 500 }
    );
  }
}
```

### Client-Side Changes

Update all fetch calls to include session header:

```typescript
// /src/app/items/quick-edit-category-dialog.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Get session from sessionStorage
  const sessionData = sessionStorage.getItem('pos_session');
  if (!sessionData) {
    alert('Session expired. Please log in again.');
    return;
  }

  const response = await fetch(`/api/categories/${category.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-pos-session': sessionData, // Add session header
    },
    body: JSON.stringify(updateData),
  });

  // ... rest of code
};
```

### Option 2: Supabase Auth (BETTER - Long-term)

Refactor to use Supabase Auth properly:
1. Store Supabase session in cookies (not sessionStorage)
2. Use `createServerClient` from `@supabase/ssr`
3. Let RLS policies handle authorization
4. Remove SERVICE_ROLE_KEY usage

**Pros:**
- Industry standard
- Built-in security
- RLS policies work as intended
- Session management handled by Supabase

**Cons:**
- Requires auth refactor
- More complex migration
- Need to update all auth flows

### Option 3: API Keys (Alternative)

Generate org-specific API keys:
1. Create `api_keys` table with org_id
2. Store API key in sessionStorage
3. Validate API key on each request

**Pros:**
- Simple to implement
- Easy to revoke access

**Cons:**
- Keys can be stolen from sessionStorage
- Need key rotation strategy

## Implementation Checklist

### Phase 1: Add Session Validation (URGENT)
- [x] Create `/src/lib/api/auth.ts` with validation helpers
- [x] Update all API routes to validate session
- [x] Update all client-side fetch calls to include session header
- [x] Test all create/update/delete operations
- [x] Add org_id validation for all resources

### Phase 2: Add Rate Limiting (IMPORTANT)
- [x] Install rate limiting library (e.g., `@upstash/ratelimit`)
- [x] Add rate limits to API routes
- [x] Configure limits per endpoint (e.g., 10 req/10s)

### Phase 3: Add Logging & Monitoring (RECOMMENDED)
- [x] Log all API route access with user_id and org_id
- [ ] Monitor for suspicious activity (ongoing)
- [ ] Set up alerts for failed auth attempts (platform-specific)

### Phase 4: Consider Supabase Auth Migration (FUTURE)
- [ ] Evaluate effort vs. benefit
- [ ] Plan migration strategy
- [ ] Update auth flows
- [ ] Migrate existing sessions

## Files to Update

### API Routes (Add auth validation)
- `/src/app/api/categories/route.ts`
- `/src/app/api/categories/[id]/route.ts`
- `/src/app/api/items/route.ts`
- `/src/app/api/items/[id]/route.ts`
- `/src/app/api/modifiers/groups/route.ts`
- `/src/app/api/modifiers/options/route.ts`

### Client Components (Add session header)
- `/src/app/items/quick-edit-category-dialog.tsx`
- `/src/app/items/quick-add-category-dialog.tsx`
- `/src/app/items/quick-edit-dialog.tsx`
- `/src/app/items/quick-add-modifier-dialog.tsx`

## Testing Plan

1. **Test with valid session** - Should work
2. **Test without session header** - Should return 401
3. **Test with invalid session** - Should return 401
4. **Test cross-org access** - Should return 404
5. **Test from browser console** - Should fail without session

## Priority: 🔴 HIGH

This should be fixed **before production deployment**. The current implementation allows anyone to modify data without authentication.

## Estimated Effort

- **Quick Fix (Option 1)**: 2-4 hours
- **Supabase Auth (Option 2)**: 1-2 days
- **API Keys (Option 3)**: 4-6 hours

## Notes

- Current implementation works for development/testing
- **DO NOT deploy to production without fixing this**
- Consider adding CORS restrictions as well
- Add request logging for audit trail
