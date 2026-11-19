/* Weekly rival: each week a player is paired with a rival of similar level, shown as a card on Home.
   Pure: no network, no storage. Browser: window.PlayerWeeklyRival. Node tests: tests/weekly-rival.test.js.

   Fair matching (the player never picks):
     - The rival is chosen from the 4 closest players by level, then by XP. Nobody is far above or below you
       unless nobody else is near.
     - The pick is a fixed function of the week and your id, so it rotates each week and cannot be re-rolled.
     - A win bonus (WIN_BONUS_XP) is only paid when the rival is at most 3 levels below you. This stops a
       player farming XP from weak rivals.

   Data in: players = season board rows { id, name, level, points (XP), look, visible }.
   Weekly points come from the server (player_week_board, a draft in revamp/run-sql-drafts) as { public_id, pts }.
   Names and looks go through PlayerName (lib/player-name.js). Text is always escaped.
*/
(function (root) {
  'use strict';

  var POOL = 4;            // nearest players to choose from
  var WIN_BONUS_XP = 10;   // bonus XP for winning the week's head to head
  var BONUS_LEVEL_GAP = 3; // rival may be at most this many levels below you for the bonus

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

  function usable(p, meId) {
    return !!p && !!p.id && p.id !== meId && p.visible !== false && p.name !== 'Player';
  }

  // me = { id, level, xp }. Returns the rival row (same shape as the board row) or null.
  function pickRival(me, players, week) {
    if (!me || !me.id) return null;
    var pool = (players || []).filter(function (p) { return usable(p, me.id); });
    if (!pool.length) return null;
    var lvl = Number(me.level) || 0, xp = Number(me.xp) || 0;
    pool.sort(function (a, b) {
      var dl = Math.abs((Number(a.level) || 0) - lvl) - Math.abs((Number(b.level) || 0) - lvl);
      if (dl) return dl;
      var dx = Math.abs((Number(a.points) || 0) - xp) - Math.abs((Number(b.points) || 0) - xp);
      if (dx) return dx;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    var close = pool.slice(0, POOL);
    return close[hash(String(week) + '|' + me.id) % close.length];
  }

  // Head to head for the week. Points decide; a win earns the bonus only against a rival near your level.
  function duel(mine, theirs, myLevel, rivalLevel) {
    var a = Number(mine) || 0, b = Number(theirs) || 0;
    var result = a > b ? 'win' : a < b ? 'lose' : 'draw';
    var bonusXp = result === 'win' && (Number(rivalLevel) || 0) >= (Number(myLevel) || 0) - BONUS_LEVEL_GAP ? WIN_BONUS_XP : 0;
    return { mine: a, theirs: b, result: result, bonusXp: bonusXp, gap: Math.abs(a - b) };
  }

  function noteText(d) {
    if (d.result === 'win') {
      return d.bonusXp ? 'You won by ' + d.gap + ' points. +' + d.bonusXp + ' bonus XP.'
        : 'You won by ' + d.gap + ' points. No bonus: this rival is well below your level.';
    }
    if (d.result === 'lose') return 'Down by ' + d.gap + ' points. There is still time to catch up.';
    return 'Level this week. Keep playing to pull ahead.';
  }

  // view = { week, me: { name, level, look }, rival: { name, level, look }, duel: duel(...) }
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
      '<p class="rival-note">' + esc(noteText(d)) + '</p>' +
    '</section>';
  }

  var api = {
    POOL: POOL,
    WIN_BONUS_XP: WIN_BONUS_XP,
    BONUS_LEVEL_GAP: BONUS_LEVEL_GAP,
    weekKey: weekKey,
    pickRival: pickRival,
    duel: duel,
    noteText: noteText,
    buildCard: buildCard
  };

  root.PlayerWeeklyRival = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
