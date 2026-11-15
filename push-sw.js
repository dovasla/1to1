// 1TO1 player app: push handler for the service worker (N11). Added to sw.js with importScripts (see HOOKS.md).
// Shows the notification and opens the app when it is tapped. Holds no player data: the message text is all it shows.
self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = {}; }
  var title = String(data.title || '1TO1');
  var options = {
    body: String(data.body || ''),
    tag: String(data.tag || '1to1'),
    icon: 'icons/icon-192-v2.png',
    badge: 'icons/icon-192-v2.png',
    data: { url: String(data.url || './') }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url && 'focus' in list[i]) return list[i].focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
