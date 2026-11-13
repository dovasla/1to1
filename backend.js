/* Player app backend. Same methods for two adapters:
   - 'mock': keeps everything in one storage object (localStorage in the browser, memory in tests). One device only.
             Test mode only. Its PIN hash is a simple salted hash, NOT secure. The live adapter is the real one.
   - 'supabase': the real online database (free tier). The PIN is hashed on the server (bcrypt, in schema.sql).
   Every method returns a Promise.
   Methods:
     signUp(clean, pin, door)      -> { ok: true, pin } or { ok: false, reason }   pin is the PIN the player keeps (can differ from the one typed); reasons: bad-door, busy, bad-name, bad-initial, bad-pin, bad-skill
     resume(token) / logout(token) -> stay signed in on a phone for 90 days (token kept on the phone, only its hash on the server)
     getDoorCode() / setDoorCode(code) -> organiser only; empty code switches the door off
     login(first, lastInitial, pin)-> { ok: true, player } or { ok: false, reason }   reasons: wrong-pin (also for an unknown name), locked
     resetPin(id, pin)             -> true (organiser only, signed in)
     clearLock(id)                 -> true (organiser only, signed in)
     listSignups(), listApproved(), decide(id, status, level)
     claimPaid(token, nightId)     -> { ok: true } or { ok: false, reason }   "I've paid" claim only, using the sign-in token. Not a payment. Reasons: signed-out, not-approved, no-night, error.
     publishNight(id, payload), getNight(id), exportAll(), signIn(email, password) (supabase only).
   No paid state here. Players never mark themselves paid; Jord takes payment and records it in the organiser.
   Global: window.PlayerBackend = { create(kind, opts) }. Node: module.exports.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerBackend = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = '1to1-player-mock-db';
  var MAX_TRIES = 5;

  function emptyDb() { return { signups: [], nights: {} }; }

  // Test-mode only. Not secure. Keeps the PIN out of plain text on this device.
  function mockHash(salt, pin) {
    var s = salt + ':' + pin, h = 5381;
    for (var i = 0; i < 2000; i++) {
      for (var j = 0; j < s.length; j++) h = ((h * 33) ^ s.charCodeAt(j)) >>> 0;
    }
    return h.toString(36);
  }
  function mockSalt() { return Math.random().toString(36).slice(2, 10); }

  function makeMock(store) {
    function load() {
      try {
        var raw = store.getItem(KEY);
        var db = raw ? JSON.parse(raw) : emptyDb();
        if (!Array.isArray(db.signups)) db.signups = [];
        if (!db.nights || typeof db.nights !== 'object') db.nights = {};
        if (!db.settings || typeof db.settings !== 'object') db.settings = {};
        if (!db.sessions || typeof db.sessions !== 'object') db.sessions = {};
        return db;
      } catch (e) { return emptyDb(); }
    }
    function save(db) { store.setItem(KEY, JSON.stringify(db)); }
    function publicRow(r) {
      return { id: r.id, first: r.first, lastInitial: r.lastInitial, status: r.status,
        under18: r.under18, level: r.level, xpLevel: r.xpLevel || 1, createdAt: r.createdAt };
    }
    function sameName(r, first, li) {
      return r.first.toLowerCase() === String(first || '').trim().toLowerCase() && r.lastInitial === String(li || '').trim().toUpperCase();
    }
    function pinMatches(r, pin) { return r.pinHash === mockHash(r.pinSalt, pin); }
    return {
      kind: 'mock',
      signUp: function (clean, pin, door) {
        return Promise.resolve().then(function () {
          var db = load();
          var code = db.settings && db.settings.doorCode;
          if (code && String(door || '').trim().toUpperCase() !== code) return { ok: false, reason: 'bad-door' };
          // A clash is never reported. The new player gets another free PIN, and it is shown to them.
          var usedPins = db.signups.filter(function (r) { return sameName(r, clean.first, clean.lastInitial); });
          var finalPin = String(pin);
          for (var guard = 0; guard < 50 && usedPins.some(function (r) { return pinMatches(r, finalPin); }); guard++) {
            finalPin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
          }
          var salt = mockSalt();
          db.signups.push({ id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            first: clean.first, lastInitial: clean.lastInitial, pinSalt: salt, pinHash: mockHash(salt, finalPin),
            level: clean.level, xpLevel: 1, under18: clean.under18 === true, status: 'approved',
            badTries: 0, lockedUntil: 0, createdAt: new Date().toISOString() });
          save(db);
          return { ok: true, pin: finalPin };
        });
      },
      login: function (first, li, pin) {
        return Promise.resolve().then(function () {
          var db = load();
          var rows = db.signups.filter(function (r) { return sameName(r, first, li); });
          if (!rows.length) return { ok: false, reason: 'wrong-pin' };   // same answer as a wrong PIN
          var now = Date.now();
          if (rows.some(function (r) { return r.lockedUntil > now; })) return { ok: false, reason: 'locked' };
          var hit = rows.filter(function (r) { return pinMatches(r, String(pin || '')); })[0];
          if (hit) {
            rows.forEach(function (r) { r.badTries = 0; r.lockCount = 0; r.lockedUntil = 0; });
            var token = mockSalt() + mockSalt() + mockSalt() + mockSalt();
            db.sessions = db.sessions || {};
            db.sessions[token] = { id: hit.id, expires: now + 90 * 24 * 3600 * 1000 };
            save(db);
            return { ok: true, token: token, player: publicRow(hit) };
          }
          rows.forEach(function (r) {
            r.badTries = (r.badTries || 0) + 1;
            if (r.badTries >= MAX_TRIES) {
              // 1 minute, doubling on each repeat lock, up to 60 minutes. Same rule as schema.sql.
              r.lockedUntil = now + Math.min(60, Math.pow(2, r.lockCount || 0)) * 60 * 1000;
              r.lockCount = (r.lockCount || 0) + 1;
              r.badTries = 0;
            }
          });
          save(db);
          return { ok: false, reason: 'wrong-pin' };
        });
      },
      // Pay with card (Square). A claim is not a payment: it only flags the night for Jord to check Square.
      claimPaid: function (token, nightId) {
        return Promise.resolve().then(function () {
          var db = load();
          var s = db.sessions && db.sessions[String(token || '')];
          var r = s && s.expires > Date.now() && db.signups.filter(function (x) { return x.id === s.id; })[0];
          if (!r) return { ok: false, reason: 'signed-out' };
          if (r.status !== 'approved') return { ok: false, reason: 'not-approved' };
          if (!db.nights[nightId]) return { ok: false, reason: 'no-night' };
          db.claims = Array.isArray(db.claims) ? db.claims : [];
          var key = nightId + ':' + r.id;
          if (!db.claims.some(function (c) { return c.key === key; })) {
            db.claims.push({ key: key, nightId: nightId, signupId: r.id, claimedAt: new Date().toISOString() });
          }
          save(db);
          return { ok: true };
        });
      },
      resetPin: function (id, pin) {
        return Promise.resolve().then(function () {
          if (!/^[0-9]{4}$/.test(String(pin))) throw new Error('bad-pin');
          var db = load();
          var r = db.signups.filter(function (x) { return x.id === id; })[0];
          if (!r) return false;
          r.pinSalt = mockSalt(); r.pinHash = mockHash(r.pinSalt, String(pin));
          r.badTries = 0; r.lockCount = 0; r.lockedUntil = 0;
          save(db);
          return true;
        });
      },
      clearLock: function (id) {
        return Promise.resolve().then(function () {
          var db = load();
          var r = db.signups.filter(function (x) { return x.id === id; })[0];
          if (!r) return false;
          r.badTries = 0; r.lockedUntil = 0;   // repeat count kept, same as organiser_clear_lock in schema.sql
          save(db);
          return true;
        });
      },
      resume: function (token) {
        return Promise.resolve().then(function () {
          var db = load();
          var s = db.sessions && db.sessions[String(token || '')];
          var r = s && s.expires > Date.now() && db.signups.filter(function (x) { return x.id === s.id; })[0];
          return r ? { ok: true, player: publicRow(r) } : { ok: false };
        });
      },
      logout: function (token) {
        return Promise.resolve().then(function () {
          var db = load();
          if (db.sessions) delete db.sessions[String(token || '')];
          save(db);
          return true;
        });
      },
      getDoorCode: function () {
        return Promise.resolve().then(function () { return (load().settings || {}).doorCode || ''; });
      },
      setDoorCode: function (code) {
        return Promise.resolve().then(function () {
          var c = String(code || '').trim().toUpperCase();
          if (c && !/^[A-Z0-9]{3,8}$/.test(c)) throw new Error('bad-door-code');
          var db = load();
          db.settings = db.settings || {};
          db.settings.doorCode = c || null;
          save(db);
          return true;
        });
      },
      listSignups: function () {
        return Promise.resolve().then(function () { return load().signups.map(publicRow); });
      },
      listApproved: function () {
        return Promise.resolve().then(function () {
          return load().signups.filter(function (r) { return r.status === 'approved'; }).map(publicRow);
        });
      },
      // level is Jord's final number from the slider (optional). It replaces the player's own pick.
      decide: function (id, status, level) {
        return Promise.resolve().then(function () {
          if (status !== 'approved' && status !== 'declined' && status !== 'waiting') throw new Error('bad-status');
          var db = load();
          var r = db.signups.filter(function (x) { return x.id === id; })[0];
          if (!r) return false;
          r.status = status;
          if (Number.isInteger(level) && level >= 1 && level <= 30) r.level = level;
          save(db);
          return true;
        });
      },
      publishNight: function (id, payload) {
        return Promise.resolve().then(function () {
          var db = load();
          db.nights[id] = { id: id, payload: payload, updatedAt: new Date().toISOString() };
          save(db);
          return true;
        });
      },
      getNight: function (id) {
        return Promise.resolve().then(function () { return load().nights[id] || null; });
      },
      exportAll: function () {
        return Promise.resolve().then(function () {
          var db = load();
          // No PIN hashes in the backup file.
          return { format: '1to1-player-backup', version: 2, savedAt: new Date().toISOString(),
            signups: db.signups.map(publicRow), nights: db.nights };
        });
      }
    };
  }

  function makeSupabase(opts) {
    var base = String(opts.url || '').replace(/\/+$/, '');
    var anon = opts.anonKey || '';
    var token = null;   // set by signIn; the organiser's login. Players use the anon key only.
    var fetchFn = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);

    function headers(extra) {
      // Players send only the apikey. The organiser also sends its sign-in token. A publishable key is not a JWT, so it is never sent as a Bearer.
      var h = { apikey: anon, 'Content-Type': 'application/json' };
      if (token) h.Authorization = 'Bearer ' + token;
      Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
      return h;
    }
    function call(method, path, body, extra) {
      return fetchFn(base + path, { method: method, headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body) })
        .then(function (res) {
          if (!res.ok) {
            return res.text().then(function (t) { var e = new Error('http-' + res.status); e.body = t || ''; throw e; });
          }
          var t = res.status === 204 ? '' : res.text();
          return Promise.resolve(t).then(function (txt) { return txt ? JSON.parse(txt) : null; });
        });
    }
    function toRow(r) {
      return { id: r.id, first: r.first, lastInitial: r.last_initial, status: r.status,
        under18: r.under18, level: r.skill_level, xpLevel: r.xp_level || 1, createdAt: r.created_at };
    }
    var SIGNUP_REASONS = ['busy', 'bad-door', 'bad-name', 'bad-initial', 'bad-pin', 'bad-skill', 'name-taken'];
    var LOGIN_REASONS = ['wrong-pin', 'locked'];
    return {
      kind: 'supabase',
      signIn: function (email, password) {
        return call('POST', '/auth/v1/token?grant_type=password', { email: email, password: password }).then(function (j) {
          token = j && j.access_token ? j.access_token : null;
          return !!token;
        });
      },
      signUp: function (clean, pin, door) {
        return call('POST', '/rest/v1/rpc/player_sign_up', {
          p_first: clean.first, p_last_initial: clean.lastInitial, p_pin: pin, p_skill: clean.level,
          p_door: String(door || ''), p_extra: String(clean.extra || '')
        }).then(function (j) { return { ok: true, pin: j && j.pin }; }, function (e) {
          var hit = SIGNUP_REASONS.filter(function (r) { return String(e.body || '').indexOf(r) > -1; })[0];
          if (hit) return { ok: false, reason: hit };
          throw e;
        });
      },
      login: function (first, li, pin) {
        return call('POST', '/rest/v1/rpc/player_login', { p_first: first, p_last_initial: li, p_pin: pin }).then(function (j) {
          if (j && j.ok) {
            return { ok: true, token: j.token, player: { id: j.id, status: j.status, first: j.first, lastInitial: j.last_initial,
              level: j.skill_level, xpLevel: j.xp_level || 1 } };
          }
          return { ok: false, reason: (j && LOGIN_REASONS.indexOf(j.reason) > -1) ? j.reason : 'wrong-pin' };
        });
      },
      // Pay with card (Square). Server checks the PIN (same lock rules as login) and records a claim only.
      claimPaid: function (token, nightId) {
        return call('POST', '/rest/v1/rpc/player_claim_paid', { p_token: token, p_night: nightId })
          .then(function (j) {
            if (j && j.ok) return { ok: true };
            return { ok: false, reason: (j && j.reason) || 'error' };
          }, function () { return { ok: false, reason: 'error' }; });
      },
      // Automatic Square pay (Edge Functions). Only used when config payAuto is on.
      // payLink -> { ok: true, url } or { ok: false, reason }. The Square link is made per player on the server.
      payLink: function (token, nightId) {
        return call('POST', '/functions/v1/create-pay-link', { token: token, night: nightId })
          .then(function (j) {
            if (j && j.ok && j.url) return { ok: true, url: j.url };
            return { ok: false, reason: (j && j.reason) || 'error' };
          }, function () { return { ok: false, reason: 'error' }; });
      },
      // paymentStatus -> { ok: true, paid: true|false } or { ok: false, reason }. Only the webhook sets paid.
      paymentStatus: function (token, nightId) {
        return call('POST', '/rest/v1/rpc/player_payment_status', { p_token: token, p_night: nightId })
          .then(function (j) {
            if (j && j.ok) return { ok: true, paid: j.paid === true };
            return { ok: false, reason: (j && j.reason) || 'error' };
          }, function () { return { ok: false, reason: 'error' }; });
      },
      resetPin: function (id, pin) {
        return call('POST', '/rest/v1/rpc/organiser_reset_pin', { p_id: id, p_pin: pin }).then(function (ok) { return ok === true; });
      },
      resume: function (tok) {
        return call('POST', '/rest/v1/rpc/player_resume', { p_token: tok }).then(function (j) {
          if (!j || !j.ok) return { ok: false };
          return { ok: true, player: { id: j.id, status: j.status, first: j.first, lastInitial: j.last_initial,
            level: j.skill_level, xpLevel: j.xp_level || 1 } };
        });
      },
      logout: function (tok) {
        return call('POST', '/rest/v1/rpc/player_logout', { p_token: tok }).then(function () { return true; });
      },
      getDoorCode: function () {
        return call('POST', '/rest/v1/rpc/organiser_get_door_code', {}).then(function (t) { return String(t || ''); });
      },
      setDoorCode: function (code) {
        return call('POST', '/rest/v1/rpc/organiser_set_door_code', { p_code: String(code || '') }).then(function (ok) { return ok === true; });
      },
      clearLock: function (id) {
        return call('POST', '/rest/v1/rpc/organiser_clear_lock', { p_id: id }).then(function (ok) { return ok === true; });
      },
      listSignups: function () {
        return call('GET', '/rest/v1/signups?select=id,first,last_initial,status,skill_level,xp_level,created_at&order=created_at.asc')
          .then(function (rows) { return rows.map(toRow); });
      },
      listApproved: function () {
        return call('GET', '/rest/v1/signups?select=id,first,last_initial,status,skill_level,xp_level,created_at&status=eq.approved&order=created_at.asc')
          .then(function (rows) { return rows.map(toRow); });
      },
      decide: function (id, status, level) {
        var body = { status: status };
        if (Number.isInteger(level) && level >= 1 && level <= 30) body.skill_level = level;
        return call('PATCH', '/rest/v1/signups?id=eq.' + encodeURIComponent(id), body, { Prefer: 'return=minimal' })
          .then(function () { return true; });
      },
      publishNight: function (id, payload) {
        return call('POST', '/rest/v1/nights', { id: id, payload: payload, updated_at: new Date().toISOString() },
          { Prefer: 'resolution=merge-duplicates,return=minimal' }).then(function () { return true; });
      },
      getNight: function (id) {
        return call('GET', '/rest/v1/nights?select=*&id=eq.' + encodeURIComponent(id)).then(function (rows) {
          var r = rows && rows[0];
          return r ? { id: r.id, payload: r.payload, updatedAt: r.updated_at } : null;
        });
      },
      // One small value (migration 3, night_version). Fetch the full night only when it changes (Fable A9).
      nightVersion: function (id) {
        return call('POST', '/rest/v1/rpc/night_version', { p_id: id }).then(function (v) { return v || null; });
      },
      exportAll: function () {
        return Promise.all([
          call('GET', '/rest/v1/signups?select=id,first,last_initial,status,skill_level,xp_level,created_at&order=created_at.asc'),
          call('GET', '/rest/v1/nights?select=*')
        ]).then(function (x) {
          return { format: '1to1-player-backup', version: 2, savedAt: new Date().toISOString(), signups: x[0].map(toRow),
            nights: x[1].reduce(function (m, r) { m[r.id] = { id: r.id, payload: r.payload }; return m; }, {}) };
        });
      }
    };
  }

  function create(kind, opts) {
    opts = opts || {};
    if (kind === 'supabase') return makeSupabase(opts);
    var store = opts.store;
    if (!store && typeof localStorage !== 'undefined') store = localStorage;
    if (!store) store = memoryStore();
    return makeMock(store);
  }

  function memoryStore() {
    var m = {};
    return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); } };
  }

  return { create: create, memoryStore: memoryStore };
});
