/* Head-to-head card block and game log block (player app, N12). Plain JS, no framework, reads only.
 * Browser: window.PlayerHeadToHead. Node tests: head-to-head.test.js.
 * Data in (fetched by the caller, see HOOKS.md):
 *   h2h  = player_head_to_head(p_token, p_other)  { ok, enough, games, player, with, against }
 *   log  = player_game_log(p_token)               { ok, games, by_colour, best_teammate, rival }
 * Rules: no percentage anywhere. Under 3 games together shows "Not enough games yet". Blocks are empty
 * (html '') when the data is missing or the call failed, so the caller hides the block.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerHeadToHead = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(n) { var v = Number(n); return isFinite(v) ? Math.max(0, Math.floor(v)) : 0; }
  function plural(n, one, many) { return num(n) + ' ' + (num(n) === 1 ? one : many); }
  function nameOf(p) { return p ? (p.first + ' ' + (p.last_initial || '')).trim() : ''; }

  // "2 wins, 0 losses" plus "1 draw" only when there are draws.
  function recordText(r) {
    var parts = [plural(r.wins, 'win', 'wins'), plural(r.losses, 'loss', 'losses')];
    if (num(r.draws) > 0) parts.push(plural(r.draws, 'draw', 'draws'));
    return parts.join(', ');
  }

  // Card block: the record with this player and against them.
  function buildCard(h2h) {
    if (!h2h || h2h.ok !== true || !h2h.player) return { html: '' };
    var name = esc(h2h.player.first);
    if (h2h.enough !== true) {
      return { html: '<section class="hh-card" aria-label="Head to head">' +
        '<p class="hh-name">With ' + name + '</p>' +
        '<p class="hh-empty">Not enough games yet</p></section>' };
    }
    return { html: '<section class="hh-card" aria-label="Head to head">' +
      '<p class="hh-name">With ' + name + '</p>' +
      '<dl class="hh-rows">' +
        '<div><dt>With</dt><dd>' + esc(recordText(h2h['with'])) + '</dd></div>' +
        '<div><dt>Against</dt><dd>' + esc(recordText(h2h.against)) + '</dd></div>' +
      '</dl></section>' };
  }

  function resultWord(r) { return r === 'win' ? 'Win' : (r === 'loss' ? 'Loss' : 'Draw'); }

  // Profile block: last 10 games, record by colour, best team mate, rival.
  function buildLog(log) {
    if (!log || log.ok !== true) return { html: '' };
    var games = Array.isArray(log.games) ? log.games : [];
    var colours = Array.isArray(log.by_colour) ? log.by_colour : [];
    var html = '<section class="hh-log" aria-label="Game history">';

    if (games.length === 0) {
      html += '<p class="hh-empty">No finished games yet</p>';
    } else {
      html += '<h3 class="hh-title">Last ' + esc(games.length) + ' games</h3><ul class="hh-games">';
      games.forEach(function (g) {
        html += '<li class="hh-game is-' + esc(g.result) + '"><span>' + esc(resultWord(g.result)) + '</span>' +
          '<b>' + esc(g.my_score) + '–' + esc(g.their_score) + '</b>' +
          '<span class="hh-sub">' + esc(g.colour) + ' v ' + esc(g.opponent_colour) + '</span></li>';
      });
      html += '</ul>';
    }

    if (colours.length) {
      html += '<h3 class="hh-title">By colour</h3><ul class="hh-colours">';
      colours.forEach(function (c) {
        html += '<li><span>' + esc(c.colour) + '</span><b>' + num(c.wins) + '–' + num(c.losses) + '–' + num(c.draws) + '</b></li>';
      });
      html += '</ul>';
    }

    if (log.best_teammate) {
      var bt = log.best_teammate;
      html += '<p class="hh-line"><span>Best teammate</span><b>' + esc(nameOf(bt)) + '</b>' +
        '<span class="hh-sub">' + esc(plural(bt.wins, 'win', 'wins')) + ' in ' + esc(bt.games) + ' games</span></p>';
    }
    if (log.rival) {
      var rv = log.rival;
      html += '<p class="hh-line"><span>Rival</span><b>' + esc(nameOf(rv)) + '</b>' +
        '<span class="hh-sub">beat you in ' + esc(rv.beat_you) + ' of ' + esc(rv.games) + ' games</span></p>';
    }
    html += '</section>';
    return { html: html };
  }

  return { buildCard: buildCard, buildLog: buildLog, recordText: recordText, esc: esc };
});
