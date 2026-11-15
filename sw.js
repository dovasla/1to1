// 1TO1 player app offline cache. Same pattern as organiser-v9/sw.js (network first, saved copy when offline).
// Bump CACHE on every player build so installed copies pick up the new files.
// This file never reads or writes localStorage, IndexedDB or cookies.
// Only same-origin GET requests are handled and saved. The online database and any other
// cross-origin call go straight to the network and are never saved.
importScripts('./push-sw.js');
const CACHE = 'player-shell-1-r50';
// Weak signal (F7): a slow network answer is replaced by the saved copy after 3.5 seconds.
const NET_WAIT_MS = 3500;
const SHELL = [
  './', 'signup.html', 'app.html', 'night.html', 'offline.html',
  'manifest.webmanifest', 'pwa.js', 'pwa.css',
  'app.css', 'app-tokens.css', 'keyboard-submit.css', 'app-shell.css',
  'push-sw.js', 'screens/push/push.js', 'screens/push/push.css',
  'prestige-celebration.js', 'prestige-celebration.css',
  'screens/head-to-head/head-to-head.js', 'screens/head-to-head/head-to-head.css',
  'config.js', 'rules.js', 'backend.js', 'app.js',
  'screens/my-account/my-account.js', 'screens/my-account/my-account.css',
  'lib/tonight-count.js', 'screens/home/tonight-count.js', 'screens/home/tonight-count.css',
  'weak-signal/signal.js', 'weak-signal/signal-ui.js', 'weak-signal/signal.css', 'lazy-screens.js',
  'lib/xp.js', 'lib/xp-server.js', 'lib/player-name.js', 'lib/player-name.css',
  'mvp-backend.js', 'screens/mvp/mvp.js', 'screens/mvp/mvp.css',
  'screens/live/live-feed.js', 'screens/profile/profile-stats.js', 'screens/prestige/prestige.js', 'screens/prestige/prestige.css',
  'loading/loading.js', 'loading/loading.css',
  'reveal/reveal.js', 'reveal/reveal.css',
  'pay/pay.js', 'pay/pay.css',
  'pay-first/pay-first.js', 'pay-first/pay-first.css', 'shop/shop.js',
  'shop/cosmetics.js',
  'screens/home/home.js', 'screens/home/home.css',
  'screens/calendar/calendar.js', 'screens/calendar/calendar.css',
  'onboarding/onboarding.js', 'onboarding/onboarding.css',
  'screens/live/live.js', 'screens/live/live-feed.js', 'screens/live/live.css',
  'screens/streaks/streaks.js', 'screens/streaks/streaks.css',
  'screens/rsvp/rsvp.js', 'screens/rsvp/rsvp.css',
  'screens/night-status/night-status.js', 'screens/night-status/night-status.css',
  'share-card/share-card.js', 'screens/night-time/night-time.js',
  'screens/seasons/seasons.js', 'screens/seasons/seasons.css',
  'screens/achievements/achievements.js', 'screens/achievements/achievements.css',
  'screens/invite/invite.js', 'screens/invite/invite.css',
  'screens/checkin/checkin.js', 'screens/checkin/checkin.css',
  'signup-3box.html', 'signup-3box/signup-3box.js', 'signup-3box/signup-3box.css', 'under18/under18.js',
  'screens/recap/recap.js', 'screens/recap/recap.css',
  'screens/stats-board/stats-board.js', 'screens/stats-board/stats-board.css',
  'screens/profile/profile.js', 'screens/profile/profile.css',
  'screens/leaderboard/leaderboard.js', 'screens/leaderboard/leaderboard.css',
  'screens/live/live.js', 'screens/live/live.css',
  'screens/more/more.js', 'screens/more/more.css',
  'shop/shop.html', 'shop/shop.js', 'shop/shop.css', 'shop/shop-backend.js', 'shop/shop-rules.js',
  'fonts/barlow-400.woff2', 'fonts/barlow-600.woff2', 'fonts/barlow-700.woff2', 'fonts/barlowcondensed-700.woff2',
  'icons/icon-192-v2.png', 'icons/icon-512-v2.png', 'icons/maskable-512-v2.png', 'icons/apple-touch-icon-180-v2.png'
];

self.addEventListener('install', e => {
  // Each file is added on its own, so one missing file cannot stop the app from installing.
  e.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' makes sure the install copies the newest files, not an old HTTP-cached copy.
      .then(c => Promise.all(SHELL.map(url => c.add(new Request(url, { cache: 'reload' })).catch(() => null))))
  );
  // No skipWaiting here: the new version waits until the player taps "New version ready" (pwa.js).
});

// The page asks for the switch only when the player taps the update bar.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function offlineAnswer(req) {
  return caches.match(req, { ignoreSearch: true }).then(hit =>
    hit || (req.mode === 'navigate' ? caches.match('offline.html') : Response.error())
  );
}

// Network answer, or the saved copy after NET_WAIT_MS. The network answer is still saved when it arrives late.
function networkThenSaved(req) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => { offlineAnswer(req).then(finish, () => finish(Response.error())); }, NET_WAIT_MS);
    fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      finish(res);
    }, () => { offlineAnswer(req).then(finish, () => finish(Response.error())); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(networkThenSaved(req));
});
