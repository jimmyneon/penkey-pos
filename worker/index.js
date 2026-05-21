// Custom service worker handlers for PWA updates
// This file extends the default next-pwa service worker

// Handle SKIP_WAITING message from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING message received, activating new service worker');
    self.skipWaiting();
  }
});

// When activated, immediately claim all clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('[SW] All clients claimed');
      // Notify all clients that the new service worker has taken control
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            message: 'New service worker activated'
          });
        });
      });
    })
  );
});

// Log when service worker is installed
self.addEventListener('install', (event) => {
  console.log('[SW] Service worker installed');
});
