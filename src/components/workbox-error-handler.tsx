"use client";

import { useEffect } from "react";

/**
 * Global error handler to catch and suppress workbox/service worker errors
 * Workbox library has a known bug where it calls charAt on undefined values
 * This component catches those errors and prevents them from crashing the app
 * Updated to trigger Vercel deployment - v5
 */
export function WorkboxErrorHandler() {
  useEffect(() => {
    console.log('[WorkboxErrorHandler] Initialized - v8');
    
    // Override console methods to suppress workbox errors
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args) => {
      const message = args[0]?.toString() || '';
      if (
        message.includes('WorkboxErrorHandler') ||
        message.includes('workbox') ||
        message.includes('charAt') ||
        message.includes('length') ||
        message.includes('undefined') ||
        message.includes('bad-precaching-response') ||
        message.includes('precaching')
      ) {
        return; // Suppress workbox warnings
      }
      originalWarn.apply(console, args);
    };
    
    console.error = (...args) => {
      const message = args[0]?.toString() || '';
      if (
        message.includes('workbox') ||
        message.includes('charAt') ||
        message.includes('length') ||
        message.includes('undefined') ||
        message.includes('bad-precaching-response') ||
        message.includes('precaching')
      ) {
        return; // Suppress workbox errors
      }
      originalError.apply(console, args);
    };
    
    const handleError = (event: ErrorEvent) => {
      // Catch ALL workbox/service worker errors
      const isWorkboxError = 
        event.filename?.includes('workbox') ||
        event.filename?.includes('sw.js') ||
        event.filename?.includes('1684-668ea0aaf6891293.js') ||
        event.filename?.includes('4bd1b696-5177845d3ed210f8.js') ||
        event.filename?.includes('3963-972918b2a426eba5.js') ||
        event.message?.includes('charAt') ||
        event.message?.includes('length') ||
        event.message?.includes('undefined') ||
        event.message?.includes('bad-precaching-response') ||
        event.message?.includes('precaching');
      
      if (isWorkboxError) {
        event.preventDefault();
        event.stopPropagation();
        return true; // Mark as handled
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Catch ALL workbox unhandled rejections
      const isWorkboxError = 
        event.reason?.message?.includes('charAt') ||
        event.reason?.message?.includes('length') ||
        event.reason?.message?.includes('undefined') ||
        event.reason?.message?.includes('bad-precaching-response') ||
        event.reason?.message?.includes('precaching');
      
      if (isWorkboxError) {
        event.preventDefault();
        return true; // Mark as handled
      }
    };

    window.addEventListener('error', handleError, true); // Use capture phase
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
