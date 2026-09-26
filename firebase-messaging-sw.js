/* Phone reminders for the Hayat cleaning app (Firebase Cloud Messaging).
   Registered by clean.html with scope ./fcm/ so it never touches the site's own sw.js cache.
   The shop PC service sends each task at its time; this shows it and opens the app when tapped. */
self.window = self;
importScripts('config.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
try {
  firebase.initializeApp(self.CONFIG.firebase);
  var messaging = firebase.messaging();
  messaging.onBackgroundMessage(function (p) {
    /* messages that carry a "notification" are shown by the browser itself; data-only ones are shown here */
    if (p.notification) return;
    var d = p.data || {};
    self.registration.showNotification(d.title || 'Hayat cleaning', {
      body: d.body || '', tag: d.tag || 'hayat-clean', renotify: true,
      icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: {link: d.link || 'clean.html'}
    });
  });
} catch (e) {}
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var link = (e.notification.data && e.notification.data.link) || (e.notification.data && e.notification.data.FCM_MSG && e.notification.data.FCM_MSG.fcmOptions && e.notification.data.FCM_MSG.fcmOptions.link) || 'clean.html';
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(function (ws) {
    for (var i = 0; i < ws.length; i++) { if (ws[i].url.indexOf('clean.html') >= 0) { ws[i].focus(); return ws[i].navigate ? ws[i].navigate(link) : null; } }
    return clients.openWindow(link);
  }));
});
