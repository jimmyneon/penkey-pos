/**
 * CSRF Middleware
 * Validates CSRF tokens on state-changing operations (POST, PUT, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCSRFToken, getCSRFTokenFromRequest, getCSRFTokenFromCookie } from '@/lib/utils/csrf';

/**
 * Validate CSRF token on state-changing requests
 * Should be called on POST, PUT, DELETE endpoints
 */
export async function validateCSRF(request: NextRequest): Promise<boolean> {
  try {
    // ✅ SECURITY: Get CSRF token from request header
    const tokenFromHeader = getCSRFTokenFromRequest(request);

    // ✅ SECURITY: Get CSRF token from cookie
    const cookieHeader = request.headers.get('cookie');
    const tokenFromCookie = getCSRFTokenFromCookie(cookieHeader);

    // ✅ SECURITY: Validate tokens match
    if (!validateCSRFToken(tokenFromHeader, tokenFromCookie)) {
      console.warn('[CSRF] Invalid or missing CSRF token');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[CSRF] Validation error:', error);
    return false;
  }
}

/**
 * Return CSRF validation error response
 */
export function csrfErrorResponse() {
  return NextResponse.json(
    { error: 'CSRF validation failed - Invalid or missing token' },
    { status: 403 }
  );
}
