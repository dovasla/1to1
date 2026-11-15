/* Player app backend (player-only build). Same methods for two adapters:
   - 'mock': keeps everything in one storage object (localStorage in the browser, memory in tests). One device only.
             Test mode only. Its PIN hash is a simple salted hash, NOT secure. The live adapter is the real one.
   - 'supabase': the real online database (free tier). The PIN is hashed on the server (bcrypt, in schema.sql).
   Every method returns a Promise.
   Methods:
     signUp(clean, pin, door)      -> { ok: true, pin } or { ok: false, reason }   pin is the PIN the player keeps (can differ from the one typed); reasons: bad-door, busy, bad-name, bad-initial, bad-pin, bad-skill
     resume(token) / logout(token) -> stay signed in on a phone for 90 days (token kept on the phone, only its hash on the server)
     login(first, lastInitial, pin)-> { ok: true, player } or { ok: false, reason }   reasons: wrong-pin (also for an unknown name), locked
     claimPaid(token, nightId)     -> { ok: true } or { ok: false, reason }   "I've paid" claim only, using the sign-in token. Not a payment. Reasons: signed-out, not-approved, no-night, error.
     pushSave(token, sub, kinds)   -> { ok: true }   push reminder switches (N11). pushRemove(token, endpoint) -> { ok: true }.
     skillAnswer(token, answers)   -> { ok: true, done: true } or { ok: false, reason }   skill questions, asked once. Reasons: signed-out, already-done, bad-answers, error.
     skillStatus(token)            -> { ok: true, done: true|false } or { ok: false }   the player never sees the 1 to 1000 number.
     getNight(id), getLive() -> { payload, updatedAt } or null (live score row, read only). mockSeedNight(id, payload) is mock test seeding only.
   No paid state here. Players never mark themselves paid; the organiser takes payment and records it in the organiser.
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
      signUp: function (clean, pin, door, invite) {
        return Promise.resolve().then(function () {
          var db = load();
          var code = db.settings && db.settings.doorCode;
          var doorOn = !(typeof window !== 'undefined' && window.PLAYER_APP_CONFIG && PLAYER_APP_CONFIG.doorCodeAtSignUp === false);
          if (doorOn && code && String(door || '').trim().toUpperCase() !== code) return { ok: false, reason: 'bad-door' };
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
          var lockEnds = rows.reduce(function (m, r) { return r.lockedUntil > m ? r.lockedUntil : m; }, 0);
          if (lockEnds > now) return { ok: false, reason: 'locked', until: new Date(lockEnds).toISOString() };
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
      // Pay with card (Square). A claim is not a payment: it only flags the night for the organiser to check Square.
      pushSave: function () { return Promise.resolve({ ok: true }); },
      pushRemove: function () { return Promise.resolve({ ok: true }); },
      pushSave: function (token, sub, kinds) { return call('POST', '/rest/v1/rpc/player_push_save', { p_token: token, p_sub: sub, p_kinds: kinds }); },
      pushRemove: function (token, endpoint) { return call('POST', '/rest/v1/rpc/player_push_remove', { p_token: token, p_endpoint: endpoint }); },
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
      // Skill questions (asked once). The mock keeps the answers only; the 1 to 1000 number is set on the server.
      skillAnswer: function (token, answers) {
        return Promise.resolve().then(function () {
          var db = load();
          var s = db.sessions && db.sessions[String(token || '')];
          var r = s && s.expires > Date.now() && db.signups.filter(function (x) { return x.id === s.id; })[0];
          if (!r) return { ok: false, reason: 'signed-out' };
          if (r.skillDone) return { ok: false, reason: 'already-done' };
          var a = answers || {};
          var good = ['exp', 'shoot', 'dribble', 'run'].every(function (k) { return Number.isInteger(a[k]) && a[k] >= 1 && a[k] <= 10; }) &&
            Number.isInteger(a.height) && a.height >= 53 && a.height <= 84;
          if (!good) return { ok: false, reason: 'bad-answers' };
          r.skillDone = true;
          r.skillAnswers = a;
          save(db);
          return { ok: true, done: true };
        });
      },
      // Mock RSVP (I'm in) so the chaos run can exercise it. Other RPCs stay unavailable in mock.
      rpc: function (name, body) {
        // Test-only fault injection: db.faults = { rpcName: 404 } makes that call fail like a missing server function.
        var fdb = load();
        if (fdb.faults && fdb.faults[name]) return Promise.reject(new Error('http-' + fdb.faults[name]));
        return Promise.resolve().then(function () {
          if (name !== 'player_rsvp_list' && name !== 'player_rsvp_set') return { ok: false, reason: 'mock' };
          var db = load();
          var b = body || {};
          var s = db.sessions && db.sessions[String(b.p_token || '')];
          var r = s && s.expires > Date.now() && db.signups.filter(function (x) { return x.id === s.id; })[0];
          if (!r) return { ok: false, reason: 'signed-out' };
          db.rsvps = db.rsvps && typeof db.rsvps === 'object' ? db.rsvps : {};
          var night = db.rsvps[String(b.p_night)] = db.rsvps[String(b.p_night)] || {};
          if (name === 'player_rsvp_set') {
            var st = String(b.p_state || '');
            if (st === 'in' || st === 'out' || st === 'maybe') night[r.id] = st; else delete night[r.id];
            save(db);
          }
          var ids = Object.keys(night);
          var inCount = ids.filter(function (k) { return night[k] === 'in'; }).length;
          var needed = 12;
          save(db);
          return { ok: true, closed: false, cancelled: false, needed: needed, inCount: inCount, paidCount: 0,
            toBreakEven: Math.max(0, needed - inCount), me: night[r.id] || null };
        });
      },
      xpSummary: function () { return Promise.resolve({ ok: false }); },
      playerHeadToHead: function () { return Promise.resolve({ ok: true, enough: false, games: 0, player: null, with: null, against: null }); },
      playerGameLog: function () { return Promise.resolve({ ok: true, games: [], by_colour: [], best_teammate: null, rival: null }); },
      streakSummary: function (token, nextWeek) { return Promise.resolve({ ok: false, nextWeek: nextWeek || 0 }); },
      playerLeaderboard: function () { return Promise.resolve({ ok: false, reason: 'mock' }); },
      playerChangePin: function (token, oldPin) { return Promise.resolve(String(oldPin) === '0000' ? { ok: false, reason: 'wrong-pin' } : { ok: true }); },
      playerChangeName: function () { return Promise.resolve({ ok: true }); },
      playerDeleteMe: function () { return Promise.resolve({ ok: true }); },
      playerMyData: function () { return Promise.resolve({ ok: true, data: { note: 'mock data' } }); },
      inviteInfo: function () { return Promise.resolve({ ok: true, code: '', joined: 0, rewarded: 0, coins: 0, badge: false }); },
      checkIn: function () { return Promise.resolve({ ok: false, reason: 'wrong-code' }); },
      skillStatus: function (token) {
        return Promise.resolve().then(function () {
          var db = load();
          var s = db.sessions && db.sessions[String(token || '')];
          var r = s && s.expires > Date.now() && db.signups.filter(function (x) { return x.id === s.id; })[0];
          return r ? { ok: true, done: r.skillDone === true } : { ok: false };
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
      mockSeedNight: function (id, payload) {
        return Promise.resolve().then(function () {
          var db = load();
          db.nights[id] = { id: id, payload: payload, updatedAt: new Date().toISOString() };
          save(db);
          return true;
        });
      },
      getNight: function (id) {
        return Promise.resolve().then(function () { var rec = load().nights[id]; return rec ? Object.assign({}, rec, { status: rec.status || 'on', message: rec.message || '' }) : null; });
      },
      // Live feed (organiser row). Mock: only what a test sets on window; no data is kept.
      getLive: function () {
        var lf = load();
        if (lf.faults && lf.faults.live_state) return Promise.reject(new Error('http-' + lf.faults.live_state));
        return Promise.resolve().then(function () {
          var w = typeof window !== 'undefined' ? window : {};
          if (w.__MOCK_LIVE_DOWN__) throw new Error('no-signal');
          return w.__MOCK_LIVE__ ? { payload: w.__MOCK_LIVE__, updatedAt: null } : null;
        });
      },
    };
  }

  function makeSupabase(opts) {
    var base = String(opts.url || '').replace(/\/+$/, '');
    var anon = opts.anonKey || '';
    var fetchFn = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);

    function headers(extra) {
      // Players send only the apikey. A publishable key is not a JWT, so it is never sent as a Bearer.
      var h = { apikey: anon, 'Content-Type': 'application/json' };
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
      signUp: function (clean, pin, door, invite) {
        return call('POST', invite ? '/rest/v1/rpc/player_sign_up_invited' : '/rest/v1/rpc/player_sign_up', Object.assign({
          p_first: clean.first, p_last_initial: clean.lastInitial, p_pin: pin, p_skill: clean.level,
          p_door: String(door || ''), p_extra: String(clean.extra || '')
        }, invite ? { p_invite: String(invite) } : {})).then(function (j) { return { ok: true, pin: j && j.pin }; }, function (e) {
          var hit = SIGNUP_REASONS.filter(function (r) { return String(e.body || '').indexOf(r) > -1; })[0];
          if (hit) return { ok: false, reason: hit };
          throw e;
        });
      },
      login: function (first, li, pin) {
        return call('POST', '/rest/v1/rpc/player_login', { p_first: first, p_last_initial: li, p_pin: pin }).then(function (j) {
          if (j && j.ok) {
            return { ok: true, token: j.token, player: { id: j.id, status: j.status, first: j.first, lastInitial: j.last_initial,
              level: j.skill_level, xpLevel: j.xp_level || 1, checkedIn: !!j.checked_in } };
          }
          // R46: a lock passes the server's end time (until) so the app can say how long to wait.
          var out = { ok: false, reason: (j && LOGIN_REASONS.indexOf(j.reason) > -1) ? j.reason : 'wrong-pin' };
          if (j && j.until) out.until = String(j.until);
          return out;
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
      // Skill questions (migration 6). Once answered, they are locked. The server also keeps any number the organiser set.
      skillAnswer: function (token, answers) {
        return call('POST', '/rest/v1/rpc/player_skill_answer', { p_token: token, p_answers: answers })
          .then(function (j) {
            if (j && j.ok) return { ok: true, done: true };
            return { ok: false, reason: (j && j.reason) || 'error' };
          }, function (e) {
            var body = String((e && e.body) || '');
            return { ok: false, reason: body.indexOf('already-done') > -1 ? 'already-done' : 'error' };
          });
      },
      rpc: function (name, body) { return call('POST', '/rest/v1/rpc/' + name, body); },
      xpSummary: function (token) { return call('POST', '/rest/v1/rpc/player_xp_summary', { p_token: token }); },
      playerHeadToHead: function (token, otherId) { return call('POST', '/rest/v1/rpc/player_head_to_head', { p_token: token, p_other: otherId }); },
      playerGameLog: function (token) { return call('POST', '/rest/v1/rpc/player_game_log', { p_token: token }); },
      streakSummary: function (token, nextWeek) { return call('POST', '/rest/v1/rpc/player_streak_summary', { p_token: token, p_next_week: nextWeek || 0 }); },
      inviteInfo: function (token) { return call('POST', '/rest/v1/rpc/player_invite_info', { p_token: token }); },
      // "I'm here" (D3/H5): the run code. Needs migration-25 (player_check_in) to work live.
      checkIn: function (token, code) { return call('POST', '/rest/v1/rpc/player_check_in', { p_token: token, p_night: 'tonight', p_code: String(code || '') }); },
      playerChangePin: function (token, oldPin, newPin) { return call('POST', '/rest/v1/rpc/player_change_pin', { p_token: token, p_old_pin: oldPin, p_new_pin: newPin }); },
      playerChangeName: function (token, first, lastInitial) { return call('POST', '/rest/v1/rpc/player_change_name', { p_token: token, p_first: first, p_last_initial: lastInitial }); },
      playerDeleteMe: function (token, pin) { return call('POST', '/rest/v1/rpc/player_delete_me', { p_token: token, p_pin: pin }); },
      playerMyData: function (token) { return call('POST', '/rest/v1/rpc/player_my_data', { p_token: token }); },
      playerLeaderboard: function (token, board, limit, season) { return call('POST', '/rest/v1/rpc/player_leaderboard', { p_token: token, p_board: board || 'xp', p_limit: limit || 20, p_season: season || 'all' }); },
      skillStatus: function (token) {
        return call('POST', '/rest/v1/rpc/player_skill_status', { p_token: token })
          .then(function (j) { return (j && j.ok) ? { ok: true, done: j.done === true } : { ok: false }; }, function () { return { ok: false }; });
      },
      resume: function (tok) {
        return call('POST', '/rest/v1/rpc/player_resume', { p_token: tok }).then(function (j) {
          if (!j || !j.ok) return { ok: false };
          return { ok: true, player: { id: j.id, status: j.status, first: j.first, lastInitial: j.last_initial,
            level: j.skill_level, xpLevel: j.xp_level || 1, checkedIn: !!j.checked_in } };
        });
      },
      logout: function (tok) {
        return call('POST', '/rest/v1/rpc/player_logout', { p_token: tok }).then(function () { return true; });
      },
      // Gives up after 8 seconds, so a dead connection shows log in or "No signal" instead of a blank app.
      getNight: function (id) {
        var req = call('GET', '/rest/v1/nights?select=*&id=eq.' + encodeURIComponent(id)).then(function (rows) {
          var r = rows && rows[0];
          return r ? { id: r.id, payload: r.payload, updatedAt: r.updated_at, status: r.status, message: r.message } : null;
        });
        var timer = null;
        var timeout = new Promise(function (_, reject) {
          timer = setTimeout(function () { reject(new Error('timeout')); }, 8000);
        });
        return Promise.race([req, timeout]).then(function (v) { clearTimeout(timer); return v; }, function (e) { clearTimeout(timer); throw e; });
      },
      // One small value (migration 3, night_version). Fetch the full night only when it changes (Fable A9).
      // Live score row (migration 11, live_state). Read only with the anon key. Rejects on no signal.
      getLive: function () {
        return call('GET', '/rest/v1/live_state?select=payload,updated_at&id=eq.tonight').then(function (rows) {
          return rows && rows[0] ? { payload: rows[0].payload, updatedAt: rows[0].updated_at } : null;
        });
      },
      nightVersion: function (id) {
        return call('POST', '/rest/v1/rpc/night_version', { p_id: id }).then(function (v) { return v || null; });
      },
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
