/* Player app backend. Same methods for two adapters:
   - 'mock': keeps everything in one storage object (localStorage in the browser, memory in tests). One device only.
             Test mode only. Its PIN hash is a simple salted hash, NOT secure. The live adapter is the real one.
   - 'supabase': the real online database (free tier). The PIN is hashed on the server (bcrypt, in schema.sql).
   Every method returns a Promise.
   Methods:
     signUp(clean, pin, door)      -> { ok: true, pin } or { ok: false, reason }   pin is the PIN the player keeps (can differ from the one typed); reasons: bad-door, busy, bad-name, bad-initial, bad-pin, bad-skill
     resume(token) / logout(token) -> stay signed in on a phone for 90 days (token kept on the phone, only its hash on the server)
      login(first, lastInitial, pin)-> { ok: true, player } or { ok: false, reason }   reasons: wrong-pin (also for an unknown name), locked
      claimPaid(token, nightId)     -> { ok: true } or { ok: false, reason }   "I've paid" claim only, using the sign-in token. Not a payment. Reasons: signed-out, not-approved, no-night, error.
     skillAnswer(token, answers)   -> { ok: true, done: true } or { ok: false, reason }   skill questions, asked once. Reasons: signed-out, already-done, bad-answers, error.
     skillStatus(token)            -> { ok: true, done: true|false } or { ok: false }   the player never sees the 1 to 1000 number.
     getNight(id), nightVersion(id) (players read the published night; the write is organiser-only, not here).
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
            badTries: 0, lockedUntil: 0, createdAt: new Date().toISOString(),
            username: rulesApi() ? rulesApi().defaultUsername(clean.first, clean.lastInitial, clean.extra) : '' });
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
      // Pay with card (Square). A claim is not a payment: it only flags the night for the organiser to check Square.
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
      // Run alerts (migration 43). The mock keeps nothing: one test device cannot receive real pushes.
      savePush: function () { return Promise.resolve({ ok: true }); },
      pushSave: function (token, sub, kinds) { return Promise.resolve({ ok: true, kinds: kinds || [] }); },
      pushRemove: function () { return Promise.resolve({ ok: true }); },
      pushStatus: function () { return Promise.resolve({ ok: true, kinds: [] }); },
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
      // Username and character (test mode, this device only). Same answers as the server.
      // R226 My account: PIN change and delete. Mock backend: always answers ok (no server).
      playerChangePin: function (token, oldPin, newPin) { return Promise.resolve({ ok: true }); },
      playerDeleteMe: function (token, pin) { return Promise.resolve({ ok: true }); },
      playerChangeName: function () { return Promise.resolve({ ok: true }); },
      playerMyData: function () { return Promise.resolve({ ok: true, data: { note: 'mock data' } }); },
      setUsername: function (token, name) {
        return Promise.resolve().then(function () {
          var db = load();
          var s = db.sessions && db.sessions[String(token || '')];
          var row = s && db.signups.filter(function (x) { return x.id === s.id; })[0];
          if (!row) return { ok: false, reason: 'not-signed-in' };
          var v = rulesApi() ? rulesApi().validateUsername(name) : { ok: false };
          if (!v.ok) return { ok: false, reason: 'bad-name' };
          var same = String(row.username || '').toLowerCase() === v.value.toLowerCase();
          if (db.signups.some(function (x) { return x.id !== row.id && String(x.username || '').toLowerCase() === v.value.toLowerCase(); })) {
            return { ok: false, reason: 'taken' };
          }
          if (!same && row.usernameChangedAt && Date.now() - row.usernameChangedAt < 30 * 24 * 3600 * 1000) {
            return { ok: false, reason: 'too-soon' };
          }
          row.username = v.value;
          if (!same) row.usernameChangedAt = Date.now();
          save(db);
          return { ok: true, username: v.value };
        });
      },
      setIcon: function (token, id) {
        return Promise.resolve().then(function () {
          var db = load();
          var s = db.sessions && db.sessions[String(token || '')];
          var row = s && db.signups.filter(function (x) { return x.id === s.id; })[0];
          if (!row) return { ok: false, reason: 'not-signed-in' };
          if (!/^[ia]\d{2,3}$/.test(String(id || ''))) return { ok: false, reason: 'bad-icon' };
          row.icon = String(id);
          save(db);
          return { ok: true, icon: row.icon };
        });
      },
      checkIn: function (token, nightId, code) {
        return Promise.resolve(String(code) === '1234' ? { ok: true, here: true } : { ok: false, reason: 'wrong-code', triesLeft: 4 });
      },
      // Run status for this phone (player_run_status). Mock: open, with a fixed code time.
      runStatus: function (token, nightId) {
        return Promise.resolve({ ok: true, state: 'open', nightId: nightId, codeMadeAt: 'mock-code' });
      },
      publishNight: function (id, payload) {
        return Promise.resolve().then(function () {
          var db = load();
          db.nights[id] = { id: id, payload: payload, updatedAt: new Date().toISOString() };
          save(db);
          return true;
        });
      },
      // Live feed (P9): the mock has no live row, so the Live tab keeps its own data.
      getLive: function () { return Promise.resolve(null); },
      paymentStatus: function () { return Promise.resolve({ ok: true, paid: false }); },
      getNightStamp: function (id) {
        return Promise.resolve().then(function () { var n = load().nights[id]; return { ok: true, stamp: n ? JSON.stringify(n.payload || {}) : '' }; });
      },
      getNight: function (id) {
        return Promise.resolve().then(function () { return load().nights[id] || null; });
      }
    };
  }

  function makeSupabase(opts) {
    var base = String(opts.url || '').replace(/\/+$/, '');
    var anon = opts.anonKey || '';
    var fetchFn = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);

    function headers(extra) {
      // Players send only the public apikey. No sign-in, so no Bearer token.
      var h = { apikey: anon, 'Content-Type': 'application/json' };
      Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
      return h;
    }
    // r8: one try has a hard time limit (TIMEOUT_MS), so a weak signal cannot hang a tap.
    // A failed signal or a time-out is marked e.network = true. The server answering with an error is not.
    var TIMEOUT_MS = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 8000;
    function once(method, path, body, extra) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = null;
      var limit = new Promise(function (resolve, reject) {
        timer = setTimeout(function () {
          if (ctrl) ctrl.abort();
          var e = new Error('timeout'); e.network = true; reject(e);
        }, TIMEOUT_MS);
      });
      var req = fetchFn(base + path, { method: method, headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined })
        .then(function (res) {
          if (!res.ok) {
            return res.text().then(function (t) { var e = new Error('http-' + res.status); e.body = t || ''; throw e; });
          }
          var t = res.status === 204 ? '' : res.text();
          return Promise.resolve(t).then(function (txt) { return txt ? JSON.parse(txt) : null; });
        }, function () { var e = new Error('network'); e.network = true; throw e; });
      return Promise.race([req, limit]).then(function (v) { clearTimeout(timer); return v; }, function (err) { clearTimeout(timer); throw err; });
    }
    // One retry, and only after a signal failure or a time-out. Each call here sets a value on the server, so a repeat is safe.
    function call(method, path, body, extra) {
      return once(method, path, body, extra).catch(function (e) {
        if (!e || !e.network) throw e;
        return once(method, path, body, extra);
      });
    }
    function toRow(r) {
      return { id: r.id, first: r.first, lastInitial: r.last_initial, status: r.status,
        under18: r.under18, level: r.skill_level, xpLevel: r.xp_level || 1, createdAt: r.created_at };
    }
    var SIGNUP_REASONS = ['busy', 'bad-door', 'bad-name', 'bad-initial', 'bad-pin', 'bad-skill', 'name-taken', 'name-reserved'];
    var LOGIN_REASONS = ['wrong-pin', 'locked', 'hard-stop'];
    return {
      kind: 'supabase',
      inviteInfo: function (token) { return call('POST', '/rest/v1/rpc/player_invite_info', { p_token: token }); },
      signUp: function (clean, pin, door, invite) {
        return call('POST', invite ? '/rest/v1/rpc/player_sign_up_invited' : '/rest/v1/rpc/player_sign_up', Object.assign({
          p_first: clean.first, p_last_initial: clean.lastInitial, p_pin: pin, p_skill: clean.level,
          p_door: String(door || ''), p_extra: String(clean.extra || '')
        }, invite ? { p_invite: String(invite) } : {})).then(function (j) { return { ok: true, pin: j && j.pin }; }, function (e) {
          var hit = SIGNUP_REASONS.filter(function (r) { return String(e.body || '').indexOf(r) > -1; })[0];
          if (hit) return { ok: false, reason: hit, hint: /first-name/.test(String(e.body || '')) ? 'first-name' : (/extra-letters/.test(String(e.body || '')) ? 'extra-letters' : '') };
          throw e;
        });
      },
      login: function (first, li, pin) {
        return call('POST', '/rest/v1/rpc/player_login', { p_first: first, p_last_initial: li, p_pin: pin }).then(function (j) {
          if (j && j.ok) {
            return { ok: true, token: j.token, player: { id: j.id, status: j.status, first: j.first, lastInitial: j.last_initial,
              level: j.skill_level, xpLevel: j.xp_level || 1, icon: j.icon || '' } };
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
          }, function (e) { return { ok: false, reason: (e && e.network) ? 'network' : 'error' }; });
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
            // R318: state (none, due, card_pending, claimed, paid), booked, claimed, amount_pence (null unless booked).
            if (j && j.ok) return { ok: true, paid: j.paid === true, state: String(j.state || ''), booked: j.booked === true, claimed: j.claimed === true, amountPence: j.amount_pence == null ? null : Number(j.amount_pence) };
            return { ok: false, reason: (j && j.reason) || 'error' };
          }, function () { return { ok: false, reason: 'error' }; });
      },
      // Run alerts (migration 43). Saves this phone's push subscription for the signed-in player.
      // P4: uses the live player_push_save (kinds: tonight, pay, recap). Legacy savePush keeps the old call shape.
      savePush: function (token, sub) {
        var keys = (sub && sub.keys) || {};
        return call('POST', '/rest/v1/rpc/player_push_save', {
          p_token: token, p_sub: { endpoint: sub && sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, p_kinds: ['tonight', 'pay', 'recap']
        }).then(function (j) { return { ok: !!(j && j.ok) }; }, function () { return { ok: false }; });
      },
      // Reminder switches (P4). kinds: any subset of tonight, pay, recap. Empty kinds saves nothing new.
      pushSave: function (token, sub, kinds) {
        var keys = (sub && sub.keys) || {};
        return call('POST', '/rest/v1/rpc/player_push_save', {
          p_token: token, p_sub: { endpoint: sub && sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, p_kinds: kinds || []
        }).then(function (j) { return { ok: !!(j && j.ok), kinds: (j && j.kinds) || [] }; }, function () { return { ok: false }; });
      },
      pushRemove: function (token, endpoint) {
        return call('POST', '/rest/v1/rpc/player_push_remove', { p_token: token, p_endpoint: endpoint })
          .then(function (j) { return { ok: !!(j && j.ok) }; }, function () { return { ok: false }; });
      },
      // Reads which reminder switches this phone has saved (player_push_status, P4). Returns { ok, kinds }.
      pushStatus: function (token, endpoint) {
        return call('POST', '/rest/v1/rpc/player_push_status', { p_token: token, p_endpoint: endpoint })
          .then(function (j) { return { ok: !!(j && j.ok), kinds: (j && j.kinds) || [] }; }, function () { return { ok: false, kinds: [] }; });
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
      // P13 (R198/R216): my own spot in the upcoming runs. Room lists never reach the app (upcomingShape).
      upcomingList: function (token) {
        return call('POST', '/rest/v1/rpc/upcoming_list', { p_token: token }).then(function (j) {
          return { ok: true, runs: upcomingShape(j.runs) };
        }, function () { return { ok: false, runs: [] }; });
      },
      // P13: live scoreboard (player_live_scoreboard). Team names and scores only; no scorer names reach the app.
      // Not live is a normal answer (live: false), not an error.
      scoreboard: function (token, night) {
        return call('POST', '/rest/v1/rpc/player_live_scoreboard', { p_token: token, p_night: night }).then(function (j) {
          if (!j || j.ok === false) {
            if (j && j.reason === 'not-live') return { ok: true, live: false, events: [] };
            return { ok: false, reason: (j && j.reason) || 'error' };
          }
          return { ok: true, live: true, game: j.game, teamAName: j.teamAName || '', teamBName: j.teamBName || '',
            scoreA: Number(j.teamA) || 0, scoreB: Number(j.teamB) || 0,
            events: (Array.isArray(j.events) ? j.events : []).map(function (e) {
              return { at: e.at, side: e.side, points: e.points, teamA: e.teamA, teamB: e.teamB };
            }) };
        }, function () { return { ok: false, reason: 'error' }; });
      },
      // I'm in / Can't make it (R74, R88): only player_get_in and player_set_in (file 50).
      rsvpList: function (token) {
        return call('POST', '/rest/v1/rpc/player_get_in', { p_token: token }).then(function (j) {
          if (!j || !j.ok) return { ok: false, reason: (j && j.reason) || 'error' };
          if (!j.session) return { ok: true, closed: true, cancelled: false, me: null, fillingUp: false };
          return { ok: true, closed: false, cancelled: false, me: j.me || null, fillingUp: j.filling === true };
        }, function () { return { ok: false, reason: 'error' }; });
      },
      rsvpSet: function (token, nightId, state) {
        return call('POST', '/rest/v1/rpc/player_set_in', { p_token: token, p_answer: state }).then(function (j) {
          return { ok: !!(j && j.ok === true), reason: (j && j.reason) || undefined };
        }, function () { return { ok: false, reason: 'error' }; });
      },
      // Photos (r7). Upload replaces the player's own photo and waits for the organiser. Rules are on the server.
      uploadPhoto: function (token, image) {
        return call('POST', '/rest/v1/rpc/player_upload_photo', { p_token: token || null, p_image: image }).then(function (j) { return j || { ok: false }; }, function () { return { ok: false, reason: 'error' }; });
      },
      // Other players' looks (r7): public_id, chosen icon, and the photo only when approved. Anon-safe, hidden players left out.
      publicLooks: function () {
        return call('POST', '/rest/v1/rpc/player_public_looks', {}).then(function (j) { return { ok: true, rows: Array.isArray(j) ? j : [] }; }, function () { return { ok: false, rows: [] }; });
      },
      setPhotoIcon: function (token, icon) {
        return call('POST', '/rest/v1/rpc/player_set_photo_icon', { p_token: token || null, p_icon: icon || '' }).then(function (j) { return j || { ok: false }; }, function () { return { ok: false, reason: 'error' }; });
      },
      myPhoto: function (token) {
        return call('POST', '/rest/v1/rpc/player_my_photo', { p_token: token || null }).then(function (j) { return j || { ok: false }; }, function () { return { ok: false }; });
      },
      // Read-only RPC for the stats and history screens (P6). Failure gives { ok: false }, never a throw.
      rpc: function (name, body) {
        return call('POST', '/rest/v1/rpc/' + name, body).then(function (j) { return j; }, function (e) { return { ok: false, reason: (e && e.network) ? 'network' : 'error' }; });
      },
      // Board (R87 a): player_leaderboard with all six arguments. Hidden rows come back as "Player" with no value.
      // P6c: season is 'current' (default), 'last' or 'all'. Anything else falls back to 'current'.
      leaderboard: function (token, season) {
        var sid = (season === 'last' || season === 'all') ? season : 'current';
        return call('POST', '/rest/v1/rpc/player_leaderboard', { p_token: token || null, p_board: 'xp', p_limit: 50, p_season: sid, p_search: null, p_offset: 0 }).then(function (j) {
          if (!j || !j.ok) return { ok: false, players: [] };
          return { ok: true, players: (j.rows || []).map(function (r) {
            var hidden = r.name === 'Player';
            // "value" is the XP for the xp board (the number the row shows).
            return { id: r.public_id || r.name, name: r.name, level: r.level, icon: r.icon || '', stars: 0, points: r.value || 0, wins: 0,
              visible: !hidden, under18: false, look: (!hidden && r.equipped) || {}, me: r.me === true };
          }) };
        }, function () { return { ok: false, players: [] }; });
      },
      // Badges and milestones (P7): player_achievements. Badges come back with progress; the phone draws them (screens/achievements).
      achievements: function (token) {
        return call('POST', '/rest/v1/rpc/player_achievements', { p_token: token }).then(function (j) {
          if (!j || !j.ok) return { ok: false };
          return { ok: true, badges: j.badges || [], coinsFromBadges: Number(j.coinsFromBadges) || 0 };
        }, function () { return { ok: false }; });
      },
      skillStatus: function (token) {
        return call('POST', '/rest/v1/rpc/player_skill_status', { p_token: token })
          .then(function (j) { return (j && j.ok) ? { ok: true, done: j.done === true } : { ok: false }; }, function () { return { ok: false }; });
      },
      resume: function (tok) {
        return call('POST', '/rest/v1/rpc/player_resume', { p_token: tok }).then(function (j) {
          if (!j || !j.ok) return { ok: false };
          return { ok: true, player: { id: j.id, status: j.status, first: j.first, lastInitial: j.last_initial,
            level: j.skill_level, xpLevel: j.xp_level || 1, icon: j.icon || '' } };
        });
      },
      logout: function (tok) {
        return call('POST', '/rest/v1/rpc/player_logout', { p_token: tok }).then(function () { return true; });
      },
      // VIP icons (migration-48). The server returns pictures to VIP players only.
      vipIcons: function (tok) {
        return call('POST', '/rest/v1/rpc/player_vip_icons', { p_token: tok }).then(function (j) {
          return (j && j.ok) ? { ok: true, icons: j.icons || [] } : { ok: false, icons: [] };
        }, function () { return { ok: false, icons: [] }; });
      },
      setVipIcon: function (tok, id) {
        return call('POST', '/rest/v1/rpc/player_set_icon', { p_token: tok, p_icon: id }).then(function (j) {
          return (j && j.ok) ? { ok: true } : { ok: false, reason: (j && j.reason) || 'error' };
        }, function () { return { ok: false, reason: 'error' }; });
      },
      // Character (R70): any i, a or v id. Same server call as setVipIcon (migration-47/48 check the shape).
      setIcon: function (tok, id) {
        return call('POST', '/rest/v1/rpc/player_set_icon', { p_token: tok, p_icon: id }).then(function (j) {
          return (j && j.ok) ? { ok: true } : { ok: false, reason: (j && j.reason) || 'error' };
        }, function () { return { ok: false, reason: 'error' }; });
      },
      // Username (migration-44): 3 to 14 letters, digits or _, changed once every 30 days.
      // R226 My account: PIN change and delete (player_change_pin, player_delete_me).
      playerChangePin: function (token, oldPin, newPin) { return call('POST', '/rest/v1/rpc/player_change_pin', { p_token: token, p_old_pin: oldPin, p_new_pin: newPin }).then(function (j) { return (j && j.ok) ? { ok: true } : { ok: false, reason: (j && j.reason) || 'error' }; }, function () { return { ok: false, reason: 'error' }; }); },
      playerDeleteMe: function (token, pin) { return call('POST', '/rest/v1/rpc/player_delete_me', { p_token: token, p_pin: pin }).then(function (j) { return (j && j.ok) ? { ok: true } : { ok: false, reason: (j && j.reason) || 'error' }; }, function () { return { ok: false, reason: 'error' }; }); },
      playerChangeName: function (token, first, lastInitial) { return call('POST', '/rest/v1/rpc/player_change_name', { p_token: token, p_first: first, p_last_initial: lastInitial }); },
      playerMyData: function (token) { return call('POST', '/rest/v1/rpc/player_my_data', { p_token: token }); },
      setUsername: function (tok, name) {
        return call('POST', '/rest/v1/rpc/player_set_username', { p_token: tok, p_name: name }).then(function (j) {
          return (j && j.ok) ? { ok: true, username: j.username } : { ok: false, reason: (j && j.reason) || 'error' };
        }, function () { return { ok: false, reason: 'error' }; });
      },
      // Patch A: show-me switch (migration-44) and the test alert (migration-46).
      setVisible: function (tok, on) {
        return call('POST', '/rest/v1/rpc/player_set_visible', { p_token: tok, p_on: !!on }).then(function (j) {
          return (j && j.ok) ? { ok: true, visible: !!j.visible } : { ok: false, reason: (j && j.reason) || 'error' };
        }, function () { return { ok: false, reason: 'error' }; });
      },
      sendTestAlert: function (tok) {
        return call('POST', '/rest/v1/rpc/player_send_test_alert', { p_token: tok }).then(function (j) {
          return (j && j.ok) ? { ok: true } : { ok: false, reason: (j && j.reason) || 'error' };
        }, function () { return { ok: false, reason: 'error' }; });
      },
      // Join keypad (R113): player_check_in from migration 25. The answer passes through with its reason.
      // Run status (player_run_status, live paste 58e): open / removed / ended / none / cancelled, with codeMadeAt.
      runStatus: function (token, nightId) {
        return call('POST', '/rest/v1/rpc/player_run_status', { p_token: token, p_night: nightId })
          .then(function (j) {
            if (!j || j.ok !== true) return { ok: false };
            // checkedIn (72i): true when this player has joined by code for this code time. Needs the field in player_run_status.
            return { ok: true, state: j.state || '', nightId: j.nightId || nightId, codeMadeAt: j.codeMadeAt ? String(j.codeMadeAt) : '', checkedIn: j.checkedIn === true };
          }, function () { return { ok: false }; });
      },
      checkIn: function (token, nightId, code) {
        return call('POST', '/rest/v1/rpc/player_check_in', { p_token: token, p_night: nightId, p_code: String(code || '') })
          .then(function (j) {
            if (j && j.ok === true) return { ok: true, here: true };
            return { ok: false, reason: (j && j.reason) || 'error', triesLeft: j && j.triesLeft, until: j && j.until, opensAt: j && j.opensAt };
          }, function () { return { ok: false, reason: 'error' }; });
      },
      // Live feed (P9): the organiser's live row, read only with the anon key. Holds the court, scores, fouls, the clock and the run date. Never who is in or who paid.
      getLive: function () {
        return call('GET', '/rest/v1/live_state?select=payload,updated_at&id=eq.tonight').then(function (rows) {
          var r = rows && rows[0];
          return r ? { payload: r.payload, updatedAt: r.updated_at } : null;
        });
      },
      // 72k: a tiny read (updated_at only) every 2 s on a run day. The full night is read only when the stamp moved.
      getNightStamp: function (id) {
        return call('GET', '/rest/v1/nights?select=updated_at&id=eq.' + encodeURIComponent(id)).then(function (rows) {
          var r = rows && rows[0];
          return { ok: true, stamp: r ? String(r.updated_at || '') : '' };
        }, function () { return { ok: false }; });
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
      // Auto runs (JORD-PASTE-62): the next upcoming run from the runs table. { date, start } or null.
      nextRun: function () {
        return call('POST', '/rest/v1/rpc/player_next_run', {}).then(function (j) {
          return j && j.date ? { date: j.date, start: j.start || '' } : null;
        }, function () { return null; });
      },
    };
  }

  // The rules helpers (rules.js). In the browser they are a global; in Node tests they may be set on globalThis.
  function rulesApi() {
    return (typeof PlayerRules !== 'undefined') ? PlayerRules : (globalThis.PlayerRules || null);
  }

  // P13: keep only the fields the Live waiting room needs. Room lists, notes and versions never reach the app.
  function upcomingShape(runs) {
    return (Array.isArray(runs) ? runs : []).filter(function (r) { return r && typeof r === 'object'; }).map(function (r) {
      return { id: r.id, startsAt: r.startsAt, status: r.status, runOff: r.runOff === true,
        me: { in: !!(r.me && r.me.in === true), paid: !!(r.me && r.me.paid === true) } };
    });
  }

  // P13: one upcoming_list call a minute. reset() on sign-out and sign-in, so a new player never sees the old state.
  function upcomingGate(be) {
    var last = null, at = 0, gen = 0;
    return {
      load: function (token, now) {
        now = now || Date.now();
        if (last && now - at < 60000) return Promise.resolve(last);
        at = now;
        var my = gen;
        return be.upcomingList(token).then(function (r) {
          if (my !== gen) return { ok: true, runs: [], stale: true };   // a reset came while this was on the way
          last = r; return r;
        });
      },
      reset: function () { last = null; at = 0; gen++; }
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

  return { create: create, memoryStore: memoryStore, upcomingShape: upcomingShape, upcomingGate: upcomingGate };
});
