/* Scoring moment card for Live (player app, P10b). Plain JS. Reads nothing: feed it the events
 * already returned by player_live_scoreboard(p_token, p_night) -> events[] { at, side, points, teamA, teamB }.
 * Rules: team score only (no scorer name, no per-player points: that step is off, R64). One card at a time,
 * 2 s each. Reduced motion: fade only (CSS). Quiet on undo: a card already shown is not replayed.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerScoreCard = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function cardHtml(ev) {
    var team = ev.side === 'B' ? 'Team B' : 'Team A';
    var score = ev.side === 'B' ? ev.teamB : ev.teamA;
    return '<div class="sc-card" role="status" aria-live="polite"><span class="sc-pts">' + esc(score) + '</span>' +
      '<span class="sc-sub">' + esc(team) + ' score</span></div>';
  }
  // Keeps only events newer than the last one seen (so a reload does not replay old baskets).
  function fresh(events, lastAt) {
    return (events || []).filter(function (e) { return e && e.at && (!lastAt || e.at > lastAt); })
      .sort(function (x, y) { return x.at < y.at ? -1 : x.at > y.at ? 1 : 0; });
  }
  function create(show, opts) {
    opts = opts || {};
    var setT = opts.setTimeout || root.setTimeout, clearT = opts.clearTimeout || root.clearTimeout;
    var queue = [], timer = null, lastAt = opts.lastAt || null;
    function next() {
      timer = null;
      if (!queue.length) return;
      var ev = queue.shift();
      show(cardHtml(ev));
      timer = setT(next, opts.duration || 2000);
    }
    return {
      feed: function (events) {
        var news = fresh(events, lastAt);
        if (news.length) lastAt = news[news.length - 1].at;
        news.forEach(function (e) { queue.push(e); });
        if (!timer) next();
        return news.length;
      },
      pending: function () { return queue.length + (timer ? 1 : 0); },
      stop: function () { if (timer) clearT(timer); timer = null; queue = []; }
    };
  }
  return { cardHtml: cardHtml, fresh: fresh, create: create };
});
