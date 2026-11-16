// 1TO1 player app: run alerts (Web Push). Plain JS, no framework.
// Alerts are ON by default: after sign-in the app asks once (iPhone needs a tap), then keeps the
// subscription saved. The app has NO off switch. Players turn alerts off in the phone settings.
// Off by default in code until config.js has vapidPublicKey (empty = "not set up yet", nothing is asked).
//
// Browser: window.PlayerPush. Node tests: tests/push-alerts.test.js.
//   PlayerPush.refresh(saveFn)  -> Promise { state, canAsk }   (no prompt; re-saves an existing subscription)
//   PlayerPush.enable(saveFn)   -> Promise { ok, state }       (MUST run from a tap: asks for permission)
//   saveFn(subJson)             -> Promise { ok }              (the app sends it to player_save_push)
// state: 'on' | 'off' | 'blocked' (denied in phone settings) | 'add-to-home' (iPhone, not installed yet)
//        | 'unsupported' | 'no-key' (vapidPublicKey empty)
(function (root) {
  'use strict';

  function b64ToBytes(s) {
    var pad = new Array(((4 - (s.length % 4)) % 4) + 1).join('=');
    var b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
    var raw = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function isIOS(ua) {
    return /iphone|ipad|ipod/i.test(ua || '');
  }

  // env: { ua, key, standalone, hasSW, hasPush, hasNotification }
  function support(env) {
    if (!env.key) return 'no-key';
    if (isIOS(env.ua) && !env.standalone) return 'add-to-home';
    if (!env.hasSW || !env.hasPush || !env.hasNotification) return 'unsupported';
    return 'ok';
  }

  // perm: Notification.permission ('default' | 'granted' | 'denied'); subscribed: has a push subscription
  function stateFor(env, perm, subscribed) {
    var s = support(env);
    if (s !== 'ok') return s;
    if (perm === 'denied') return 'blocked';
    if (perm === 'granted' && subscribed) return 'on';
    return 'off';
  }

  function browserEnv() {
    var w = typeof window !== 'undefined' ? window : {};
    var nav = typeof navigator !== 'undefined' ? navigator : {};
    var standalone = (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || nav.standalone === true;
    return {
      ua: nav.userAgent || '',
      key: (w.PLAYER_APP_CONFIG && w.PLAYER_APP_CONFIG.vapidPublicKey) || '',
      standalone: !!standalone,
      hasSW: !!nav.serviceWorker,
      hasPush: !!w.PushManager,
      hasNotification: typeof Notification !== 'undefined'
    };
  }

  // Waits for the service worker, but never forever: resolves null after 4 seconds.
  function readyReg() {
    var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 4000); });
    return Promise.race([navigator.serviceWorker.ready, timeout]);
  }

  function subscribe(env, saveFn) {
    return readyReg().then(function (reg) {
      if (!reg) throw new Error('no-sw');
      return reg.pushManager.getSubscription().then(function (existing) {
        return existing || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(env.key) });
      });
    }).then(function (sub) {
      return Promise.resolve(saveFn(sub.toJSON())).then(function (r) {
        return { ok: !!(r && r.ok), state: (r && r.ok) ? 'on' : 'off' };
      });
    }).catch(function () {
      return { ok: false, state: 'off' };
    });
  }

  // Called on every start after sign-in. Never shows the permission prompt.
  function refresh(saveFn) {
    var env = browserEnv();
    var s = support(env);
    if (s !== 'ok') return Promise.resolve({ state: s, canAsk: false });
    var perm = Notification.permission;
    if (perm === 'denied') return Promise.resolve({ state: 'blocked', canAsk: false });
    if (perm !== 'granted') return Promise.resolve({ state: 'off', canAsk: true });
    return subscribe(env, saveFn).then(function (r) {
      return { state: r.state, canAsk: false };
    });
  }

  // Called from a tap ("Turn on session alerts"). Asks for permission, then subscribes and saves.
  function enable(saveFn) {
    var env = browserEnv();
    var s = support(env);
    if (s !== 'ok') return Promise.resolve({ ok: false, state: s });
    // Called straight away (no await before it) so iPhone and Chrome still count it as the tap.
    var asked;
    try { asked = Notification.requestPermission(); } catch (err) { return Promise.resolve({ ok: false, state: 'off' }); }
    return Promise.resolve(asked).then(function (perm) {
      if (perm !== 'granted') return { ok: false, state: perm === 'denied' ? 'blocked' : 'off' };
      return subscribe(env, saveFn).then(function (r) { return { ok: r.ok, state: r.state }; });
    }, function () {
      return { ok: false, state: 'off' };
    });
  }

  var api = { b64ToBytes: b64ToBytes, support: support, stateFor: stateFor, refresh: refresh, enable: enable };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerPush = api;
})(typeof self !== 'undefined' ? self : this);
