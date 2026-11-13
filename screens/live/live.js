/* Player app: Live tab. Owner: Live thread. Plain JS, no framework, no network, read-only.
   Usage:
     var lv = PlayerLive.mount(el, data, { onReveal: function () {} });
     lv.update(newData);   // re-render with fresh data
     lv.destroy();         // remove listeners
   data = {
     me:      { team: 'Blue' } or null,                  // your team name for tonight
     now:     { game: 2, court: 'Court 1', teamA: 'Blue', scoreA: 14, teamB: 'Red', scoreB: 12, clock: '4:10 left' } or null,
     nextUp:  { team: 'Red', note: 'Winners stay on' } or null,
     lineup:  { game: 3, teamA: 'Blue', teamB: 'Red',
                players: { Blue: [ player, ... ], Red: [ player, ... ] } } or null,
     upcoming: [ { no: 3, time: '19:45', vs: 'Red', state: 'done'|'live'|'next'|'todo' } ],
     updatedAt: '19:42' or null
   }
   player: { id, name, level, stars, banner, nameStyle, clanTag, callingCard, emblemSrc, captain }
   Names go through PlayerName (lib/player-name.js), so level, stars and cosmetics show the same as everywhere else.
   Lineup order: highest XP level first (captain), then name A to Z. Rules: revamp/build/player-app-plan/DECISIONS-AND-BRAND.md section 3.
   The Live tab never changes data. Reveal opens via onReveal (the reveal/ screen).
*/
(function (root) {
  'use strict';

  var PN = root.PlayerName || (typeof require === 'function' ? require('../../lib/player-name.js') : null);

  var STATE_LABEL = { done: 'Done', live: 'On court', next: 'Next', todo: 'To play' };

  function esc(s) { return PN.esc(s == null ? '' : String(s)); }

  function teamWord(name) { return String(name == null ? '' : name).toUpperCase(); }

  // Highest XP level first (captain), then name A to Z. Never mutates the input.
  function orderLineup(players) {
    return (players || []).slice().sort(function (a, b) {
      var la = Number(a.level) || 0, lb = Number(b.level) || 0;
      if (la !== lb) return lb - la;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  // What the tab says at the top. Pure, so it can be tested.
  function summary(d) {
    d = d || {};
    var me = d.me && d.me.team ? String(d.me.team) : '';
    var now = d.now || null;
    var onCourt = !!(now && me && (now.teamA === me || now.teamB === me));
    var mode = now ? 'on' : (d.upcoming && d.upcoming.length ? 'between' : 'none');
    return { mode: mode, yourTeamOnCourt: onCourt, yourTeam: me };
  }

  function upcomingRows(list) {
    return (list || []).map(function (g) {
      var st = STATE_LABEL[g.state] ? g.state : 'todo';
      return { no: g.no, time: g.time || '', vs: g.vs || '', state: st, label: STATE_LABEL[st] };
    });
  }

  function nowHtml(now, me) {
    var mine = me && (now.teamA === me || now.teamB === me);
    var clock = now.clock ? '<span class="lv-clock">' + esc(now.clock) + '</span>' : '';
    var court = now.court ? '<span class="lv-cap">' + esc(now.court) + '</span>' : '';
    function side(team, score, isMine) {
      return '<div class="lv-side' + (isMine ? ' is-mine' : '') + '">' +
        '<span class="lv-team">' + esc(teamWord(team)) + (isMine ? ' <b class="lv-you">You</b>' : '') + '</span>' +
        '<span class="lv-score" aria-label="' + esc(team) + ' ' + esc(score) + '">' + esc(score) + '</span>' +
      '</div>';
    }
    return '' +
      '<section class="lv-card lv-now' + (mine ? ' is-mine' : '') + '" aria-labelledby="lvNow">' +
        '<div class="lv-top"><span class="lv-pill"><i class="lv-dot" aria-hidden="true"></i>Live</span>' +
        '<span class="lv-cap">Game ' + esc(now.game) + '</span></div>' +
        '<h2 class="lv-h" id="lvNow">On court</h2>' +
        '<div class="lv-score-row">' + side(now.teamA, now.scoreA, now.teamA === me) +
          '<span class="lv-vs" aria-hidden="true">–</span>' +
          side(now.teamB, now.scoreB, now.teamB === me) + '</div>' +
        '<div class="lv-meta">' + court + clock + '</div>' +
      '</section>';
  }

  function nextUpHtml(nextUp) {
    if (!nextUp || !nextUp.team) return '';
    return '<p class="lv-next"><span class="lv-cap">Next up</span> <b>' + esc(teamWord(nextUp.team)) + '</b>' +
      (nextUp.note ? ' <span class="lv-muted">' + esc(nextUp.note) + '</span>' : '') + '</p>';
  }

  function teamListHtml(team, players, isMine) {
    var list = orderLineup(players).map(function (p, i) {
      var chip = PN.html({ name: p.name, level: p.level, stars: p.stars, banner: p.banner,
        nameStyle: p.nameStyle, clanTag: p.clanTag, callingCard: p.callingCard, emblemSrc: p.emblemSrc, size: 'compact' });
      return '<li class="lv-player">' + (i === 0 ? '<span class="lv-cap lv-capt">Captain</span>' : '') + chip + '</li>';
    }).join('');
    return '<div class="lv-team-block' + (isMine ? ' is-mine' : '') + '">' +
      '<h3 class="lv-h3">' + esc(teamWord(team)) + (isMine ? ' <b class="lv-you">Your team</b>' : '') + '</h3>' +
      '<ul class="lv-plist">' + (list || '<li class="lv-muted">No players yet</li>') + '</ul>' +
    '</div>';
  }

  function lineupHtml(lineup, me) {
    if (!lineup) return '';
    var players = lineup.players || {};
    return '<section class="lv-card" aria-labelledby="lvLine">' +
      '<div class="lv-top"><span class="lv-cap">Game ' + esc(lineup.game) + ' lineup</span></div>' +
      '<h2 class="lv-h" id="lvLine">Who you play with</h2>' +
      '<div class="lv-teams">' +
        teamListHtml(lineup.teamA, players[lineup.teamA] || [], lineup.teamA === me) +
        teamListHtml(lineup.teamB, players[lineup.teamB] || [], lineup.teamB === me) +
      '</div>' +
      '<button class="lv-btn" type="button" data-action="reveal">See the reveal</button>' +
    '</section>';
  }

  function upcomingHtml(list) {
    var rows = upcomingRows(list);
    if (!rows.length) return '';
    return '<section aria-labelledby="lvUp">' +
      '<h2 class="lv-h" id="lvUp">Tonight</h2>' +
      '<ol class="lv-games">' + rows.map(function (r) {
        return '<li class="lv-game is-' + r.state + '">' +
          '<span class="lv-no">' + esc(r.no) + '</span>' +
          '<span class="lv-gbody"><b>' + esc(r.vs ? 'vs ' + teamWord(r.vs) : 'Game ' + r.no) + '</b>' +
          '<span class="lv-muted">' + esc(r.time) + '</span></span>' +
          '<span class="lv-state">' + esc(r.label) + '</span></li>';
      }).join('') + '</ol></section>';
  }

  function emptyHtml() {
    return '<section class="lv-card lv-empty"><h2 class="lv-h">No game on court</h2>' +
      '<p class="lv-muted">The organiser starts the first game. This page updates on its own.</p></section>';
  }

  function html(d) {
    d = d || {};
    var s = summary(d);
    var me = s.yourTeam;
    var head = '<div class="lv-head"><h1>Live</h1>' +
      (d.updatedAt ? '<span class="lv-cap" role="status">Updated ' + esc(d.updatedAt) + '</span>' : '') + '</div>';
    var body = '';
    if (s.mode === 'on') body += nowHtml(d.now, me);
    body += nextUpHtml(d.nextUp);
    if (s.mode === 'none' && !d.lineup) body += emptyHtml();
    body += lineupHtml(d.lineup, me);
    body += upcomingHtml(d.upcoming);
    return '<div class="lv">' + head + body + '</div>';
  }

  function mount(el, data, handlers) {
    var state = { data: data || {}, handlers: handlers || {} };
    function render() { el.innerHTML = html(state.data); }
    function onClick(e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-action="reveal"]') : null;
      if (btn && state.handlers.onReveal) state.handlers.onReveal();
    }
    el.addEventListener('click', onClick);
    render();
    return {
      update: function (next) { state.data = next || {}; render(); },
      destroy: function () { el.removeEventListener('click', onClick); el.innerHTML = ''; }
    };
  }

  var api = { mount: mount, html: html, summary: summary, orderLineup: orderLineup, upcomingRows: upcomingRows, STATE_LABEL: STATE_LABEL };
  root.PlayerLive = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
