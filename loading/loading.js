/* Loading screen (player app). Option A, map card.
   Usage:
     PlayerLoading.run({ mapName: 'New College', then: function () { ... } });
   Hand-off into the lineup reveal:
     PlayerLoading.run({ mapName: g.mapName, then: function () { LineupReveal.open(lineup, opts); } });
   Options: mapName, photo (image URL or null), tips (array), durationMs, then(), reduce (force).
   Tap SKIP or press Escape to go on at once. Never longer than durationMs (default 2.2 s).
   Global: window.PlayerLoading = { run, TIMING, TIPS, markup }. Node: module.exports.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerLoading = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TIMING = {
    totalMs: 2200,   // whole screen, when motion is on
    reduceMs: 600,   // reduced motion: short hold, no animation
    tipMs: 700,      // tip change
    fadeMs: 220      // fade out
  };
  var TIPS = [
    'TIP: PASS BEFORE YOU SHOOT',
    'TIP: HANDS UP ON DEFENCE',
    'TIP: ROTATE ON EVERY WHISTLE',
    'TIP: BIBS ON, BALL UP'
  ];
  var current = null;

  function hasDoc() { return typeof document !== 'undefined'; }
  function reduceMotion() {
    return typeof window !== 'undefined' && !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Court lines: the same drawing as the approved option A.
  var COURT = '<svg viewBox="0 0 300 180" fill="none" stroke="#F4F5F7" stroke-width="3" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="6" y="6" width="288" height="168"/><line x1="150" y1="6" x2="150" y2="174"/>' +
    '<circle cx="150" cy="90" r="26"/><rect x="6" y="58" width="52" height="64"/>' +
    '<rect x="242" y="58" width="52" height="64"/><path d="M6 22Q104 90 6 158"/>' +
    '<path d="M294 22Q196 90 294 158"/><circle cx="58" cy="90" r="5"/><circle cx="242" cy="90" r="5"/></svg>';

  // Pure markup builder (no DOM needed). Names and tips are escaped.
  function markup(o) {
    o = o || {};
    var photo = o.photo ? '<img class="pl-photo" src="' + esc(o.photo) + '" alt="" ' +
      'onerror="this.remove()">' : '';
    var tips = (o.tips && o.tips.length ? o.tips : TIPS).map(function (t, i) {
      return '<p' + (i === 0 ? ' class="on"' : '') + '>' + esc(t) + '</p>';
    }).join('');
    return '<div class="pl-wrap">' +
      '<div class="pl-top"><span>1TO1 PICKUP</span>' +
      '<button class="pl-skip" type="button" data-pl="skip">SKIP</button></div>' +
      '<div class="pl-card">' +
        '<div class="pl-court">' + photo + COURT + '<span class="pl-tag pl-blink">NOW LOADING</span></div>' +
        '<h1>' + esc(o.mapName || 'New College') + '</h1>' +
        '<p class="pl-sub">MAP 01 · GET READY</p>' +
      '</div>' +
      '<div class="pl-foot">' +
        '<div class="pl-row"><span data-pl="status">LOADING COURT</span><span data-pl="pct">0%</span></div>' +
        '<div class="pl-bar" role="progressbar" aria-label="Loading" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
          '<i data-pl="bar"></i></div>' +
        '<div class="pl-tips" aria-live="polite">' + tips + '</div>' +
      '</div>' +
    '</div>';
  }

  function cancel() {
    if (!current) return;
    clearInterval(current.timer);
    clearInterval(current.tipTimer);
    if (current.el && current.el.parentNode) current.el.parentNode.removeChild(current.el);
    current = null;
  }

  // Runs the loading screen once, then calls opts.then(). Returns a handle with skip().
  function run(opts) {
    opts = opts || {};
    var then = typeof opts.then === 'function' ? opts.then : function () {};
    if (!hasDoc()) { then(); return null; }

    cancel(); // a new run replaces any screen still on show

    var reduce = reduceMotion() || opts.reduce === true;
    var total = opts.durationMs || (reduce ? TIMING.reduceMs : TIMING.totalMs);
    var tips = opts.tips && opts.tips.length ? opts.tips : TIPS;

    var el = document.createElement('div');
    el.className = 'pl-load';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Loading ' + (opts.mapName || 'New College'));
    el.innerHTML = markup({ mapName: opts.mapName, photo: opts.photo, tips: tips });
    document.body.appendChild(el);

    var state = { el: el, timer: null, tipTimer: null, done: false };
    current = state;

    var bar = el.querySelector('[data-pl="bar"]');
    var pct = el.querySelector('[data-pl="pct"]');
    var status = el.querySelector('[data-pl="status"]');
    var track = el.querySelector('.pl-bar');
    var skipBtn = el.querySelector('[data-pl="skip"]');
    var start = Date.now();

    function setProgress(p) {
      p = Math.max(0, Math.min(100, Math.round(p)));
      bar.style.width = p + '%';
      pct.textContent = p + '%';
      track.setAttribute('aria-valuenow', String(p));
    }

    function finish() {
      if (state.done) return;
      state.done = true;
      clearInterval(state.timer);
      clearInterval(state.tipTimer);
      setProgress(100);
      status.textContent = 'READY';
      document.removeEventListener('keydown', onKey);
      el.classList.add('pl-out');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (current === state) current = null;
        then();
      }, reduce ? 0 : TIMING.fadeMs);
    }

    function onKey(e) { if (e.key === 'Escape') finish(); }
    document.addEventListener('keydown', onKey);
    skipBtn.addEventListener('click', finish);

    // Progress by clock, so it finishes on time even if frames are dropped.
    state.timer = setInterval(function () {
      var p = reduce ? 100 : (Date.now() - start) / total * 100;
      setProgress(p);
      if (p >= 100) finish();
    }, 40);

    // Tips rotate; reduced motion shows the first tip only.
    if (!reduce && tips.length > 1) {
      var idx = 0;
      var ps = el.querySelectorAll('.pl-tips p');
      state.tipTimer = setInterval(function () {
        ps[idx].classList.remove('on');
        idx = (idx + 1) % ps.length;
        ps[idx].classList.add('on');
      }, TIMING.tipMs);
    }

    if (skipBtn.focus) skipBtn.focus();

    return { skip: finish, cancel: cancel };
  }

  return { run: run, cancel: cancel, markup: markup, TIMING: TIMING, TIPS: TIPS };
});
