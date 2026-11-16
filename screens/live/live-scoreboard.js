/* Live scoreboard panel (player app, P13). Plain JS, pure, no network.
 * html(board) -> markup. board = the data from backend.scoreboard(): { game, teamAName, teamBName, scoreA, scoreB, events[] }.
 * Shows team names and team scores, and the latest five baskets as team moments. Never a scorer name (R64).
 * Node tests: tests/p13-waiting-scoreboard.test.js
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerLiveScoreboard = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clock(at) {
    var d = new Date(at);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  // Newest five moments, with the score after each one. Team fields only.
  function moments(events) {
    return (Array.isArray(events) ? events : []).filter(function (e) { return e && typeof e === 'object'; })
      .slice(0, 5).map(function (e) {
        return { side: e.side === 'B' ? 'B' : 'A', points: Number(e.points) || 0,
          teamA: Number(e.teamA) || 0, teamB: Number(e.teamB) || 0, at: e.at };
      });
  }
  function html(b) {
    b = b || {};
    var na = esc(b.teamAName || 'Team A'), nb = esc(b.teamBName || 'Team B');
    var rows = moments(b.events).map(function (m) {
      var who = m.side === 'B' ? nb : na;
      return '<li class="sb-move"><span class="sb-who">' + who + ' +' + esc(m.points) + '</span>' +
        '<span class="lv-muted">' + esc(clock(m.at)) + '</span>' +
        '<span class="sb-after">' + esc(m.teamA) + ' – ' + esc(m.teamB) + '</span></li>';
    }).join('');
    return '<section class="lv-card sb" aria-labelledby="lvBoard">' +
      '<div class="lv-top"><span class="lv-cap">Game ' + esc(b.game || '') + '</span></div>' +
      '<h2 class="lv-h" id="lvBoard">Scoreboard</h2>' +
      '<div class="sb-score" aria-label="' + na + ' ' + esc(b.scoreA || 0) + ', ' + nb + ' ' + esc(b.scoreB || 0) + '">' +
        '<div class="sb-side"><span class="lv-team">' + na + '</span><span class="sb-num">' + esc(b.scoreA || 0) + '</span></div>' +
        '<span class="lv-vs" aria-hidden="true">–</span>' +
        '<div class="sb-side"><span class="lv-team">' + nb + '</span><span class="sb-num">' + esc(b.scoreB || 0) + '</span></div>' +
      '</div>' +
      (rows ? '<ol class="sb-moves" aria-label="Latest scores">' + rows + '</ol>' : '<p class="lv-muted">No baskets yet.</p>') +
    '</section>';
  }
  return { html: html, moments: moments };
});
