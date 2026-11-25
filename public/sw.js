// Self-destructing kill-switch Service Worker (clears broken legacy Workbox caches on both Vercel web & Android APK)
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            return caches.delete(key);
          })
        );
      })
      .then(function () {
        return self.registration.unregister();
      })
      .then(function () {
        return self.clients.matchAll({ type: 'window' });
      })
      .then(function (clients) {
        clients.forEach(function (client) {
          if (client && typeof client.navigate === 'function') {
            client.navigate(client.url);
          }
        });
      })
  );
});
