/* Season leaderboards (player app, package N6). Browser: window.PlayerSeasons. Node tests: seasons.test.js.
   Pure: no network, no storage. The server (player_leaderboard, migration-15-seasons.sql) does the ranking.
   A season is a calendar quarter in London time. The screen only shows what the server returns.

   Boards: XP, wins, points, nights. Seasons: This season (current), Last season (last), All time (all).
   toolbarHtml(state)           season and board buttons (48px tall, yellow when on). state = { season, board }
   pinnedHtml(me, board, opts)  your own row, pinned under the list when you are off screen. opts.inView = true hides it.
   gapText(me, board)           plain words: "14 XP behind Leo H", "You are top of this board.", "Level with Leo H."
   normalise(season, board)     clean values for the URL, the RPC and the buttons. Unknown values fall back to safe defaults.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerSeasons = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var SEASONS = [
    { id: 'current', label: 'This season' },
    { id: 'last', label: 'Last season' },
    { id: 'all', label: 'All time' }
  ];
  // unit: singular and plural words, for the gap sentence.
  var BOARDS = [
    { id: 'xp', label: 'XP', one: 'XP', many: 'XP' },
    { id: 'wins', label: 'Wins', one: 'win', many: 'wins' },
    { id: 'points', label: 'Points', one: 'point', many: 'points' },
    { id: 'nights', label: 'Nights', one: 'night', many: 'nights' }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalise(season, board) {
    var s = SEASONS.some(function (x) { return x.id === season; }) ? season : 'current';
    var b = BOARDS.some(function (x) { return x.id === board; }) ? board : 'xp';
    return { season: s, board: b };
  }

  function boardOf(id) {
    for (var i = 0; i < BOARDS.length; i++) { if (BOARDS[i].id === id) return BOARDS[i]; }
    return BOARDS[0];
  }

  // Plain words for the gap to the player above. The server gives gap and aboveName.
  function gapText(me, board) {
    if (!me || me.rank == null) return '';
    if (me.rank === 1) return 'You are top of this board.';
    var gap = Math.max(0, Math.round(Number(me.gap) || 0));
    var above = me.aboveName ? esc(me.aboveName) : 'the player above';
    if (gap === 0) return 'Level with ' + above + '.';
    var b = boardOf(board);
    var unit = gap === 1 ? b.one : b.many;
    return gap + ' ' + unit + ' behind ' + above;
  }

  function toolbarHtml(state) {
    var st = normalise(state && state.season, state && state.board);
    var seasons = SEASONS.map(function (s) {
      var on = s.id === st.season;
      return '<button type="button" class="sl-chip' + (on ? ' sl-on' : '') + '" data-season="' + s.id +
        '" aria-pressed="' + on + '">' + esc(s.label) + '</button>';
    }).join('');
    var boards = BOARDS.map(function (b) {
      var on = b.id === st.board;
      return '<button type="button" class="sl-chip' + (on ? ' sl-on' : '') + '" data-board="' + b.id +
        '" aria-pressed="' + on + '">' + esc(b.label) + '</button>';
    }).join('');
    return '' +
      '<div class="sl-toolbar" role="group" aria-label="Season">' + seasons + '</div>' +
      '<div class="sl-toolbar" role="group" aria-label="Board">' + boards + '</div>';
  }

  function pinnedHtml(me, board, opts) {
    if (!me || me.rank == null) return '';
    if (opts && opts.inView) return '';
    var name = me.name ? esc(me.name) : 'You';
    var level = me.level != null ? ' <span class="sl-lvl">L' + esc(me.level) + '</span>' : '';
    return '' +
      '<div class="sl-pin" data-slot="me" aria-label="Your place">' +
        '<span class="sl-rank">' + esc(me.rank) + '</span>' +
        '<span class="sl-name">' + name + level + '</span>' +
        '<span class="sl-val">' + esc(me.value) + '</span>' +
        '<p class="sl-gap">' + gapText(me, board) + '</p>' +
      '</div>';
  }

  return {
    SEASONS: SEASONS,
    BOARDS: BOARDS,
    normalise: normalise,
    gapText: gapText,
    toolbarHtml: toolbarHtml,
    pinnedHtml: pinnedHtml
  };
});
