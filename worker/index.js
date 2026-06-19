// Custom service worker handlers for PWA updates
// This file extends the default next-pwa service worker

// Block clients.claim() - it orphans in-flight fetch requests on all open tabs,
// causing the page to crash (snap) when the SW activates during a page load.
// This runs before the workbox wrapper calls e.clientsClaim(), intercepting it.
// The SW takes control on next page navigation instead (safe behaviour).
self.clients.claim = () => {
  console.log('[SW] clients.claim() blocked - SW will take control on next navigation');
  return Promise.resolve();
};

// Handle SKIP_WAITING message from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING message received, activating new service worker');
    self.skipWaiting();
  }
});

// When activated, notify clients (but do NOT call clients.claim() here)
// clients.claim() is already handled by workbox in the compiled sw.js.
// Calling it again here kills in-flight fetch requests on all open pages.
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  // Notify clients that the new service worker has taken control
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          message: 'New service worker activated'
        });
      });
    })
  );
});

// Log when service worker is installed
self.addEventListener('install', (event) => {
  console.log('[SW] Service worker installed');
});
