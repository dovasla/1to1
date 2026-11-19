/* Prestige screen (player app). Browser: window.PlayerPrestige. Node tests: prestige.test.js.
   Rules: revamp/build/player-app-plan/XP-SYSTEM.md section 3. Server rule: supabase/migration-9-prestige.sql.
   Pure apart from bind(). No storage. The phone never decides the result: the server answers.

   Data in (all optional):
     level (1 to 60), stars (0 to 5), run (PlayerXp run object, for the progress bar), name
   Needs global PlayerXp (lib/xp.js) only when run is given.

   Prestige = level 60 only. Level goes to 1, one star is added (top 5), coins and shop items stay.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  (typeof window !== 'undefined' ? window : globalThis).PlayerPrestige = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var G = typeof window !== 'undefined' ? window : globalThis;
  var MAX_LEVEL = 60;
  var MAX_STARS = 5;
  var STEP_PCT = 10;          // +10% XP per star
  var RPC_NAME = 'player_prestige';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(n) { return (Number(n) || 0).toLocaleString('en-GB'); }
  function clamp(n, lo, hi) { n = parseInt(n, 10); if (isNaN(n)) n = lo; return Math.max(lo, Math.min(hi, n)); }

  // Everything the screen shows, worked out from the data. Pure, so tests can check it.
  function viewOf(d) {
    d = d || {};
    var level, stars, pct, toNext, xpInLevel = 0, xpForLevel = 0;
    if (d.run && G.PlayerXp) {
      var p = G.PlayerXp.progress(d.run);
      level = p.level; stars = p.stars;
      if (!p.isMax) { xpInLevel = p.xpInLevel; xpForLevel = p.xpForLevel; }
    } else {
      level = clamp(d.level, 1, MAX_LEVEL);
      stars = clamp(d.stars, 0, MAX_STARS);
    }
    var eligible = level >= MAX_LEVEL;
    if (eligible) pct = 100;
    else if (xpForLevel) pct = Math.round(xpInLevel / xpForLevel * 100);
    else pct = Math.round((level - 1) / (MAX_LEVEL - 1) * 100);

    var atTop = stars >= MAX_STARS;
    var nextStars = Math.min(stars + 1, MAX_STARS);
    return {
      name: String(d.name || ''),
      level: level,
      stars: stars,
      eligible: eligible,
      pct: pct,
      toMax: eligible ? '' : (MAX_LEVEL - level) + ' ' + (MAX_LEVEL - level === 1 ? 'level' : 'levels') + ' to Level 60',
      nowBonus: stars * STEP_PCT,
      nextStars: nextStars,
      nextBonus: nextStars * STEP_PCT,
      atTop: atTop,
      // Plain copy for the sheet. Kept in one place so the screen and the tests agree.
      resets: [
        'Your level goes back to 1',
        'Your run XP starts again. XP you earned above Level 60 carries over'
      ],
      keeps: [
        atTop ? 'Your stars, still at 5 (the top)' : 'Your stars, plus one more (' + nextStars + ' in total)',
        'Your coins and shop items',
        'Your clan tag',
        'Your skill rating, points, wins and team places',
        'Your lifetime XP and streak'
      ]
    };
  }

  function starsHtml(n) {
    var s = '';
    for (var i = 1; i <= MAX_STARS; i++) s += i <= n ? '★' : '<span class="off">☆</span>';
    return s;
  }

  // Full screen: stars, progress back to 60, and the one button (only when eligible).
  function render(d) {
    var v = viewOf(d);
    var h = '';
    h += '<header class="pr-top"><h1>Prestige Run</h1></header>';

    h += '<section class="card pr-stars" aria-labelledby="prS">' +
      '<h2 class="cap" id="prS">Your stars</h2>' +
      '<p class="pr-count" role="img" aria-label="' + v.stars + ' of ' + MAX_STARS + ' prestige stars">' + starsHtml(v.stars) + '</p>' +
      '<p class="muted">' + (v.nowBonus ? '+' + v.nowBonus + '% XP on every night' : 'No XP bonus yet') + '</p>' +
      '</section>';

    h += '<section class="card" aria-labelledby="prL">' +
      '<h2 class="cap" id="prL">Level ' + v.level + '</h2>' +
      '<div class="bar" role="progressbar" aria-label="Progress to Level 60" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v.pct + '">' +
      '<i style="width:' + v.pct + '%"></i></div>' +
      '<p class="muted">' + (v.eligible ? 'You have reached Level 60. You can prestige now.' : esc(v.toMax) + '.') + '</p>' +
      '</section>';

    if (v.eligible) {
      h += '<section class="card pr-ready" aria-labelledby="prR">' +
        '<h2 class="cap" id="prR">Ready</h2>' +
        '<p>Prestige to start again at Level 1 with a star.</p>' +
        '<button class="btn yellow pr-open" type="button" data-open-prestige>Prestige now</button>' +
        '</section>';
    } else {
      h += '<section class="card" aria-labelledby="prN"><h2 class="cap" id="prN">Next</h2>' +
        '<p class="muted">Reach Level 60 to unlock prestige. Your coins and looks stay with you.</p></section>';
    }
    h += sheetHtml(d);
    return h;
  }

  // Confirm sheet. Shown only when eligible. Nothing happens until "Prestige now" is tapped.
  function sheetHtml(d) {
    var v = viewOf(d);
    if (!v.eligible) return '';
    return '<div class="sheet-wrap" data-sheet hidden>' +
      '<div class="sheet-scrim" data-close></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="prSh">' +
      '<h2 class="sheet-title" id="prSh">Prestige now?</h2>' +
      '<p class="sheet-lead">You get <b>+1 star</b>. ' +
        (v.atTop ? 'You are already at the top, so stars stay at 5.' : 'Next: <b>+' + v.nextBonus + '% XP</b> on every night.') + '</p>' +
      '<h3 class="cap">What resets</h3><ul class="list">' +
        v.resets.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<h3 class="cap">What you keep</h3><ul class="list">' +
        v.keeps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<p class="sheet-err" data-error aria-live="polite"></p>' +
      '<div class="sheet-btns">' +
        '<button class="btn" type="button" data-close>Not yet</button>' +
        '<button class="btn yellow" type="button" data-confirm>Prestige now</button>' +
      '</div>' +
      '</div></div>';
  }

  // Short block for the profile: stars, and a button into the prestige screen.
  function profileBlock(d) {
    var v = viewOf(d);
    var h = '<div class="pr-profile">' +
      '<span class="pr-profile-stars" role="img" aria-label="' + v.stars + ' of ' + MAX_STARS + ' prestige stars">' + starsHtml(v.stars) + '</span>' +
      '<span class="muted">' + (v.nowBonus ? '+' + v.nowBonus + '% XP' : 'No XP bonus yet') + '</span>';
    if (v.eligible) h += '<a class="btn yellow" href="#prestige">Prestige now</a>';
    return h + '</div>';
  }

  // Calls the server through an injected function: rpc(name, args) -> Promise<json>.
  // Result is always { ok, repeat, level, stars, error }. The server decides; the phone only shows it.
  function act(rpc, token, requestId) {
    return Promise.resolve()
      .then(function () { return rpc(RPC_NAME, { p_token: token, p_request: requestId }); })
      .then(function (r) {
        if (r && r.ok) return { ok: true, repeat: !!r.repeat, level: r.level, stars: r.stars, error: '' };
        var why = r && r.reason;
        if (why === 'not-max-level') return { ok: false, error: 'You need Level 60 to prestige.' };
        if (why === 'not-signed-in') return { ok: false, error: 'Sign in again to prestige.' };
        return { ok: false, error: 'Could not prestige. Try again.' };
      }, function () {
        return { ok: false, error: 'No signal. Your prestige did not go through. Try again.' };
      });
  }

  // One id per tap, so a retry after a dropped connection cannot prestige twice.
  function newRequestId() {
    var r = Math.random().toString(36).slice(2, 10);
    return 'pr-' + Date.now().toString(36) + '-' + r;
  }

  // Wires the sheet. opts: { rpc, token, onDone(result), newId? }. Re-render with fresh data in onDone.
  function bind(container, opts) {
    var sheet = container.querySelector('[data-sheet]');
    if (!sheet) return;
    var openBtn = container.querySelector('[data-open-prestige]');
    var confirmBtn = sheet.querySelector('[data-confirm]');
    var err = sheet.querySelector('[data-error]');
    var busy = false;
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      sheet.hidden = false;
      var first = sheet.querySelector('[data-confirm]');
      if (first) first.focus({ preventScroll: true });
    }
    function close() {
      if (busy) return;
      sheet.hidden = true;
      if (err) err.textContent = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    if (openBtn) openBtn.addEventListener('click', open);
    sheet.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });

    confirmBtn.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Prestiging…';
      var id = (opts.newId || newRequestId)();
      act(opts.rpc, opts.token, id).then(function (res) {
        busy = false;
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Prestige now';
        if (!res.ok) { if (err) err.textContent = res.error; return; }
        sheet.hidden = true;
        if (opts.onDone) opts.onDone(res);
      });
    });
  }

  return {
    MAX_LEVEL: MAX_LEVEL,
    MAX_STARS: MAX_STARS,
    RPC_NAME: RPC_NAME,
    viewOf: viewOf,
    render: render,
    sheetHtml: sheetHtml,
    profileBlock: profileBlock,
    act: act,
    newRequestId: newRequestId,
    bind: bind,
    starsHtml: starsHtml
  };
});
