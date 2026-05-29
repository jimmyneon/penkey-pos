"use client";

import { useEffect } from "react";

/**
 * Global error handler to catch and suppress workbox/service worker errors
 * Workbox library has a known bug where it calls charAt on undefined values
 * This component catches those errors and prevents them from crashing the app
 * Updated to trigger Vercel deployment - v2
 */
export function WorkboxErrorHandler() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Catch workbox charAt errors
      if (
        event.message?.includes('charAt') ||
        event.message?.includes('undefined') ||
        event.filename?.includes('workbox') ||
        event.filename?.includes('sw.js')
      ) {
        console.warn('[WorkboxErrorHandler] Caught workbox error:', event.message);
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.message?.includes('charAt') ||
        event.reason?.message?.includes('undefined')
      ) {
        console.warn('[WorkboxErrorHandler] Caught unhandled rejection:', event.reason);
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
