// 1TO1 player app offline cache. Same pattern as organiser-v9/sw.js (network first, saved copy when offline).
// Bump CACHE on every player build so installed copies pick up the new files.
// This file never reads or writes localStorage, IndexedDB or cookies.
// Only same-origin GET requests are handled and saved. The online database and any other
// cross-origin call go straight to the network and are never saved.
const CACHE = 'player-shell-1-r3';
const SHELL = [
  './', 'signup.html', 'app.html', 'night.html', 'offline.html',
  'manifest.webmanifest', 'pwa.js', 'pwa.css',
  'app.css', 'app-tokens.css', 'app-shell.css',
  'config.js', 'rules.js', 'backend.js', 'app.js',
  'lib/xp.js', 'lib/player-name.js', 'lib/player-name.css',
  'loading/loading.js', 'loading/loading.css',
  'reveal/reveal.js', 'reveal/reveal.css',
  'pay/pay.js', 'pay/pay.css',
  'shop/cosmetics.js',
  'screens/home/home.js', 'screens/home/home.css',
  'screens/profile/profile.js', 'screens/profile/profile.css',
  'screens/leaderboard/leaderboard.js', 'screens/leaderboard/leaderboard.css',
  'screens/live/live.js', 'screens/live/live.css',
  'screens/more/more.js', 'screens/more/more.css',
  'shop/shop.html', 'shop/shop.js', 'shop/shop.css', 'shop/shop-backend.js', 'shop/shop-rules.js',
  'fonts/barlow-400.woff2', 'fonts/barlow-600.woff2', 'fonts/barlow-700.woff2', 'fonts/barlowcondensed-700.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon-180.png'
];

self.addEventListener('install', e => {
  // Each file is added on its own, so one missing file cannot stop the app from installing.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(url => c.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(hit =>
        hit || (req.mode === 'navigate' ? caches.match('offline.html') : Response.error())
      )
    )
  );
});
