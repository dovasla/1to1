/* Weekly rival: each week every player is paired with one rival of similar level, shown as a card on Home.
   Pure: no network, no storage. Browser: window.PlayerWeeklyRival. Node tests: tests/weekly-rival.test.js.

   Fair, symmetric matching (nobody picks):
     - Everyone on the board is sorted by level, then by season XP (the board's own XP, the one measure used).
     - The sorted list is cut into blocks of 4 neighbours, so a rival is always a close level.
       The cut moves each week, so people meet different rivals.
     - Inside a block the week decides who meets whom: one of three fixed pairings. A pair is always mutual:
       if A's rival is B, then B's rival is A.
     - An odd player out in a block gets a bye (no card that week). The bye moves each week.
   Win bonus (WIN_BONUS_XP) is only due when the rival is at most BONUS_LEVEL_GAP levels below you, so weak
   rivals do not pay. The server pays it once a week (player_claim_rival_bonus, see the draft in
   revamp/run-sql-drafts). Until the server confirms, the card says the bonus is pending.

   Data in: players = season board rows { id, name, level, points (XP), look, visible }.
   Weekly points come from the server (player_week_board, a draft in revamp/run-sql-drafts) as { public_id, pts }.
   Names and looks go through PlayerName (lib/player-name.js). Text is always escaped.
*/
(function (root) {
  'use strict';

  var BLOCK = 4;           // players per block of neighbours (pairings are made inside a block)
  var WIN_BONUS_XP = 10;   // bonus XP for winning the week's head to head
  var BONUS_LEVEL_GAP = 3; // rival may be at most this many levels below you for the bonus
  var MAX_PAIR_GAP = 6;    // never pair two players more than this many levels apart; both get no card instead

  function PN() {
    if (root.PlayerName) return root.PlayerName;
    return (typeof require === 'function') ? require('./player-name.js') : null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ISO week key for a date, e.g. "2026-W47" (weeks start on Monday).
  function weekKey(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    var week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + '-W' + (week < 10 ? '0' : '') + week;
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  // Only real, visible players with a name the board shows. Hidden rows come back as "Player".
  function usable(p) {
    return !!p && !!p.id && p.visible !== false && p.name !== 'Player';
  }

  // The three fixed pairings of four neighbours, as index pairs.
  var FOUR = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]]
  ];

  // Pairs one block in place. rivalOf maps id -> rival row, and is mutual by construction.
  function pairBlock(block, week, rivalOf) {
    var n = block.length;
    if (n < 2) return;                              // odd one out: bye
    var key = hash(String(week) + '|' + block.map(function (p) { return p.id; }).join(','));
    var pairs;
    if (n === 2) pairs = [[0, 1]];
    else if (n === 3) {
      var bye = key % 3;                            // the bye moves with the week
      pairs = bye === 0 ? [[1, 2]] : bye === 1 ? [[0, 2]] : [[0, 1]];
    } else pairs = FOUR[key % 3];
    pairs.forEach(function (pr) {
      var a = block[pr[0]], b = block[pr[1]];
      if (Math.abs((Number(a.level) || 0) - (Number(b.level) || 0)) > MAX_PAIR_GAP) return;   // too far apart: no card
      rivalOf[a.id] = b;
      rivalOf[b.id] = a;
    });
  }

  // Every player's rival for the week, as { id: rivalRow }. Players with a bye are not in the map.
  function pairRivals(players, week) {
    var pool = (players || []).filter(usable);
    var seen = {};
    pool = pool.filter(function (p) { if (seen[p.id]) return false; seen[p.id] = true; return true; });
    var wk = String(week);
    pool.sort(function (a, b) {
      var dl = (Number(b.level) || 0) - (Number(a.level) || 0);
      if (dl) return dl;
      var dx = (Number(b.points) || 0) - (Number(a.points) || 0);
      if (dx) return dx;
      var ha = hash(wk + '|' + a.id), hb = hash(wk + '|' + b.id);
      if (ha !== hb) return ha - hb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    var n = pool.length, rivalOf = {};
    if (!n) return rivalOf;
    // The cut moves each week: the first block is shorter by an offset of 0 to 3 players.
    var off = hash('cut|' + wk) % BLOCK;
    var start = 0;
    if (off > 0) { pairBlock(pool.slice(0, Math.min(off, n)), wk, rivalOf); start = Math.min(off, n); }
    for (; start < n; start += BLOCK) pairBlock(pool.slice(start, Math.min(start + BLOCK, n)), wk, rivalOf);
    return rivalOf;
  }

  // me = { id }. Returns the rival row (same shape as the board row) or null (bye, not on the board, or no one).
  function pickRival(me, players, week) {
    if (!me || !me.id) return null;
    var map = pairRivals(players, week);
    return Object.prototype.hasOwnProperty.call(map, me.id) ? map[me.id] : null;
  }

  // Head to head for the week. Points decide; a win earns the bonus only against a rival near your level.
  function duel(mine, theirs, myLevel, rivalLevel) {
    var a = Number(mine) || 0, b = Number(theirs) || 0;
    var result = a > b ? 'win' : a < b ? 'lose' : 'draw';
    var bonusXp = result === 'win' && (Number(rivalLevel) || 0) >= (Number(myLevel) || 0) - BONUS_LEVEL_GAP ? WIN_BONUS_XP : 0;
    return { mine: a, theirs: b, result: result, bonusXp: bonusXp, gap: Math.abs(a - b) };
  }

  // bonus: 'pending' (win, server not yet confirmed), 'added' (server paid it), or null (no bonus line).
  function noteText(d, bonus) {
    if (d.result === 'win') {
      if (!d.bonusXp) return 'You won by ' + d.gap + ' points. No bonus: this rival is well below your level.';
      var amount = '+' + d.bonusXp + ' bonus XP';
      if (bonus === 'added') return 'You won by ' + d.gap + ' points. ' + amount + ' added.';
      if (bonus === 'pending') return 'You won by ' + d.gap + ' points. ' + amount + ' is on its way.';
      return 'You won by ' + d.gap + ' points.';
    }
    if (d.result === 'lose') return 'Down by ' + d.gap + ' points. There is still time to catch up.';
    return 'Level this week. Keep playing to pull ahead.';
  }

  // view = { week, me: { name, level, look }, rival: { name, level, look }, duel: duel(...), bonus }
  // Returns markup, or '' when there is no rival or no numbers (the card then hides).
  function buildCard(view) {
    if (!view || !view.rival || !view.duel) return '';
    var p = PN();
    var nameOf = function (who) {
      var look = typeof who.look === 'string' ? who.look : '';
      return p ? p.name(who.name, look) : '<span class="pl-name">' + esc(who.name) + '</span>';
    };
    var d = view.duel;
    return '<section class="rival card" aria-labelledby="rivalH">' +
      '<h2 id="rivalH">Your rival this week</h2>' +
      '<div class="rival-row">' +
        '<div class="rival-side">' + nameOf(view.me) + '<span class="rival-lv">Lv ' + esc(view.me.level) + '</span></div>' +
        '<div class="rival-score" aria-label="' + esc(d.mine) + ' points to ' + esc(d.theirs) + '">' +
          '<b>' + esc(d.mine) + '</b><span aria-hidden="true"> : </span><b>' + esc(d.theirs) + '</b></div>' +
        '<div class="rival-side">' + nameOf(view.rival) + '<span class="rival-lv">Lv ' + esc(view.rival.level) + '</span></div>' +
      '</div>' +
      '<p class="rival-note">' + esc(noteText(d, view.bonus)) + '</p>' +
    '</section>';
  }

  var api = {
    BLOCK: BLOCK,
    MAX_PAIR_GAP: MAX_PAIR_GAP,
    WIN_BONUS_XP: WIN_BONUS_XP,
    BONUS_LEVEL_GAP: BONUS_LEVEL_GAP,
    weekKey: weekKey,
    pairRivals: pairRivals,
    pickRival: pickRival,
    duel: duel,
    noteText: noteText,
    buildCard: buildCard
  };

  root.PlayerWeeklyRival = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
