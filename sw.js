/* Service worker — offline support for «Тренажёр 2200». */
const CACHE = 't2200-v3';
const CORE = [
  './', 'index.html', 'css/ds.css', 'css/app.css',
  'js/icons.js', 'js/store.js', 'js/engine.js', 'js/app.js',
  'data/index.json', 'manifest.webmanifest', 'assets/qrcode.js',
  'assets/katex/katex.min.css', 'assets/katex/katex.min.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // navigation → app shell
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  // cache-first, then network (and cache it) — good for fonts, data slices, katex
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit))
  );
});
