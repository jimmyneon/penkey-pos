/**
 * Auth-Specific Rate Limiting
 * More aggressive rate limiting for authentication endpoints
 * Prevents brute force attacks on login and PIN verification
 * 
 * ✅ SECURITY: Prevents brute force attacks
 */

import { NextRequest } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    attempts: number;
    firstAttempt: number;
    blockedUntil?: number;
  };
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore: RateLimitStore = {};

/**
 * Get client identifier (IP address or session ID)
 */
function getClientId(request: NextRequest): string {
  // Try to get from X-Forwarded-For header (behind proxy)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Fallback to connection IP or user agent
  const ip = request.headers.get('x-real-ip') || 
             request.headers.get('cf-connecting-ip') ||
             'unknown';
  return ip;
}

/**
 * Check if client is rate limited
 */
export function isAuthRateLimited(request: NextRequest): boolean {
  const clientId = getClientId(request);
  const now = Date.now();

  const record = rateLimitStore[clientId];

  // No record = not rate limited
  if (!record) {
    return false;
  }

  // Check if blocked
  if (record.blockedUntil && now < record.blockedUntil) {
    return true;
  }

  // Check if window has expired (15 minutes)
  const windowExpired = now - record.firstAttempt > 15 * 60 * 1000;
  if (windowExpired) {
    delete rateLimitStore[clientId];
    return false;
  }

  return false;
}

/**
 * Record failed authentication attempt
 * Implements exponential backoff
 */
export function recordAuthFailure(request: NextRequest): void {
  const clientId = getClientId(request);
  const now = Date.now();

  if (!rateLimitStore[clientId]) {
    rateLimitStore[clientId] = {
      attempts: 1,
      firstAttempt: now,
    };
    return;
  }

  const record = rateLimitStore[clientId];
  record.attempts++;

  // Exponential backoff
  // 3 attempts: 30 seconds
  // 5 attempts: 2 minutes
  // 10 attempts: 15 minutes
  if (record.attempts === 3) {
    record.blockedUntil = now + 30 * 1000; // 30 seconds
    console.warn(`[AUTH-RATELIMIT] Client ${clientId} blocked for 30s after 3 failed attempts`);
  } else if (record.attempts === 5) {
    record.blockedUntil = now + 2 * 60 * 1000; // 2 minutes
    console.warn(`[AUTH-RATELIMIT] Client ${clientId} blocked for 2m after 5 failed attempts`);
  } else if (record.attempts === 10) {
    record.blockedUntil = now + 15 * 60 * 1000; // 15 minutes
    console.warn(`[AUTH-RATELIMIT] Client ${clientId} blocked for 15m after 10 failed attempts`);
  }
}

/**
 * Record successful authentication
 * Clears the rate limit record
 */
export function recordAuthSuccess(request: NextRequest): void {
  const clientId = getClientId(request);
  delete rateLimitStore[clientId];
}

/**
 * Get remaining time until rate limit expires (in seconds)
 */
export function getAuthRateLimitRemaining(request: NextRequest): number {
  const clientId = getClientId(request);
  const record = rateLimitStore[clientId];

  if (!record || !record.blockedUntil) {
    return 0;
  }

  const remaining = Math.ceil((record.blockedUntil - Date.now()) / 1000);
  return Math.max(0, remaining);
}

/**
 * Clean up old records (call periodically)
 */
export function cleanupAuthRateLimitStore(): void {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  for (const [clientId, record] of Object.entries(rateLimitStore)) {
    if (now - record.firstAttempt > maxAge) {
      delete rateLimitStore[clientId];
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupAuthRateLimitStore, 5 * 60 * 1000);
}
