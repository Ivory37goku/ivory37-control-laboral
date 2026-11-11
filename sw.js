/* ============================================================
   Service Worker — Control laboral (工V龱尺ㄚ㇌7)
   - Cache-first para offline real
   - Recordatorios programados (08:00 y 16:00)
   ============================================================ */

const CACHE_NAME = 'control-laboral-v2.3.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* ---------- Instalación: precachear ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* ---------- Activación: limpiar cachés viejas ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ---------- Fetch: cache-first con fallback a red ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Solo cachear GET del mismo origen
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

/* ---------- Mensajes desde la app ---------- */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'SCHEDULE_REMINDER') {
    scheduleReminder(data.hour, data.minute, data.title, data.body);
  }
});

/* ---------- Recordatorios programados ---------- */
const timers = new Map();

function scheduleReminder(hour, minute, title, body) {
  const key = hour + ':' + minute;
  if (timers.has(key)) clearTimeout(timers.get(key));

  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const delay = target.getTime() - now.getTime();
  const id = setTimeout(() => {
    self.registration.showNotification(title, {
      body: body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'reminder-' + key,
      renotify: true,
      vibrate: [200, 100, 200]
    });
    // Reprogramar para el día siguiente
    scheduleReminder(hour, minute, title, body);
  }, delay);

  timers.set(key, id);
}

/* ---------- Click en notificación ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(location.origin) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
