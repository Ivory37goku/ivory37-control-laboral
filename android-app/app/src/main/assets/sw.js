/* Service Worker — Control laboral. Compatible con GitHub Pages en ruta de proyecto. */
'use strict';

const CACHE_PREFIX = 'control-laboral-';
const CACHE_NAME = CACHE_PREFIX + 'v3.2.2';
const ASSETS = [
  './',
  './index.html',
  './supabase-config.js',
  './supabase-sync.js',
  './vendor/supabase.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
        return response;
      } catch (error) {
        return (await cache.match(request)) || (await cache.match(new URL('./index.html', scopeUrl).href));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'SHOW_NOTIFICATION' && self.registration.showNotification) {
    const title = String(data.title || 'Control laboral');
    const body = String(data.body || 'Tienes un recordatorio.');
    event.waitUntil(self.registration.showNotification(title, {
      body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'control-laboral-reminder',
      renotify: false
    }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const scope = self.registration.scope;
    for (const client of clients) {
      if (client.url.startsWith(scope) && 'focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(scope);
  }));
});
