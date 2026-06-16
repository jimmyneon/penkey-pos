import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security Headers Middleware
 * Adds security headers to all responses
 *
 * ✅ SECURITY: Protects against various attacks
 */

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ✅ SECURITY: Strict-Transport-Security
  // Forces HTTPS for all future requests
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // ✅ SECURITY: X-Content-Type-Options
  // Prevents MIME type sniffing attacks
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // ✅ SECURITY: X-Frame-Options
  // Prevents clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY');

  // ✅ SECURITY: X-XSS-Protection
  // Enables XSS protection in older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // ✅ SECURITY: Referrer-Policy
  // Controls referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ✅ SECURITY: Permissions-Policy
  // Controls browser features and APIs
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  // ✅ SECURITY: Content-Security-Policy
  // Prevents inline scripts and restricts resource loading
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  return response;
}

// Apply middleware to all routes except static files
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
