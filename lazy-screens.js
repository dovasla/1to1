// 1TO1 player app: loads the screen scripts and stylesheets once, after sign-in (lazy-load, integrator port 15 Nov).
// Order matters: the list keeps the original page order. LazyScreens.load(done) calls done once everything is in.
(function (root) {
  'use strict';
  var STYLES = [
 "reveal/reveal.css",
 "screens/home/home.css",
 "screens/profile/profile.css",
 "screens/leaderboard/leaderboard.css",
 "screens/live/live.css",
 "pay/pay.css",
 "pay-first/pay-first.css",
 "screens/more/more.css",
 "screens/calendar/calendar.css",
 "screens/recap/recap.css",
 "screens/streaks/streaks.css",
 "screens/rsvp/rsvp.css",
 "screens/seasons/seasons.css",
 "screens/achievements/achievements.css",
 "screens/invite/invite.css",
 "screens/checkin/checkin.css",
 "screens/night-status/night-status.css",
 "screens/stats-board/stats-board.css",
 "onboarding/onboarding.css",
 "screens/prestige/prestige.css",
 "screens/mvp/mvp.css",
 "screens/push/push.css",
 "shop/shop-climb.css",
 "prestige-celebration.css",
 "screens/head-to-head/head-to-head.css",
 "screens/my-account/my-account.css",
 "screens/home/tonight-count.css"
];
  var SCRIPTS = [
 "share-card/share-card.js",
 "screens/night-time/night-time.js",
 "reveal/reveal.js",
 "shop/cosmetics.js",
 "shop/shop-rules.js",
 "shop/shop-backend.js",
 "mvp-backend.js",
 "screens/mvp/mvp.js",
 "screens/profile/profile-stats.js",
 "screens/prestige/prestige.js",
 "screens/calendar/calendar.js",
 "screens/home/home.js",
 "receipt/receipt.js",
 "screens/profile/profile.js",
 "screens/leaderboard/leaderboard.js",
 "screens/live/live-feed.js",
 "screens/live/live.js",
 "pay/pay.js",
 "pay-first/pay-first.js",
 "screens/more/more.js",
  "screens/streaks/streaks.js",
 "screens/rsvp/rsvp.js",
 "screens/seasons/seasons.js",
 "screens/achievements/achievements.js",
 "screens/invite/invite.js",
 "screens/checkin/checkin.js",
 "screens/night-status/night-status.js",
 "screens/recap/recap.js",
 "screens/stats-board/stats-board.js",
 "screens/push/push.js",
 "prestige-celebration.js",
 "screens/head-to-head/head-to-head.js",
 "screens/my-account/my-account.js",
 "lib/tonight-count.js",
 "screens/home/tonight-count.js"
];
  var state = 'idle', waiting = [];

  function addStyle(href) {
    return new Promise(function (resolve) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      l.onload = l.onerror = function () { resolve(); };
      document.head.appendChild(l);
    });
  }
  function addScript(src) {
    return new Promise(function (resolve) {
      var sc = document.createElement('script');
      sc.src = src; sc.async = false;
      sc.onload = sc.onerror = function () { resolve(); };
      document.body.appendChild(sc);
    });
  }
  function run() {
    return Promise.all(STYLES.map(addStyle)).then(function () {
      return SCRIPTS.reduce(function (chain, src) { return chain.then(function () { return addScript(src); }); }, Promise.resolve());
    });
  }
  root.LazyScreens = {
    load: function (done) {
      if (state === 'done') { done(); return; }
      waiting.push(done);
      if (state === 'loading') return;
      state = 'loading';
      run().then(function () {
        state = 'done';
        var list = waiting; waiting = [];
        list.forEach(function (fn) { fn(); });
      });
    },
    STYLES: STYLES, SCRIPTS: SCRIPTS
  };
})(typeof window !== 'undefined' ? window : globalThis);
