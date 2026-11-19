/* Leaderboard screen: team standings and top players.
   Patch B (next-66, R85): players show their picture and their equipped look on each row.
   Plain JS, no framework, no network. Every player name goes through PlayerName (lib/player-name.js),
   which draws the stars, the banner strip, the name style and the row effect. That is the shop's renderer;
   nothing is copied here.
   Spec: revamp/build/player-app-plan/XP-SYSTEM.md section 6 and ARCHITECTURE-RESEARCH.md.

   Usage:
     Leaderboard.mount(el, { teams: [...], players: [...] }, { meId: 7, myTeamId: 'b', sort: 'level', iconHtml: fn })
     Leaderboard.html(data, { meId: 7, myTeamId: 'b', sort: 'points' }) // markup only

   Player: { id, name, level, stars, points, wins, icon, look, clanTag, emblemSrc, under18, hidden, visible }
     icon:  a character id (a01), an icon id (i07) or a VIP picture id (v03). Shown left of the name.
            Missing or odd ids get the plain mark.
     look:  equipped shop items { banner, name, row } (flat banner / nameStyle / rowEffect also work).
     Hidden: hidden:true, visible:false or under18:true. Shown as "Player" with the plain mark, no look,
            no level, no stars, no points, and no tap. A player's own row is never hidden to them.
   Options: iconHtml(id) -> markup for an i or v id (the app passes its icon renderer). Optional.
   Team:  { id, name, played, wins, points }
   Sort:  'level' (default: prestige stars, then level, then points) or 'points' (points, then wins).
          Hidden players compare as zero, so their numbers never move them up the board.
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

  // Icon ids: a or i + 2 or 3 digits (characters and icons), v + 2 digits (VIP pictures).
  var ICON_RE = /^(?:[ia]\d{2,3}|v\d{2})$/;
  var CHAR_RE = /^a\d{2,3}$/;

  // Hidden for others: the server flag, visible:false, or under-18. Never hidden on the player's own row.
  function isHidden(p, meId) {
    if (meId != null && String(p.id) === String(meId)) return false;
    return p.hidden === true || p.visible === false || p.under18 === true;
  }

  // The values the board may compare and show. Hidden players count as zero.
  function view(p, meId) {
    var hidden = isHidden(p, meId);
    return {
      name: hidden ? 'Player' : String(p.name || ''),
      level: hidden ? 0 : num(p.level),
      stars: hidden ? 0 : num(p.stars),
      points: hidden ? 0 : num(p.points),
      wins: hidden ? 0 : num(p.wins)
    };
  }

  // Players sorted for the chosen mode. Returns a new array of the player objects.
  function sortPlayers(players, mode, meId) {
    var list = (players || []).slice();
    list.sort(function (a, b) {
      var x = view(a, meId), y = view(b, meId);
      if (mode === 'points') {
        return (y.points - x.points) || (y.wins - x.wins) || cmpText(x.name, y.name);
      }
      return (y.stars - x.stars) || (y.level - x.level) || (y.points - x.points) || cmpText(x.name, y.name);
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

  function playerKey(p, mode, meId) {
    var v = view(p, meId);
    return mode === 'points'
      ? v.points + '|' + v.wins
      : v.stars + '|' + v.level + '|' + v.points;
  }

  // Equipped look, read from the player. PlayerName cleans every value again, so odd text never reaches the markup.
  function lookOf(p) {
    var l = p.look || p.equipped || {};
    // Stage 2: every worn layer (l_<layer> keys from the server loadout) reaches the board row card.
    var layers = {};
    ['background', 'frame', 'emblem', 'title', 'effect', 'name', 'card', 'flourish', 'row', 'ring', 'intro', 'pop'].forEach(function (k) {
      var v = l['l_' + k] || (p.layers && p.layers[k]);
      if (v) layers[k] = v;
    });
    return {
      banner: l.banner || p.banner || '',
      nameStyle: l.name || l.nameStyle || p.nameStyle || '',
      rowEffect: l.row || l.rowEffect || p.rowEffect || '',
      // Shop look (12 ids). PlayerName keeps only known ids, so an odd value is ignored.
      look: l.l_effect || l.effect || (p.layers && p.layers.effect) || '',
      layers: layers
    };
  }

  // The plain mark: one SVG, used when there is no picture to show.
  function plainBall() {
    return '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="10" fill="currentColor" opacity=".25"/>' +
      '<path d="M2 12h20M12 2v20M5 5c4 4 4 10 0 14M19 5c-4 4-4 10 0 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  // The small picture left of the name. Characters are cropped to head and upper body (CSS).
  function avatarHtml(p, opts, hidden) {
    // r7: approved photo first, then the chosen Phosphor icon. Both only come from public_id looks (never names).
    if (!hidden && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(String(p.photo || ''))) {
      return '<span class="lb-av lb-av--photo" aria-hidden="true"><img src="' + p.photo + '" alt="" loading="lazy" decoding="async"></span>';
    }
    if (!hidden && /^[a-z-]{3,30}$/.test(String(p.phIcon || ''))) {
      return '<span class="lb-av" aria-hidden="true"><span class="ph-glyph" style="-webkit-mask-image:url(icons/phosphor/' + p.phIcon + '.svg);mask-image:url(icons/phosphor/' + p.phIcon + '.svg)"></span></span>';
    }
    var id = hidden ? '' : String(p.icon || '');
    var inner = '';
    if (ICON_RE.test(id)) {
      if (CHAR_RE.test(id)) {
        inner = '<img src="icons/characters/set/' + id + '.svg" alt="" loading="lazy" decoding="async">';
      } else if (typeof opts.iconHtml === 'function') {
        inner = opts.iconHtml(id) || '';
      }
    }
    return '<span class="lb-av' + (inner ? '' : ' lb-av--ball') + '" aria-hidden="true">' + (inner || plainBall()) + '</span>';
  }

  function playerRow(entry, opts) {
    var p = entry.item;
    var me = opts.meId != null && String(p.id) === String(opts.meId);
    var hidden = isHidden(p, opts.meId);
    var look = hidden ? {} : lookOf(p);
    var chip = PN().html({
      name: hidden ? 'Player' : p.name,
      mock: hidden,
      level: p.level,
      stars: p.stars,
      banner: look.banner,
      nameStyle: look.nameStyle,
      clanTag: hidden ? '' : p.clanTag,
      emblemSrc: hidden ? '' : p.emblemSrc,
      rowEffect: look.rowEffect,
      look: hidden ? '' : look.look,
      layers: look.layers,
      size: 'compact'
    });
    var stat = hidden
      ? '<span class="lb-stat"></span>'
      : '<span class="lb-stat"><b>' + fmt(p.points) + '</b> ' + esc(opts.valueLabel || 'pts') +
        (me ? '<span class="lb-you">You</span>' : '') + '</span>';
    var cls = 'lb-row lb-row--player' + (me ? ' lb-row--me' : '') + (hidden ? ' lb-row--hidden' : '');
    var tap = hidden ? '' : ' data-player="' + esc(String(p.id)) + '"';
    return '<li class="' + cls + '"' + (me ? ' aria-current="true"' : '') + tap + '>' +
      '<span class="lb-rank" aria-label="Rank ' + entry.rank + '">' + entry.rank + '</span>' +
      avatarHtml(p, opts, hidden) +
      chip +
      stat +
      '</li>';
  }

  function teamRow(entry, opts) {
    var t = entry.item;
    var mine = opts.myTeamId != null && String(t.id) === String(opts.myTeamId);
    return '<li class="lb-row lb-row--team' + (mine ? ' lb-row--me' : '') + '"' + (mine ? ' aria-current="true"' : '') + '>' +
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
    var players = sortPlayers(data.players, mode, opts.meId);

    var teamRows = rankList(teams, function (t) { return num(t.wins) + '|' + num(t.points); })
      .map(function (e) { return teamRow(e, opts); }).join('');
    var playerRows = rankList(players, function (p) { return playerKey(p, mode, opts.meId); })
      .map(function (e) { return playerRow(e, opts); }).join('');

    var seg = '<div class="lb-seg" role="group" aria-label="Sort players">' +
      '<button type="button" data-sort="level" aria-pressed="' + (mode === 'level') + '">Level</button>' +
      '<button type="button" data-sort="points" aria-pressed="' + (mode === 'points') + '">Points</button>' +
      '</div>';

    // r9: with no teams and no players, one empty card instead of two.
    if (!teams.length && !players.length) {
      return '<header>' +
        '<p class="muted">' + esc(opts.updatedText || 'Updates after each run.') + '</p>' +
        '</header>' +
        '<p class="lb-empty">Stats appear after the first game.</p>';
    }
    // No <h1> here: the app shell already shows the screen title.
    return '<header>' +
      '<p class="muted">' + esc(opts.updatedText || 'Updates after each run.') + '</p>' +
      '</header>' +
      '<section aria-labelledby="lb-teams-h">' +
      '<h2 id="lb-teams-h">Team Standings</h2>' +
      (teams.length ? '<ol class="lb-list">' + teamRows + '</ol>'
        : '<p class="lb-empty">No teams yet. Standings show after the first game.</p>') +
      '</section>' +
      '<section aria-labelledby="lb-players-h">' +
      '<h2 id="lb-players-h">Top Players</h2>' +
      seg +
      (players.length ? '<ol class="lb-list">' + playerRows + '</ol>'
        : '<p class="lb-empty">No players on the board yet.</p>') +
      '</section>';
  }

  // Renders into el, wires the Level / Points buttons, and keeps focus on the button pressed.
  function mount(el, data, opts) {
    opts = opts || {};
    var state = { sort: opts.sort === 'points' ? 'points' : 'level' };

    function draw(focusSort) {
      el.innerHTML = html(data, {
        meId: opts.meId,
        myTeamId: opts.myTeamId,
        sort: state.sort,
        updatedText: opts.updatedText,
        iconHtml: opts.iconHtml,
        valueLabel: opts.valueLabel
      });
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
    isHidden: isHidden,
    fmt: fmt
  };

  root.Leaderboard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
