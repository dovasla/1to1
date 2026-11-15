/* Prestige celebration (player app). One full-screen moment per prestige: a star slams in, 3 seconds, tap to close.
   Browser: window.PlayerCelebrate. Node tests: tests/prestige-celebration.test.js.
   Rules: revamp/build/player-app-plan/XP-SYSTEM.md section 3 ("Prestige: full screen, a star slams in, 3 seconds. Once per prestige.")
          DECISIONS-AND-BRAND.md section 4 (three reward moments only; one exclamation mark, on prestige).
   Reduced motion: the celebration is OFF. The caller shows its plain text line instead (see HOOKS.md).
   Never stores the PIN. Only the number of stars celebrated is kept on the phone, in localStorage.

   Usage:
     PlayerCelebrate.maybePlay({ stars: 2, reduce: false, onDone: function () {} });   // plays once per new star
     PlayerCelebrate.play({ stars: 2, reduce: false, onDone: fn });                    // always plays (tests, demo)
     PlayerCelebrate.shouldPlay(stars, store) / markPlayed(stars, store)                // store: { getItem, setItem }
*/
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerCelebrate = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var KEY = '1to1-prestige-celebrated';   // the highest star count already celebrated
  var TOTAL_MS = 3000;                    // whole moment, as the spec says
  var SLAM_MS = 600;                      // the star lands
  var FADE_MS = 300;                      // fade out at the end
  var MAX_STARS = 5;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Plays once per new star: a player who has already seen "star 2" never sees it again.
  function savedStars(store) {
    try {
      var raw = store && store.getItem(KEY);
      var n = parseInt(raw, 10);
      return isNaN(n) ? 0 : Math.max(0, Math.min(MAX_STARS, n));
    } catch (e) { return 0; }   // blocked storage: treat as not seen, so the moment can show once
  }
  function shouldPlay(stars, store) {
    var s = parseInt(stars, 10);
    return !isNaN(s) && s >= 1 && s <= MAX_STARS && s > savedStars(store);
  }
  function markPlayed(stars, store) {
    try { if (store) store.setItem(KEY, String(parseInt(stars, 10))); } catch (e) { /* private window: may show again next visit */ }
  }

  // The timing plan. Pure, so tests can check it. reduce = true means the celebration is off.
  function plan(reduce) {
    if (reduce) return { mode: 'off', totalMs: 0, slamMs: 0, fadeMs: 0 };
    return { mode: 'full', totalMs: TOTAL_MS, slamMs: SLAM_MS, fadeMs: FADE_MS };
  }

  function copy(stars) {
    var s = parseInt(stars, 10) || 1;
    return {
      title: 'Prestige done!',
      star: 'Star ' + s + ' of ' + MAX_STARS,
      line: 'Back to Level 1. +1,000 coins, and your look stays.'
    };
  }

  function markup(stars) {
    var c = copy(stars);
    return '<div class="pc-scrim"></div>' +
      '<div class="pc-card" role="dialog" aria-modal="true" aria-labelledby="pcTitle">' +
        '<div class="pc-star" aria-hidden="true">' +
          '<svg viewBox="0 0 48 48"><path d="M24 4.5l5.9 12.6 13.8 1.7-10.2 9.4 2.7 13.7L24 34.8 11.8 41.9l2.7-13.7L4.3 18.8l13.8-1.7z"/></svg>' +
        '</div>' +
        '<p class="pc-kicker">' + esc(c.star) + '</p>' +
        '<h2 class="pc-title" id="pcTitle">' + esc(c.title) + '</h2>' +
        '<p class="pc-line">' + esc(c.line) + '</p>' +
        '<p class="pc-tap">Tap to continue</p>' +
      '</div>';
  }

  // Shows the moment. Returns { close() } and calls onDone once, when it closes.
  function play(opts) {
    opts = opts || {};
    var done = false;
    var doc = root && root.document;
    var p = plan(!!opts.reduce);
    var handle = { plan: p, close: close };

    function finish() { if (done) return; done = true; if (typeof opts.onDone === 'function') opts.onDone(); }

    if (p.mode === 'off' || !doc) { finish(); return handle; }

    var el = doc.createElement('div');
    el.className = 'pc-overlay';
    el.innerHTML = markup(opts.stars);
    doc.body.appendChild(el);
    var timers = [];
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      timers.forEach(function (t) { clearTimeout(t); });
      doc.removeEventListener('keydown', onKey);
      el.classList.add('pc-out');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        finish();
      }, p.fadeMs);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    el.addEventListener('click', close);
    doc.addEventListener('keydown', onKey);
    timers.push(setTimeout(close, p.totalMs - p.fadeMs));
    // Move focus to the card so a keyboard or screen reader user lands on the moment.
    var card = el.querySelector('.pc-card');
    if (card && card.focus) { try { card.setAttribute('tabindex', '-1'); card.focus({ preventScroll: true }); } catch (e) { /* older browser */ } }
    return handle;
  }

  // The one call the app makes after a successful prestige. Plays only if this star is new.
  function maybePlay(opts) {
    opts = opts || {};
    var store = opts.store || (root && root.localStorage);
    var reduce = !!opts.reduce;
    if (!shouldPlay(opts.stars, store)) { if (typeof opts.onDone === 'function') opts.onDone(); return null; }
    markPlayed(opts.stars, store);
    return play({ stars: opts.stars, reduce: reduce, onDone: opts.onDone });
  }

  return {
    KEY: KEY, TOTAL_MS: TOTAL_MS, SLAM_MS: SLAM_MS, FADE_MS: FADE_MS,
    savedStars: savedStars, shouldPlay: shouldPlay, markPlayed: markPlayed,
    plan: plan, copy: copy, markup: markup, play: play, maybePlay: maybePlay
  };
});
