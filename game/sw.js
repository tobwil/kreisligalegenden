// Offline-Cache für die installierte App (nur unter /game/). Das Spiel ist eine einzige Datei: sie kommt immer zuerst frisch
// aus dem Netz (damit Updates sofort da sind) und nur ohne Netz aus dem Cache. Schriften und Icons ändern sich nie: Cache zuerst.
const CACHE = 'krl-v1';
const CORE = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', '../fonts/fonts.css',
  '../fonts/press-start-2p-latin.woff2', '../fonts/press-start-2p-latin-ext.woff2', '../fonts/vt323-latin.woff2', '../fonts/vt323-latin-ext.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;   // Statistik (Umami) und alles Fremde nie anfassen
  if (r.mode === 'navigate' || u.pathname.endsWith('/game/') || u.pathname.endsWith('/game/index.html')) {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); if (res.ok) caches.open(CACHE).then(c => c.put('./', cp)); return res; })
      .catch(() => caches.match('./', { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok && /\/(fonts|icons)\//.test(u.pathname)) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })));
});
