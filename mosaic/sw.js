const CACHE = 'topomosaic-v1.0.10';
const CORE = [
  './', './index.html', './styles.css', './app.js', './icon.svg', './manifest.webmanifest',
  './core/clues.js', './core/lattices.js', './core/puzzle.js', './core/solver.js', './core/storage.js',
  './data/puzzles.js', './render/board2d.js', './render/board3d.js', './render/voronoi.js', './solver.worker.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response;
    })));
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreSearch: event.request.mode === 'navigate' }).then((cached) => (
    cached || fetch(event.request).then((response) => {
      const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response;
    }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
  )));
});
