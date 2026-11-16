/* Load timeout (one helper for every new screen).
   withTimeout(promise, ms, label): rejects with Error('timeout') after ms (default 12 s).
   run(read, opts): Promise of { state: 'ok' | 'empty' | 'error' | 'timeout', data } (never hangs).
   stateHtml(state, copy): plain message + Try again (data-retry) for error and timeout.
   Browser: window.PlayerLoadTimeout and window.LoadTimeout (same object). Node: module.exports. Plain JS. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.PlayerLoadTimeout = api; root.LoadTimeout = api; }
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis), function (root) {
  'use strict';
  var MS = 12000;
  var TEXT = { error: 'Could not load this right now.', retry: 'Try again' };

  function withTimeout(p, ms, label) {
    var t = null;
    var limit = new Promise(function (_, reject) { t = setTimeout(function () { reject(new Error('timeout' + (label ? ':' + label : ''))); }, ms || MS); });
    return Promise.race([Promise.resolve(p), limit]).then(function (v) { clearTimeout(t); return v; }, function (e) { clearTimeout(t); throw e; });
  }


  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // read(): Promise of { ok, ... }. isEmpty(data) decides 'empty'.
  function run(read, opts) {
    opts = opts || {};
    var ms = opts.ms || MS;
    var setT = opts.setTimeout || root.setTimeout, clearT = opts.clearTimeout || root.clearTimeout;
    var isEmpty = opts.isEmpty || function () { return false; };
    return new Promise(function (resolve) {
      var done = false;
      var t = setT(function () { if (!done) { done = true; resolve({ state: 'timeout', data: null }); } }, ms);
      Promise.resolve().then(read).then(function (res) {
        if (done) return; done = true; clearT(t);
        if (!res || res.ok === false) return resolve({ state: 'error', data: null });
        resolve(isEmpty(res) ? { state: 'empty', data: res } : { state: 'ok', data: res });
      }, function () {
        if (done) return; done = true; clearT(t);
        resolve({ state: 'error', data: null });
      });
    });
  }

  // Plain message + Try again for error / timeout; a calm line for empty. Retry button uses data-retry.
  function stateHtml(state, copy) {
    copy = copy || {};
    if (state === 'error' || state === 'timeout') {
      var msg = state === 'timeout' ? (copy.timeout || 'This is taking too long. Check your signal.') : (copy.error || 'Could not load this. Try again.');
      return '<div class="load-state" role="status"><p>' + esc(msg) + '</p>' +
        '<button type="button" class="load-retry" data-retry>Try again</button></div>';
    }
    if (state === 'empty') return '<div class="load-state" role="status"><p>' + esc(copy.empty || 'Nothing here yet.') + '</p></div>';
    return '';
  }

  return { MS: MS, LIMIT: MS, LIMIT_MS: MS, TEXT: TEXT, withTimeout: withTimeout, run: run, stateHtml: stateHtml };
});
