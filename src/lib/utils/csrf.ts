/**
 * CSRF Protection Utility
 * Generates and validates CSRF tokens to prevent cross-site request forgery
 * 
 * ✅ SECURITY: Prevents CSRF attacks on state-changing operations
 */

import crypto from 'crypto';

/**
 * Generate a CSRF token
 * Should be called on login and stored in a secure cookie
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token
 * Compares token from request header with token from cookie
 */
export function validateCSRFToken(
  tokenFromHeader: string | null,
  tokenFromCookie: string | null
): boolean {
  if (!tokenFromHeader || !tokenFromCookie) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(tokenFromHeader),
    Buffer.from(tokenFromCookie)
  );
}

/**
 * Extract CSRF token from request
 * Looks for token in:
 * 1. X-CSRF-Token header
 * 2. X-Requested-With header (as fallback)
 */
export function getCSRFTokenFromRequest(request: Request): string | null {
  const token = request.headers.get('x-csrf-token');
  if (token) return token;

  // Fallback for older implementations
  return request.headers.get('x-requested-with');
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith('csrf_token=')) {
      return cookie.substring('csrf_token='.length);
    }
  }

  return null;
}
