/* MVP + profile data for the player app. Browser: window.PlayerMvpBackend. Node tests: screens/mvp/mvp.test.js.
   Two adapters with the same methods:
   - makeSupabase(rpc): calls the migration-10 functions with the player's sign-in token (anon RPCs only).
     rpc(name, body) must return a promise of the parsed JSON (backend.js already has this call helper).
   - makeMock(storage, opts): one device, for tests and the mock page. Never used in production.
   Methods: eligible(token, nightId), myVote(token, nightId), vote(token, nightId, candidateId), profile(token).
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlayerMvpBackend = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var MOCK_KEY = '1to1-mvp-mock';

  // Supabase: the RPC names are the ones in supabase/migration-10-mvp.sql.
  function makeSupabase(rpc) {
    return {
      kind: 'supabase',
      eligible: function (token, nightId) {
        return rpc('player_mvp_eligible', { p_token: token, p_night: nightId }).then(function (j) {
          return j || { ok: false, reason: 'error', players: [] };
        }, function () { return { ok: false, reason: 'error', players: [] }; });
      },
      myVote: function (token, nightId) {
        return rpc('player_mvp_my_vote', { p_token: token, p_night: nightId }).then(function (j) {
          return j || { ok: false, vote: null };
        }, function () { return { ok: false, vote: null }; });
      },
      vote: function (token, nightId, candidateId) {
        return rpc('player_mvp_vote', { p_token: token, p_night: nightId, p_candidate: candidateId }).then(function (j) {
          return j || { ok: false, reason: 'error' };
        }, function () { return { ok: false, reason: 'error' }; });
      },
      profile: function (token) {
        return rpc('player_profile', { p_token: token }).then(function (j) {
          return j && j.ok ? j : { ok: false, totals: {}, nights: [] };
        }, function () { return { ok: false, totals: {}, nights: [] }; });
      }
    };
  }

  // Mock: one device. opts.me {id, first, lastInitial}; opts.players [{id, first, lastInitial}] for the night.
  // Votes are kept in storage (localStorage in the browser, a plain object in tests).
  function makeMock(storage, opts) {
    opts = opts || {};
    var me = opts.me || { id: 'me', first: 'Sam', lastInitial: 'K' };
    var players = opts.players || [];
    function load() {
      try { return JSON.parse(storage.getItem(MOCK_KEY) || '{}'); } catch (e) { return {}; }
    }
    function save(db) { storage.setItem(MOCK_KEY, JSON.stringify(db)); }
    function played(id) { return players.some(function (p) { return p.id === id; }); }
    return {
      kind: 'mock',
      eligible: function (token, nightId) {
        return Promise.resolve({ ok: true, me: me, players: players.filter(function (p) { return p.id !== me.id; }), night: nightId });
      },
      myVote: function (token, nightId) {
        return Promise.resolve({ ok: true, vote: (load()[nightId] || {})[me.id] || null });
      },
      vote: function (token, nightId, candidateId) {
        return Promise.resolve().then(function () {
          if (candidateId === me.id) return { ok: false, reason: 'self' };
          if (!played(candidateId)) return { ok: false, reason: 'not-played' };
          var db = load();
          db[nightId] = db[nightId] || {};
          db[nightId][me.id] = candidateId;
          save(db);
          return { ok: true };
        });
      },
      profile: function () {
        return Promise.resolve({ ok: true, totals: { games: 0, wins: 0, points: 0, fouls: 0, violations: 0, nights: 0, mvp: 0 }, nights: [] });
      }
    };
  }

  return { makeSupabase: makeSupabase, makeMock: makeMock, MOCK_KEY: MOCK_KEY };
});
