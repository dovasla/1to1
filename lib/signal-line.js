/* Player app: weak-signal line (P12). A plain line when the signal is poor. It never stops the player:
   requests are not cancelled, no screen is blocked, typed input is never touched.
   - A server call still pending after 4 seconds shows the line.
   - A call that fails with no network, or answers timeout/offline, shows the line.
   - The next call that succeeds hides it.
   Browser: window.PlayerSignalLine. Node: module.exports (tests inject doc and timers).
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerSignalLine = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var SLOW_MS = 4000;
  var MESSAGE = 'Signal is weak. Your screen may be a little out of date.';

  function isWeakAnswer(v) {
    return !!(v && v.ok === false && (v.reason === 'timeout' || v.reason === 'offline'));
  }
  function isNetworkError(e) {
    return !!(e && (e.name === 'TypeError' || e.name === 'AbortError' || e.signal === 'offline' || e.signal === 'timeout'));
  }

  // opts.doc: document (or a stub). opts.setTimeout / clearTimeout: injectable for tests.
  function create(opts) {
    var o = opts || {};
    var doc = o.doc || (typeof document !== 'undefined' ? document : null);
    var st = o.setTimeout || function (fn, ms) { return setTimeout(fn, ms); };
    var ct = o.clearTimeout || function (id) { clearTimeout(id); };
    var line = null;

    function ensure() {
      if (line || !doc || !doc.createElement) return;
      line = doc.createElement('p');
      line.id = 'sigLine';
      line.className = 'sig-line';
      line.setAttribute('role', 'status');
      line.textContent = MESSAGE;
      line.hidden = true;
      if (doc.body) doc.body.appendChild(line);
    }
    function show() { ensure(); if (line) line.hidden = false; }
    function hide() { if (line) line.hidden = true; }
    function visible() { return !!(line && !line.hidden); }

    // Wraps every method of a backend object. Results and errors pass through unchanged.
    function wrap(be) {
      var out = {};
      Object.keys(be).forEach(function (k) {
        if (typeof be[k] !== 'function') { out[k] = be[k]; return; }
        out[k] = function () {
          var r = be[k].apply(be, arguments);
          if (!r || typeof r.then !== 'function') return r;   // not a promise: pass through
          var pending = true;
          var timer = st(function () { if (pending) show(); }, SLOW_MS);
          return r.then(function (v) {
            pending = false; ct(timer);
            if (isWeakAnswer(v)) show(); else hide();
            return v;
          }, function (e) {
            pending = false; ct(timer);
            if (isNetworkError(e)) show();
            throw e;
          });
        };
      });
      return out;
    }

    return { wrap: wrap, show: show, hide: hide, visible: visible, MESSAGE: MESSAGE };
  }

  return { SLOW_MS: SLOW_MS, MESSAGE: MESSAGE, create: create, isWeakAnswer: isWeakAnswer };
});
