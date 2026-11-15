// Firebase Cloud Messaging background service worker for Trendit Web Push
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const notification = payload.notification || {};
    const data = payload.data || {};
    const title = notification.title || 'Trendit';
    const options = {
      body: notification.body || 'You have a new update on Trendit.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (_) {}
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const postId = event.notification?.data?.postId;
  const targetUrl = postId ? `/post/${encodeURIComponent(postId)}` : '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl).catch(() => {});
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
