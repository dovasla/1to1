// 1TO1 player app: phone alert rules (v131). Plain JS, no framework.
// Five alert types, each with its own switch on this phone. Noisy ones are off by default.
//   run-tonight  a run is on tonight                   on
//   game-up      your game is up (court and time)      on   (time-sensitive: rings in quiet hours)
//   level-up     you levelled up                       on
//   rival        your rival for the week               off  (noisy)
//   recap        your weekly recap                     off  (noisy)
// Quiet hours (on by default, 10 pm to 7 am): silence every alert except game-up.
// Pure rules here. Delivery only when the player has already allowed notifications.
// Browser: window.PlayerAlerts. Node: require(lib/player-alerts.js). Test: tests/player-alerts.test.js.
//   PlayerAlerts.shouldSend(type, prefs, date)  -> bool
//   PlayerAlerts.message(type, data)            -> { title, body, tag, url } or null
//   PlayerAlerts.getPrefs(storage) / setPref(storage, type, on)
//   PlayerAlerts.deliver(type, data, deps)      -> Promise<bool>  (never throws; false when nothing shows)
(function (root) {
  'use strict';

  var KEY = 'p1to1.alerts';
  var DEFAULTS = { 'run-tonight': true, 'game-up': true, 'level-up': true, rival: false, recap: false, quiet: true };
  var TYPES = ['run-tonight', 'game-up', 'level-up', 'rival', 'recap'];
  var QUIET_FROM = 22, QUIET_TO = 7;

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function known(type) { return Object.prototype.hasOwnProperty.call(DEFAULTS, type); }

  // Reads the saved switches. A blocked or broken store gives the defaults (never throws).
  function getPrefs(storage) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = DEFAULTS[k]; });
    try {
      var raw = storage && storage.getItem(KEY);
      var saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved === 'object') {
        Object.keys(DEFAULTS).forEach(function (k) { if (typeof saved[k] === 'boolean') out[k] = saved[k]; });
      }
    } catch (e) { /* bad or blocked storage: keep the defaults */ }
    return out;
  }

  function setPref(storage, type, on) {
    if (!known(type)) return false;
    try {
      var cur = getPrefs(storage);
      cur[type] = !!on;
      if (storage) storage.setItem(KEY, JSON.stringify(cur));
      return true;
    } catch (e) { return false; }
  }

  function inQuietHours(date) {
    var h = (date || new Date()).getHours();
    return h >= QUIET_FROM || h < QUIET_TO;
  }

  // The rule in one place: the type switch first, then quiet hours (game-up still rings).
  function shouldSend(type, prefs, date) {
    var p = prefs || DEFAULTS;
    if (!known(type) || type === 'quiet') return false;
    if (p[type] !== true) return false;
    if (type !== 'game-up' && p.quiet !== false && inQuietHours(date)) return false;
    return true;
  }

  // Wording for each type. Returns null for an unknown type or missing data.
  function message(type, data) {
    var d = data || {};
    if (type === 'run-tonight') {
      var where = clean(d.place), when = clean(d.time);
      return { title: 'Run tonight', body: [where, when ? 'at ' + when : ''].filter(Boolean).join(' ') || 'Your run is on tonight.', tag: 'run-tonight', url: './' };
    }
    if (type === 'game-up') {
      var court = clean(d.court);
      return { title: 'Your game is up', body: court ? 'Court ' + court + '. Tap to see it.' : 'Tap to see your court.', tag: 'game-up', url: './' };
    }
    if (type === 'level-up') {
      var lvl = Number(d.level);
      if (!isFinite(lvl) || lvl < 1) return null;
      return { title: 'Level up', body: 'You are now level ' + Math.floor(lvl) + '.', tag: 'level-up', url: './' };
    }
    if (type === 'rival') {
      var rival = clean(d.name);
      if (!rival) return null;
      return { title: 'Rival this week', body: rival + ' is your rival this week.', tag: 'rival', url: './' };
    }
    if (type === 'recap') {
      var pts = Number(d.points);
      if (!isFinite(pts) || pts < 0) return null;
      return { title: 'Your week', body: Math.floor(pts) + ' points this week. Tap to see your recap.', tag: 'recap', url: './' };
    }
    return null;
  }

  // Shows one alert, only when the player has allowed notifications and the rules say yes.
  // deps (all optional): { storage, now (Date), notification (Notification-like), registration (service worker reg) }
  function deliver(type, data, deps) {
    var d = deps || {};
    var g = typeof globalThis !== 'undefined' ? globalThis : {};
    try {
      var storage = d.storage !== undefined ? d.storage : (g.localStorage || null);
      var prefs = getPrefs(storage);
      if (!shouldSend(type, prefs, d.now)) return Promise.resolve(false);
      var notif = d.notification || g.Notification;
      var msg = message(type, data);
      if (!msg || !notif || notif.permission !== 'granted') return Promise.resolve(false);
      var opts = { body: msg.body, tag: msg.tag, icon: 'icons/icon-192-v2.png', badge: 'icons/icon-192-v2.png', data: { url: msg.url } };
      var reg = d.registration || null;
      if (reg && typeof reg.showNotification === 'function') {
        return Promise.resolve(reg.showNotification(msg.title, opts)).then(function () { return true; }, function () { return false; });
      }
      return Promise.resolve(false);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  var api = {
    TYPES: TYPES, DEFAULTS: DEFAULTS,
    getPrefs: getPrefs, setPref: setPref, shouldSend: shouldSend, inQuietHours: inQuietHours,
    message: message, deliver: deliver
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerAlerts = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
