/* Leaderboard screen: team standings and top players.
   Plain JS, no framework, no network. Every player name goes through PlayerName (lib/player-name.js),
   so level, prestige stars, banner, clan tag and row effect show on each row.
   Spec: revamp/build/player-app-plan/XP-SYSTEM.md section 6 and ARCHITECTURE-RESEARCH.md.

   Usage:
     Leaderboard.mount(el, { teams: [...], players: [...] }, { meId: 7, myTeamId: 'b', sort: 'level' })
     Leaderboard.html(data, { meId: 7, myTeamId: 'b', sort: 'points' }) // markup only

   Player: { id, name, level, stars, points, wins, banner, nameStyle, clanTag, emblemSrc, rowEffect }
   Team:   { id, name, played, wins, points }
   Sort:   'level' (default: prestige stars, then level, then points) or 'points' (points, then wins).
   Ties share a rank (1, 1, 3). Names are escaped everywhere.
*/
(function (root) {
  'use strict';

  function PN() { return root.PlayerName; }

  function esc(s) {
    return PN() ? PN().esc(s) : String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  // Thousands separator, plain and fixed (no locale surprises).
  function fmt(v) {
    return String(num(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function cmpText(a, b) {
    var x = String(a || ''), y = String(b || '');
    return x < y ? -1 : x > y ? 1 : 0;
  }

  // Players sorted for the chosen mode. Returns a new array.
  function sortPlayers(players, mode) {
    var list = (players || []).slice();
    list.sort(function (a, b) {
      if (mode === 'points') {
        return (num(b.points) - num(a.points)) || (num(b.wins) - num(a.wins)) || cmpText(a.name, b.name);
      }
      return (num(b.stars) - num(a.stars)) || (num(b.level) - num(a.level)) ||
        (num(b.points) - num(a.points)) || cmpText(a.name, b.name);
    });
    return list;
  }

  // Teams: most wins, then most points, then name.
  function sortTeams(teams) {
    var list = (teams || []).slice();
    list.sort(function (a, b) {
      return (num(b.wins) - num(a.wins)) || (num(b.points) - num(a.points)) || cmpText(a.name, b.name);
    });
    return list;
  }

  // Competition ranking: equal keys share a rank, the next rank skips.
  function rankList(list, keyFn) {
    var out = [];
    var rank = 0;
    var prev = null;
    list.forEach(function (item, i) {
      var k = keyFn(item);
      if (i === 0 || k !== prev) { rank = i + 1; prev = k; }
      out.push({ rank: rank, item: item });
    });
    return out;
  }

  function playerKey(p, mode) {
    return mode === 'points'
      ? num(p.points) + '|' + num(p.wins)
      : num(p.stars) + '|' + num(p.level) + '|' + num(p.points);
  }

  function playerRow(entry, opts) {
    var p = entry.item;
    var me = opts.meId != null && String(p.id) === String(opts.meId);
    var chip = PN().html({
      name: p.name,
      level: p.level,
      stars: p.stars,
      banner: p.banner,
      nameStyle: p.nameStyle,
      clanTag: p.clanTag,
      emblemSrc: p.emblemSrc,
      rowEffect: p.rowEffect,
      size: 'compact'
    });
    return '<li class="lb-row' + (me ? ' lb-row--me' : '') + '"' + (me ? ' aria-current="true"' : '') + '>' +
      '<span class="lb-rank" aria-label="Rank ' + entry.rank + '">' + entry.rank + '</span>' +
      chip +
      '<span class="lb-stat"><b>' + fmt(p.points) + '</b> pts' +
      (me ? '<span class="lb-you">You</span>' : '') + '</span>' +
      '</li>';
  }

  function teamRow(entry, opts) {
    var t = entry.item;
    var mine = opts.myTeamId != null && String(t.id) === String(opts.myTeamId);
    return '<li class="lb-row' + (mine ? ' lb-row--me' : '') + '"' + (mine ? ' aria-current="true"' : '') + '>' +
      '<span class="lb-rank" aria-label="Rank ' + entry.rank + '">' + entry.rank + '</span>' +
      '<span class="lb-card"><span class="lb-team">' + esc(t.name) + '</span>' +
      '<span class="lb-sub">' + fmt(t.wins) + ' wins from ' + fmt(t.played) + '</span></span>' +
      '<span class="lb-stat"><b>' + fmt(t.points) + '</b> pts' +
      (mine ? '<span class="lb-you">You</span>' : '') + '</span>' +
      '</li>';
  }

  function html(data, opts) {
    data = data || {};
    opts = opts || {};
    var mode = opts.sort === 'points' ? 'points' : 'level';
    var teams = sortTeams(data.teams);
    var players = sortPlayers(data.players, mode);

    var teamRows = rankList(teams, function (t) { return num(t.wins) + '|' + num(t.points); })
      .map(function (e) { return teamRow(e, opts); }).join('');
    var playerRows = rankList(players, function (p) { return playerKey(p, mode); })
      .map(function (e) { return playerRow(e, opts); }).join('');

    var seg = '<div class="lb-seg" role="group" aria-label="Sort players">' +
      '<button type="button" data-sort="level" aria-pressed="' + (mode === 'level') + '">Level</button>' +
      '<button type="button" data-sort="points" aria-pressed="' + (mode === 'points') + '">Points</button>' +
      '</div>';

    // No <h1> here: the app shell already shows the screen title.
    return '<header>' +
      '<p class="muted">' + esc(opts.updatedText || 'Updates after each night.') + '</p>' +
      '</header>' +
      '<section aria-labelledby="lb-teams-h">' +
      '<h2 id="lb-teams-h">Team Standings</h2>' +
      (teams.length ? '<ol class="lb-list">' + teamRows + '</ol>'
        : '<p class="lb-empty">No teams yet. Standings show after the first night.</p>') +
      '</section>' +
      '<section aria-labelledby="lb-players-h">' +
      '<h2 id="lb-players-h">Top Players</h2>' +
      seg +
      (players.length ? '<ol class="lb-list">' + playerRows + '</ol>'
        : '<p class="lb-empty">No players yet. Sign up to get on the board.</p>') +
      '</section>';
  }

  // Renders into el, wires the Level / Points buttons, and keeps focus on the button pressed.
  function mount(el, data, opts) {
    opts = opts || {};
    var state = { sort: opts.sort === 'points' ? 'points' : 'level' };

    function draw(focusSort) {
      el.innerHTML = html(data, { meId: opts.meId, myTeamId: opts.myTeamId, sort: state.sort, updatedText: opts.updatedText });
      var btns = el.querySelectorAll('[data-sort]');
      Array.prototype.forEach.call(btns, function (b) {
        b.addEventListener('click', function () {
          state.sort = b.getAttribute('data-sort');
          draw(state.sort);
        });
      });
      if (focusSort) {
        var again = el.querySelector('[data-sort="' + focusSort + '"]');
        if (again) again.focus();
      }
    }

    draw(null);
    return {
      setSort: function (mode) { state.sort = mode === 'points' ? 'points' : 'level'; draw(null); },
      sort: function () { return state.sort; }
    };
  }

  var api = {
    html: html,
    mount: mount,
    sortPlayers: sortPlayers,
    sortTeams: sortTeams,
    rankList: rankList,
    fmt: fmt
  };

  root.Leaderboard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
