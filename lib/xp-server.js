/* Turns the server answer from player_xp_summary (migration 7) into the run object lib/xp.js uses,
   so the profile XP bar (PlayerXp.progress) shows what the server holds. Pure: no DOM, no network.
   Browser: window.PlayerXpServer. Node: module.exports.
   Use: var run = PlayerXpServer.runFromSummary(json);   // json = the rpc result, or null on error
        var bar = PlayerXp.progress(run);                // same as before
   If the summary is missing or ok:false, it returns null and the caller keeps its local run. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerXpServer = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clampInt(v, lo, hi) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }

  // Engine run shape (see lib/xp.js newRun). Level is the server's level; XP is the server's run XP.
  function runFromSummary(s) {
    if (!s || s.ok !== true) return null;
    var level = clampInt(s.level, 1, 60);
    var xp = Math.max(0, Math.round(Number(s.xp) || 0));
    var nights = Array.isArray(s.nights) ? s.nights : [];
    var last = nights.length ? nights[0] : null;   // newest first, from the server
    return {
      xp: xp,
      lifetimeXp: xp,
      stars: clampInt(s.stars, 0, 5),
      prestiges: clampInt(s.prestiges, 0, 999),
      streak: last && last.streak_weeks ? clampInt(last.streak_weeks, 0, 99) : 0,
      lastWeek: last ? clampInt(last.week, 1, 9999) : null,
      lastNight: last ? last.night_id : null,
      maxLevel: level
    };
  }

  // Recent nights for the "last 5 nights" list (XP-SYSTEM section 5). Newest first.
  function recentNights(s) {
    if (!s || s.ok !== true || !Array.isArray(s.nights)) return [];
    return s.nights.map(function (n) {
      return { week: n.week, games: n.games, points: n.points, wins: n.wins, mvp: !!n.mvp, xp: n.xp_earned != null ? n.xp_earned : n.xp_base,
        streakWeeks: n.streak_weeks, parts: n.parts || {} };
    });
  }

  return { runFromSummary: runFromSummary, recentNights: recentNights };
});
