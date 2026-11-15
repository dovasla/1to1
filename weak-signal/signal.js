/* 1TO1 player app: weak-signal core (F7). No DOM here, so it runs in Node tests and in the browser.
   - Every server call gets an 8 second time-out and one plain message: "No signal. Try again, or see the organiser."
   - No raw error text ever reaches a player. Server 500s and unknown errors use the same message.
   - Last known run is saved on the phone (per-viewer convenience only). Failed saves never throw.
   - A new app version is held while a run is on (2 hours before the first game until the run closes).
   Plain JS, no packages. Global: window.PlayerSignal. Node: module.exports.
   Typed input is never touched here: screens keep what the player typed and retry on tap.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerSignal = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TIMEOUT_MS = 8000;
  var MESSAGE = 'No signal. Try again, or see the organiser.';
  var RUN_KEY = '1to1-player-last-run';
  var HOLD_BEFORE_MS = 2 * 60 * 60 * 1000;   // updates held from 2 hours before the first game
  var CLOSE_AFTER_LAST_MS = 90 * 60 * 1000;  // run counts as "on" until 90 minutes after the last game starts

  // ---------- errors: one shape for every failure ----------
  // signal is one of: 'timeout', 'offline', 'server'. message is always MESSAGE.
  function signalError(kind) {
    var e = new Error(MESSAGE);
    e.signal = kind;
    e.plain = MESSAGE;
    return e;
  }

  function isSignalError(e) { return !!(e && e.signal && e.plain === MESSAGE); }

  // Turns any thrown thing into a signal error. Never keeps the raw text.
  function toSignalError(e, isOffline) {
    if (isSignalError(e)) return e;
    if (isOffline === true) return signalError('offline');
    var text = String((e && (e.message || e.name)) || '');
    if (e && e.name === 'AbortError') return signalError('timeout');
    if (/^http-5/.test(text)) return signalError('server');
    if (e && e.name === 'TypeError') return signalError('offline');   // fetch() rejects with TypeError when there is no network
    return signalError('server');
  }

  // Race a promise against a timer. Clock is injectable so tests run without waiting.
  function withTimeout(promise, ms, clock) {
    // Wrapped, not passed by reference: a browser's setTimeout throws "Illegal invocation" when called as a property.
    var c = clock || {
      setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
      clearTimeout: function (id) { clearTimeout(id); }
    };
    var timer = null;
    var limit = new Promise(function (_, reject) {
      timer = c.setTimeout(function () { reject(signalError('timeout')); }, ms);
    });
    return Promise.race([promise, limit]).then(function (v) {
      c.clearTimeout(timer);
      return v;
    }, function (e) {
      c.clearTimeout(timer);
      throw toSignalError(e, false);
    });
  }

  // fetch() with the same 8 second rule. Non-OK HTTP answers become 'server' errors.
  // opts.fetch and opts.isOffline are injectable for tests.
  function fetchWithTimeout(url, init, opts) {
    var o = opts || {};
    var fetchFn = o.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    var ms = o.timeoutMs || TIMEOUT_MS;
    var offline = typeof o.isOffline === 'function' ? o.isOffline : function () {
      return typeof navigator !== 'undefined' && navigator.onLine === false;
    };
    if (!fetchFn) return Promise.reject(signalError('server'));
    if (offline()) return Promise.reject(signalError('offline'));
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var req = Object.assign({}, init || {}, ac ? { signal: ac.signal } : {});
    var p = Promise.resolve().then(function () { return fetchFn(url, req); }).then(function (res) {
      if (!res || !res.ok) throw signalError('server');
      return res;
    }, function (e) {
      throw toSignalError(e, offline());
    });
    var clock = o.clock;
    return withTimeout(p, ms, clock).catch(function (e) {
      if (ac && e && e.signal === 'timeout') { try { ac.abort(); } catch (x) { /* ignore */ } }
      throw e;
    });
  }

  // Wrap every method of a backend (the object from PlayerBackend.create). Each call gets the 8 second rule.
  // Methods keep their own results. Only failures change: they become signal errors.
  function wrapBackend(be, opts) {
    var o = opts || {};
    var ms = o.timeoutMs || TIMEOUT_MS;
    var out = {};
    Object.keys(be).forEach(function (k) {
      if (typeof be[k] !== 'function') { out[k] = be[k]; return; }
      out[k] = function () {
        var args = arguments;
        var p = Promise.resolve().then(function () { return be[k].apply(be, args); });
        return withTimeout(p, ms, o.clock);
      };
    });
    return out;
  }

  // ---------- last known run (saved on this phone) ----------
  // store is injectable (localStorage in the browser, memory in tests). Any failure is silent.
  function browserStore() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }

  function saveRun(payload, now, store) {
    var s = store === undefined ? browserStore() : store;
    if (!s || !payload) return false;
    try {
      s.setItem(RUN_KEY, JSON.stringify({ savedAt: now || Date.now(), payload: payload }));
      return true;
    } catch (e) { return false; }
  }

  function loadRun(store) {
    var s = store === undefined ? browserStore() : store;
    if (!s) return null;
    try {
      var raw = s.getItem(RUN_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || !v.payload || typeof v.savedAt !== 'number') return null;
      return { savedAt: v.savedAt, payload: v.payload };
    } catch (e) { return null; }
  }

  function clearRun(store) {
    var s = store === undefined ? browserStore() : store;
    if (!s) return false;
    try { s.removeItem(RUN_KEY); return true; } catch (e) { return false; }
  }

  // The signed-in player's name and level, so a phone with no signal can still open its saved run.
  // No PIN and no token here (the token is kept by the app as before).
  var ME_KEY = '1to1-player-last-me';
  function saveMe(me, store) {
    var s = store === undefined ? browserStore() : store;
    if (!s || !me || !me.first) return false;
    try {
      s.setItem(ME_KEY, JSON.stringify({ first: String(me.first), lastInitial: String(me.lastInitial || ''), level: me.level, xpLevel: me.xpLevel, status: me.status }));
      return true;
    } catch (e) { return false; }
  }
  function loadMe(store) {
    var s = store === undefined ? browserStore() : store;
    if (!s) return null;
    try {
      var raw = s.getItem(ME_KEY);
      var v = raw ? JSON.parse(raw) : null;
      return v && v.first ? v : null;
    } catch (e) { return null; }
  }
  function clearMe(store) {
    var s = store === undefined ? browserStore() : store;
    if (!s) return false;
    try { s.removeItem(ME_KEY); return true; } catch (e) { return false; }
  }

  // "Updated just now", "Updated 20 min ago", "Updated 3 h ago", "Updated 2 days ago".
  function ageText(savedAt, now) {
    var ms = (now || Date.now()) - savedAt;
    if (!(ms >= 0) || ms < 60000) return 'Updated just now';
    var mins = Math.floor(ms / 60000);
    if (mins < 60) return 'Updated ' + mins + ' min ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return 'Updated ' + hours + ' h ago';
    var days = Math.floor(hours / 24);
    return 'Updated ' + days + (days === 1 ? ' day' : ' days') + ' ago';
  }

  // ---------- update hold ----------
  // The run window comes from the night: first game start minus 2 hours, to the last game start plus 90 minutes
  // (or night.closesAt when the organiser sets one). No schedule known means nothing is running.
  function runWindow(night) {
    if (!night || !night.games || !night.games.length) return null;
    var starts = night.games.map(function (g) { return Date.parse(g.startsAt); }).filter(function (t) { return t > 0; });
    if (!starts.length) return null;
    var from = Math.min.apply(null, starts) - HOLD_BEFORE_MS;
    var to = night.closesAt ? Date.parse(night.closesAt) : Math.max.apply(null, starts) + CLOSE_AFTER_LAST_MS;
    return { from: from, to: to };
  }

  // true when a new version may take over now.
  function updateAllowed(night, now) {
    var w = runWindow(night);
    if (!w) return true;
    var t = now || Date.now();
    return t < w.from || t > w.to;
  }

  return {
    TIMEOUT_MS: TIMEOUT_MS,
    MESSAGE: MESSAGE,
    RUN_KEY: RUN_KEY,
    signalError: signalError,
    isSignalError: isSignalError,
    toSignalError: toSignalError,
    withTimeout: withTimeout,
    fetchWithTimeout: fetchWithTimeout,
    wrapBackend: wrapBackend,
    saveRun: saveRun,
    loadRun: loadRun,
    clearRun: clearRun,
    saveMe: saveMe,
    loadMe: loadMe,
    clearMe: clearMe,
    ageText: ageText,
    runWindow: runWindow,
    updateAllowed: updateAllowed
  };
});
