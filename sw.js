/* sw.js — offline-first app shell cache */
const CACHE = 'ironlog-v1';
const ASSETS = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/util.js', 'js/db.js', 'js/data.js', 'js/store.js', 'js/charts.js', 'js/ui.js',
  'js/export.js', 'js/fitbit.js',
  'js/view-workout.js', 'js/view-history.js', 'js/view-progress.js',
  'js/view-nutrition.js', 'js/view-body.js', 'js/view-more.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // let API calls (Fitbit) hit the network
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
    )
  );
});
