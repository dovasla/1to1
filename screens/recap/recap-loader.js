/* Loads the morning-after recap for the signed-in player (P5b). Reads only, no writes.
   Browser: window.PlayerRecapLoader. Node tests: recap-loader.test.js.
   Calls (names and inputs from the live B3 function list, revamp/qa/live-eq/LIVE-EQ-B3-FUNCTIONS.txt):
     player_profile(p_token)                 -> { ok, nights: [{ night_id, night_date, games, ... }] }
     player_xp_summary(p_token)              -> { ok, xp, level, nights: [{ night_id, xp_earned, parts }] }
     player_night_top(p_token, p_night)      -> { ok, rows: [{ first, last_initial, level, points, wins, games, mvp }] }
     player_mvp_eligible(p_token, p_night)   -> { ok, players: [...], closed }
     player_mvp_my_vote(p_token, p_night)    -> { ok, vote }
   Every call goes through lib/load-timeout.js (12 s). Result: { state: 'empty' | 'error' | 'ready', ... }.
*/
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerRecapLoader = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var TO = root.PlayerLoadTimeout || (typeof require === 'function' ? require('../../lib/load-timeout.js') : null);

  function ok(j) { return j && j.ok === true; }

  // The last night the player actually played (games > 0), newest first.
  function lastPlayed(profile) {
    var nights = ((profile && profile.nights) || []).filter(function (n) { return n && Number(n.games) > 0; });
    nights.sort(function (a, b) { return Date.parse(b.night_date) - Date.parse(a.night_date); });
    return nights[0] || null;
  }

  // rpc(name, body) -> Promise of parsed JSON (or { ok: false }). Always wrapped in the 12 s timeout.
  function load(rpc, token) {
    var t = function (p) { return TO.withTimeout(p, TO.LIMIT_MS); };
    return t(Promise.all([
      rpc('player_profile', { p_token: token }),
      rpc('player_xp_summary', { p_token: token })
    ])).then(function (both) {
      var profile = both[0], summary = both[1];
      if (!ok(profile) || !ok(summary)) return { state: 'error' };
      var last = lastPlayed(profile);
      if (!last) return { state: 'empty' };
      return t(Promise.all([
        rpc('player_night_top', { p_token: token, p_night: last.night_id }),
        rpc('player_mvp_eligible', { p_token: token, p_night: last.night_id }),
        rpc('player_mvp_my_vote', { p_token: token, p_night: last.night_id })
      ])).then(function (rest) {
        var top = rest[0], elig = rest[1], mine = rest[2];
        var closed = !!(elig && elig.closed);
        return {
          state: 'ready',
          profile: profile,
          summary: summary,
          top: ok(top) && Array.isArray(top.rows) ? top.rows : [],
          mvp: {
            night: last.night_id,
            open: !closed,
            confirmed: closed,
            voted: !!(ok(mine) && mine.vote),
            eligible: ok(elig) && !closed
          }
        };
      });
    }).then(null, function () { return { state: 'error' }; });
  }

  return { load: load, lastPlayed: lastPlayed };
});
