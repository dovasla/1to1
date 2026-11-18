// 1TO1 player app: "Run tonight" alert hook (v131). Browser only, guarded: does nothing if anything is missing.
// Called from app.js after a night loads: PlayerRunAlerts.onNight(night).
// Fires once per day when the first game of the night starts today, through PlayerAlerts (lib/player-alerts.js).
// Global: window.PlayerRunAlerts.
(function (root) {
  'use strict';
  var SENT_KEY = 'p1to1.alerts.runTonightDay';

  function store() { try { return root.localStorage; } catch (e) { return null; } }
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hhmm(d) {
    var h = d.getHours(), m = d.getMinutes();
    return (h % 12 || 12) + (m ? ':' + (m < 10 ? '0' : '') + m : '') + (h < 12 ? ' am' : ' pm');
  }

  // The first timed game of the night, or null. Pure.
  function firstStart(night) {
    var games = (night && Array.isArray(night.games)) ? night.games : [];
    var times = games.map(function (g) { return Date.parse(g && g.startsAt); }).filter(function (t) { return t > 0; });
    if (!times.length) return null;
    return new Date(Math.min.apply(null, times));
  }

  function onNight(night, now) {
    try {
      var when = firstStart(night);
      if (!when) return Promise.resolve(false);
      var today = now || new Date();
      if (dayKey(when) !== dayKey(today)) return Promise.resolve(false);
      if (night && night.ended === true) return Promise.resolve(false);
      var s = store();
      if (s && s.getItem(SENT_KEY) === dayKey(today)) return Promise.resolve(false);
      var A = root.PlayerAlerts;
      if (!A || !root.navigator || !root.navigator.serviceWorker) return Promise.resolve(false);
      return root.navigator.serviceWorker.ready.then(function (reg) {
        return A.deliver('run-tonight', { time: hhmm(when) }, { registration: reg, now: today });
      }).then(function (shown) {
        if (shown && s) s.setItem(SENT_KEY, dayKey(today));
        return shown;
      }, function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  var api = { onNight: onNight, firstStart: firstStart, hhmm: hhmm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerRunAlerts = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
