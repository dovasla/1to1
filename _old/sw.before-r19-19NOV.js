// 1TO1 player app offline cache. Same pattern as organiser-v9/sw.js (network first, saved copy when offline).
// Bump CACHE on every player build so installed copies pick up the new files.
// This file never reads or writes localStorage, IndexedDB or cookies.
// Only same-origin GET requests are handled and saved. The online database and any other
// cross-origin call go straight to the network and are never saved.
importScripts('brand/names.js');
const CACHE = 'player-shell-1-next72z-r18';
const SHELL = [
  './', 'signup.html', 'app.html', 'night.html', 'offline.html',
  'manifest.webmanifest', 'pwa.js', 'pwa.css', 'pwa-push.js', 'lib/player-alerts.js', 'lib/run-alerts-hook.js',
  'brand/tokens.css', 'brand/components.css', 'brand/names.js', 'brand/lockup.js', 'brand/check-ball/loading-lockup.svg', 'app.css', 'app-tokens.css', 'app-shell.css', 'shell/device.css', 'lib/filling-up.js',
  'config.js', 'rules.js', 'backend.js', 'app.js',
  'lib/xp.js', 'lib/player-name.js', 'lib/player-name.css', 'lib/weekly-rival.js', 'lib/weekly-rival.css', 'lib/hype.js', 'lib/night-recap.js', 'lib/hype-recap.css',
  'lib/moments.js', 'lib/delight-rules.js', 'lib/delights.css', 'lib/cart-icon.js', 'lib/pay-stamp.js', 'lib/home-delights.js', 'lib/sound-setting.js', 'lib/seasonal.js',
  'shop/shop-climb.js', 'shop/shop-climb.css', 'shop/shop-crew.js',
  'lib/prestige-celebration.js', 'brand/prestige-celebration.css', 'lib/run-state.js', 'lib/run-state.css', 'lib/signal-line.js', 'lib/signal-line.css',
  'loading/loading.js', 'loading/loading.css',
  'reveal/reveal.js', 'reveal/reveal.css',
  'pay/pay.js', 'pay/pay.css',
  'shop/cosmetics.js',
  'screens/home/home.js', 'screens/home/home.css',
  'screens/profile/profile.js', 'screens/profile/profile.css',
  'screens/photo/photo.js', 'screens/photo/photo.css', 'screens/peek/peek.js', 'screens/peek/peek.css',
  'icons/phosphor/basketball.svg', 'icons/phosphor/sneaker.svg', 'icons/phosphor/sneaker-move.svg', 'icons/phosphor/person-simple-run.svg', 'icons/phosphor/trophy.svg', 'icons/phosphor/flame.svg', 'icons/phosphor/crown.svg', 'icons/phosphor/crown-simple.svg', 'icons/phosphor/medal.svg', 'icons/phosphor/lightning.svg', 'icons/phosphor/lightning-a.svg', 'icons/phosphor/rocket.svg', 'icons/phosphor/barbell.svg', 'icons/phosphor/star.svg', 'icons/phosphor/fire.svg', 'icons/phosphor/target.svg', 'icons/phosphor/hand-fist.svg', 'icons/phosphor/shooting-star.svg', 'icons/phosphor/smiley-sticker.svg', 'icons/phosphor/heart.svg',
  'screens/leaderboard/leaderboard.js', 'screens/leaderboard/leaderboard.css',
  'screens/court-view/court-view.js',
  'icons/characters/picture.js', 'icons/characters/set/a01.svg', 'icons/characters/set/a02.svg', 'icons/characters/set/a03.svg', 'icons/characters/set/a04.svg', 'icons/characters/set/a05.svg', 'icons/characters/set/a06.svg', 'icons/characters/set/a07.svg', 'icons/characters/set/a08.svg', 'icons/characters/set/a09.svg', 'icons/characters/set/a10.svg', 'icons/characters/set/a11.svg', 'icons/characters/set/a12.svg', 'icons/characters/set/a13.svg', 'icons/characters/set/a14.svg', 'icons/characters/set/a15.svg', 'icons/characters/set/a16.svg', 'icons/characters/set/a17.svg', 'icons/characters/set/a18.svg', 'icons/characters/set/a19.svg', 'icons/characters/set/a20.svg', 'icons/characters/set/a21.svg', 'icons/characters/set/a22.svg', 'icons/characters/set/a23.svg', 'icons/characters/set/a24.svg', 'icons/characters/set/a25.svg', 'icons/characters/set/a26.svg', 'icons/characters/set/a27.svg', 'icons/characters/set/a28.svg', 'icons/characters/set/a29.svg', 'icons/characters/set/a30.svg', 'icons/characters/set/a31.svg', 'icons/characters/set/a32.svg', 'icons/characters/set/a33.svg', 'icons/characters/set/a34.svg', 'icons/characters/set/a35.svg', 'icons/characters/set/a36.svg', 'icons/characters/set/a37.svg', 'icons/characters/set/a38.svg', 'icons/characters/set/a39.svg', 'icons/characters/set/a40.svg', 'icons/characters/set/a41.svg', 'icons/characters/set/a42.svg', 'icons/characters/set/a43.svg', 'icons/characters/set/a44.svg', 'icons/characters/set/a45.svg', 'icons/characters/set/a46.svg', 'icons/characters/set/a47.svg', 'icons/characters/set/a48.svg', 'icons/characters/set/a49.svg', 'icons/characters/set/a50.svg',
  'screens/live/live.js', 'screens/live/live.css', 'screens/live/live-feed.js', 'screens/live/live-scoreboard.js', 'screens/live/score-card.js', 'lib/load-timeout.js', 'lib/live-cadence.js',
  'onboarding/onboarding.js', 'onboarding/onboarding.css', 'lib/pull-refresh.js', 'lib/pull-refresh.css',
  'screens/more/more.js', 'screens/more/more.css',
  'screens/achievements/achievements.js', 'screens/achievements/achievements.css',
  'share-card/share-card.js', 'screens/calendar/calendar.js', 'screens/calendar/calendar.css', 'screens/invite/invite.js', 'screens/invite/invite.css',
  'screens/my-account/my-account.js', 'screens/my-account/my-account.css',
  'shop/shop.html', 'shop/shop.js', 'shop/shop.css', 'shop/shop-backend.js', 'shop/shop-rules.js',
  'shop/shop-v2.html', 'shop/shop-v2.js', 'shop/shop-v2.css', 'shop/shop-rules-v2.js', 'shop/catalogue.js', 'shop/shop-effects.css', 'shop/shop-effects.js', 'shop/shop-looks.css', 'shop/shop-builder.js', 'shop/shop-builder.css', 'shop/shop-v2-final.js',
  'fonts/barlow-400.woff2', 'fonts/barlow-600.woff2', 'fonts/barlow-700.woff2', 'fonts/barlowcondensed-700.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon-180.png',
  'icons/characters/picker.css', 'icons/icon-32.png', 'lib/lineup-gate.js', 'lib/night-shape.js', 'lib/run-day.js', 'mvp-backend.js', 'screens/head-to-head/head-to-head.css', 'screens/head-to-head/head-to-head.js', 'screens/mvp/mvp.css', 'screens/mvp/mvp.js', 'screens/push/push.css', 'screens/push/push.js', 'screens/recap/recap.css', 'screens/recap/recap.js', 'screens/recap/recap-loader.js', 'screens/recap/recap-box.js', 'screens/stats-board/stats-board.css', 'screens/stats-board/stats-board.js', 'screens/streaks/streaks.css', 'screens/streaks/streaks.js', 'shop-visible/shop-strip.css', 'shop-visible/shop-strip.js', 'wording-56.js',
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

// Run alerts (Web Push). The server sends a small JSON: { title, body, tag, url }. Nothing else is read here.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(String(d.title || NAMES.brand).slice(0, 80), {
    body: String(d.body || '').slice(0, 160),
    tag: String(d.tag || 'run-alert'),
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: String(d.url || 'app.html#home') }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || 'app.html#home';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) { c.postMessage({ type: 'alert-tap', url }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fromNetworkOrSaved(req));
});

// r8: the network gets a short head start. After SLOW_MS with no answer the saved copy is shown (if there is one),
// and the network answer still arrives in the background and refreshes the saved copy. A failed network uses the saved copy at once.
const SLOW_MS = 3000;
function fromNetworkOrSaved(req) {
  return new Promise(resolve => {
    let done = false;
    const finish = res => { if (!done) { done = true; resolve(res); } };
    const saved = () => caches.match(req, { ignoreSearch: true }).then(hit =>
      hit || (req.mode === 'navigate' ? caches.match('offline.html') : null) || Response.error()
    );
    const timer = setTimeout(() => {
      caches.match(req, { ignoreSearch: true }).then(hit => { if (hit) finish(hit); }).catch(() => {});
    }, SLOW_MS);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (res.ok && res.type === 'basic') {
        caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
      }
      finish(res);
    }).catch(() => {
      clearTimeout(timer);
      saved().then(finish);
    });
  });
}
