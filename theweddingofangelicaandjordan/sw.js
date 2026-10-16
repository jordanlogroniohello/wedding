var CACHE = 'wedding-dash-v4';
var ASSETS = [
  '/theweddingofangelicaandjordan/dashboard.html',
  '/theweddingofangelicaandjordan/monogram.png',
  '/theweddingofangelicaandjordan/floral-hero.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.filter(function(n) { return n !== CACHE; }).map(function(n) { return caches.delete(n); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.url.indexOf('supabase.co') !== -1) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(r) {
      if (r) return r;
      return fetch(e.request).then(function(res) {
        if (res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return res;
      });
    })
  );
});
