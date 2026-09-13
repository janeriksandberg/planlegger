// Service worker: nettverk først (alltid revalidert mot serveren), cache som reserve for offline.
// Bump VERSION ved hver utrulling (og ?v= i index.html).
const VERSION = 'v10';
const CACHE = 'planlegger-' + VERSION;
const ASSETS = ['./', './index.html', './css/style.css', './js/config.js', './js/crypto.js', './js/store.js', './js/ai.js', './js/app.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-maskable.svg'];

self.addEventListener('install', (e) => {
  // cache: 'reload' hopper over nettleserens HTTP-buffer, så vi aldri installerer en gammel fil.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // cache: 'no-cache' = spør alltid serveren (ETag), så en ny utrulling vises ved neste innlasting.
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
