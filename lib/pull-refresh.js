/* Check Ball player app: pull to refresh (P9).
   Pull down from the top of the page to update the night, the paid mark and the live score.
   Plain JS, no framework. Pure logic is in state(); attach() wires the touch and the small bar.
   Usage:
     PlayerPullRefresh.attach({ onRefresh: function () { return Promise; } });
   The bar shows "Pull down to update", "Let go to update", then "Updating". It does not run while a sheet is open.
   Tests: tests/p9-pull-refresh.test.js (Node, no network).
*/
(function (root) {
  'use strict';

  var START_PX = 64;   // pull this far (after damping) to arm the update
  var MAX_PX = 96;     // the bar never moves further than this
  var DAMP = 0.5;      // a finger move of 100px moves the bar 50px

  // Pure: what the bar shows for a finger move of dy px. refreshing = an update is already running.
  function state(dy, refreshing) {
    if (refreshing) return { label: 'Updating', armed: false, pull: START_PX };
    var pull = Math.min(MAX_PX, Math.max(0, Number(dy) || 0) * DAMP);
    var armed = pull >= START_PX;
    return { label: armed ? 'Let go to update' : 'Pull down to update', armed: armed, pull: pull };
  }

  function attach(opts) {
    opts = opts || {};
    var doc = opts.document || (typeof document !== 'undefined' ? document : null);
    var win = opts.window || (typeof window !== 'undefined' ? window : null);
    if (!doc || !win || typeof opts.onRefresh !== 'function') return null;

    var bar = doc.createElement('div');
    bar.className = 'ptr';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    var text = doc.createElement('span');
    text.className = 'ptr-text';
    bar.appendChild(text);
    doc.body.appendChild(bar);

    var startY = null, dy = 0, refreshing = false;

    function paint(s) {
      bar.style.setProperty('--ptr-pull', s.pull + 'px');
      bar.classList.toggle('is-armed', !!s.armed);
      bar.classList.toggle('is-busy', !!refreshing);
      text.textContent = s.label;
    }
    function blocked(target) {
      return !!(target && target.closest && target.closest('.ob, .ma-overlay, input, textarea, select, [role="dialog"]'));
    }
    function atTop() { return (win.scrollY || 0) <= 0; }

    function onStart(e) {
      if (refreshing || !atTop() || blocked(e.target) || !e.touches || e.touches.length !== 1) { startY = null; return; }
      startY = e.touches[0].clientY;
      dy = 0;
    }
    function onMove(e) {
      if (startY == null || !e.touches || e.touches.length !== 1) return;
      if (!atTop()) { startY = null; paint(state(0, false)); return; }
      dy = e.touches[0].clientY - startY;
      if (dy <= 0) { paint(state(0, false)); bar.classList.remove('is-visible'); return; }
      bar.classList.add('is-visible');
      paint(state(dy, false));
    }
    function done() {
      refreshing = false;
      startY = null;
      bar.classList.remove('is-busy', 'is-armed', 'is-visible');
      bar.style.removeProperty('--ptr-pull');
      text.textContent = '';
    }
    function onEnd() {
      if (startY == null) return;
      var s = state(dy, false);
      startY = null;
      if (!s.armed) { done(); return; }
      refreshing = true;
      paint(state(0, true));
      bar.classList.add('is-visible');
      var run;
      try { run = Promise.resolve(opts.onRefresh()); } catch (err) { run = Promise.reject(err); }
      run.then(done, done);
    }

    doc.addEventListener('touchstart', onStart, { passive: true });
    doc.addEventListener('touchmove', onMove, { passive: true });
    doc.addEventListener('touchend', onEnd, { passive: true });
    doc.addEventListener('touchcancel', done, { passive: true });

    return {
      bar: bar,
      destroy: function () {
        doc.removeEventListener('touchstart', onStart);
        doc.removeEventListener('touchmove', onMove);
        doc.removeEventListener('touchend', onEnd);
        doc.removeEventListener('touchcancel', done);
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }
    };
  }

  var api = { state: state, attach: attach, START_PX: START_PX, MAX_PX: MAX_PX };
  root.PlayerPullRefresh = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
