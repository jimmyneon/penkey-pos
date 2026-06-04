"use client";

import { useEffect } from "react";

/**
 * Suppresses errors that originate specifically from the Workbox/SW runtime.
 *
 * IMPORTANT: keep this narrow. Previously this suppressed any message containing
 * 'undefined', 'length', or 'charAt' — those are common JS values and hiding them
 * masked real application bugs. Only suppress errors whose source is sw.js or
 * workbox, or that carry a known workbox-specific error code.
 */
export function WorkboxErrorHandler() {
  useEffect(() => {
    const isWorkboxSource = (filename?: string) =>
      !!filename && (filename.includes('/sw.js') || filename.includes('workbox'));

    const isWorkboxMessage = (msg: string) =>
      msg.includes('bad-precaching-response') ||
      msg.includes('workbox') ||
      msg.includes('precache');

    const handleError = (event: ErrorEvent) => {
      if (
        isWorkboxSource(event.filename) ||
        isWorkboxMessage(event.message || '')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || '';
      if (isWorkboxMessage(msg)) {
        event.preventDefault();
        return true;
      }
    };

    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
