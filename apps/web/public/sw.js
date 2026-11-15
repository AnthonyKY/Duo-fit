// CollabFit service worker: notifications only. No offline copy and no interception of requests: the app works
// exactly as without it. A notification shows what the server encrypted for this device (title, text, where to go).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const safeLink = to => (typeof to === 'string' && /^#\/[\w/-]*$/.test(to) ? to : '#/');
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : '' }; }
  const title = typeof d.title === 'string' && d.title.trim() ? d.title.slice(0, 80) : 'CollabFit';
  const options = { body: String(d.body || '').slice(0, 240), data: { to: safeLink(d.url) }, icon: 'icon-192.png', badge: 'icon-192.png' };
  if (typeof d.tag === 'string' && d.tag) options.tag = d.tag.slice(0, 64);
  // iPhone requires every push to show a notification: always shown, even if the content was unreadable
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const to = safeLink(event.notification.data && event.notification.data.to);
  const target = new URL(self.registration.scope); target.hash = to;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = open.find(c => c.url.startsWith(self.registration.scope));
    if (app) { await app.focus(); app.postMessage({ open: to }); return; }
    await self.clients.openWindow(target.href);
  })());
});
