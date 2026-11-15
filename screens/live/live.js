/* Player app: Live tab. Owner: Live thread. Plain JS, no framework, no network, read-only.
   Usage:
     var lv = PlayerLive.mount(el, data, { onReveal: function () {} });
     lv.update(newData);   // call on every poll. Redraws only when something changed; the clock ticks on its own.
     lv.destroy();         // remove listeners and the clock timer
   data = {
     me:      { team: 'Blue' } or null,                  // your team name for tonight
     state:   'none' | 'idle' | 'between' | 'live' | 'paused' | 'full-time' | 'finished',
     now:     feed.now (see screens/live/live-feed.js) or null,
     recap:   { games, last, final, winner } or null,
     nextUp:  { team: 'Red', note: 'Winners stay on' } or null,
     lineup:  { game: 3, teamA: 'Blue', teamB: 'Red', players: { Blue: [ player, ... ], Red: [ player, ... ] } } or null,
     upcoming: [ { no: 3, time: '19:45', vs: 'Red', state: 'done'|'live'|'next'|'todo' } ],
     nextRun: 'Fri 20 Nov, 8:00pm' or null,
     updatedAt: '19:42' or null,
     offline: true when the last read failed (no signal)
   }
   player: { id, name, level, stars, banner, nameStyle, clanTag, callingCard, emblemSrc, captain }
   Names go through PlayerName (lib/player-name.js). Lineup order: highest XP level first, then name A to Z.
*/
(function (root) {
  'use strict';

  var PN = root.PlayerName || (typeof require === 'function' ? require('../../lib/player-name.js') : null);

  var STATE_LABEL = { done: 'Done', live: 'On court', next: 'Next', todo: 'To play' };
  var TICK_MS = 1000;

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
    var mode = now ? 'on' : (d.state === 'finished' ? 'over' : (d.recap && d.recap.last ? 'between' : (d.upcoming && d.upcoming.length ? 'between' : 'none')));
    return { mode: mode, yourTeamOnCourt: onCourt, yourTeam: me };
  }

  function upcomingRows(list) {
    return (list || []).map(function (g) {
      var st = STATE_LABEL[g.state] ? g.state : 'todo';
      return { no: g.no, time: g.time || '', vs: g.vs || '', state: st, label: STATE_LABEL[st] };
    });
  }

  // The clock block. data-ms and data-at let the timer count down without a redraw.
  function clockHtml(now) {
    if (now.state === 'full-time') return '<span class="lv-clock lv-clock-end">Full time</span>';
    var label = now.clockRunning ? '' : '<span class="lv-clock-state">Paused</span>';
    var ms = now.clockMs == null ? 0 : Math.round(now.clockMs);
    return '<span class="lv-clock' + (now.clockRunning ? ' is-running' : '') + '" data-clock data-ms="' + ms +
      '" data-run="' + (now.clockRunning ? '1' : '0') + '" data-at="' + Date.now() + '">' + esc(now.clockText || '') + '</span>' + label;
  }

  function nowHtml(now, me) {
    var mine = me && (now.teamA === me || now.teamB === me);
    var court = now.court ? '<span class="lv-cap">' + esc(now.court) + '</span>' : '';
    function side(team, score, fouls, isMine) {
      return '<div class="lv-side' + (isMine ? ' is-mine' : '') + '">' +
        '<span class="lv-team">' + esc(teamWord(team)) + (isMine ? ' <b class="lv-you">You</b>' : '') + '</span>' +
        '<span class="lv-score" aria-label="' + esc(team) + ' ' + esc(score) + '">' + esc(score) + '</span>' +
        '<span class="lv-fouls">Fouls ' + esc(fouls) + '</span>' +
      '</div>';
    }
    return '' +
      '<section class="lv-card lv-now' + (mine ? ' is-mine' : '') + '" aria-labelledby="lvNow">' +
        '<div class="lv-top"><span class="lv-pill"><i class="lv-dot" aria-hidden="true"></i>Live</span>' +
        '<span class="lv-cap">Game ' + esc(now.game) + '</span></div>' +
        '<h2 class="lv-h" id="lvNow">On court</h2>' +
        '<div class="lv-score-row">' + side(now.teamA, now.scoreA, now.foulsA, now.teamA === me) +
          '<span class="lv-vs" aria-hidden="true">–</span>' +
          side(now.teamB, now.scoreB, now.foulsB, now.teamB === me) + '</div>' +
        '<div class="lv-meta">' + clockHtml(now) + court + '</div>' +
      '</section>';
  }

  function recapLine(r) {
    if (!r) return '';
    return '<b>' + esc(teamWord(r.teamA)) + ' ' + esc(r.scoreA) + '</b> <span class="lv-vs">–</span> <b>' +
      esc(teamWord(r.teamB)) + ' ' + esc(r.scoreB) + '</b>';
  }

  // Between games: the last result. After wrap: the final game and the winner.
  function recapHtml(d) {
    var r = d.recap;
    if (!r || !r.last) return '';
    if (d.state === 'finished') {
      var f = r.final || r.last;
      var win = r.winner ? '<p class="lv-muted">' + esc(teamWord(r.winner)) + ' won the final.</p>' : '<p class="lv-muted">It was a tie.</p>';
      return '<section class="lv-card lv-recap" aria-labelledby="lvRecap">' +
        '<span class="lv-cap">Tonight is over</span>' +
        '<h2 class="lv-h" id="lvRecap">Final score</h2>' +
        '<p class="lv-final">' + recapLine(f) + '</p>' + win +
        '<p class="lv-muted">' + esc(r.games) + ' games played. Thanks for coming.</p>' +
      '</section>';
    }
    return '<section class="lv-card lv-recap" aria-labelledby="lvRecap">' +
      '<span class="lv-cap">Game ' + esc(r.last.no) + ' final</span>' +
      '<h2 class="lv-h" id="lvRecap">Last result</h2>' +
      '<p class="lv-final">' + recapLine(r.last) + '</p>' +
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

  // Tonight's games with their times, from the night's game list.
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

  // The run's next date and start, read-only. Shown only when the organiser has set a date.
  function scheduleHtml(nextRun) {
    if (!nextRun) return '';
    return '<section class="lv-card lv-sched" aria-labelledby="lvSched">' +
      '<span class="lv-cap">Next run</span>' +
      '<h2 class="lv-h" id="lvSched">' + esc(nextRun) + '</h2>' +
    '</section>';
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
      (d.updatedAt ? '<span class="lv-cap" role="status">Updated ' + esc(d.updatedAt) + '</span>' : '') + '</div>' +
      (d.offline ? '<p class="lv-offline" role="status">No signal. Showing the last update.</p>' : '');
    var body = '';
    if (s.mode === 'on') body += nowHtml(d.now, me);
    if (s.mode === 'over' || s.mode === 'between') body += recapHtml(d);
    body += nextUpHtml(d.nextUp);
    if (s.mode === 'none' && !d.lineup) body += emptyHtml();
    body += lineupHtml(d.lineup, me);
    body += upcomingHtml(d.upcoming);
    body += scheduleHtml(d.nextRun);
    return '<div class="lv">' + head + body + '</div>';
  }

  // What changes only with the clock. Everything else is compared to decide whether to redraw.
  function signature(d) {
    var copy = JSON.parse(JSON.stringify(d || {}));
    if (copy.now) { delete copy.now.clockMs; delete copy.now.clockText; }
    delete copy.updatedAt;
    return JSON.stringify(copy);
  }

  // Count the clock down in place (no redraw). Stops at zero.
  function tickClock(el) {
    var nodes = el.querySelectorAll('[data-clock]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.getAttribute('data-run') !== '1') continue;
      var left = Math.max(0, Number(n.getAttribute('data-ms')) - (Date.now() - Number(n.getAttribute('data-at'))));
      var s = Math.ceil(left / 1000), m = Math.floor(s / 60), r = s % 60;
      n.textContent = m + ':' + (r < 10 ? '0' + r : String(r));
    }
  }

  function mount(el, data, handlers) {
    var state = { data: data || {}, handlers: handlers || {}, sig: null };
    function render() { el.innerHTML = html(state.data); state.sig = signature(state.data); }
    function onClick(e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-action="reveal"]') : null;
      if (btn && state.handlers.onReveal) state.handlers.onReveal();
    }
    el.addEventListener('click', onClick);
    render();
    var timer = setInterval(function () { tickClock(el); }, TICK_MS);
    return {
      update: function (next) {
        state.data = next || {};
        if (signature(state.data) !== state.sig) { render(); return; }
        // Same content (only the clock moved): keep the DOM, restart the clock base and the Updated time.
        var box = document.createElement('div');
        box.innerHTML = html(state.data);
        var nc = box.querySelector('[data-clock]'), oc = el.querySelector('[data-clock]');
        if (nc && oc) {
          oc.setAttribute('data-ms', nc.getAttribute('data-ms'));
          oc.setAttribute('data-at', nc.getAttribute('data-at'));
          oc.setAttribute('data-run', nc.getAttribute('data-run'));
          tickClock(el);
        }
        var nh = box.querySelector('.lv-head'), oh = el.querySelector('.lv-head');
        if (nh && oh) oh.innerHTML = nh.innerHTML;
      },
      destroy: function () { clearInterval(timer); el.removeEventListener('click', onClick); el.innerHTML = ''; }
    };
  }

  var api = { mount: mount, html: html, summary: summary, orderLineup: orderLineup, upcomingRows: upcomingRows, signature: signature, STATE_LABEL: STATE_LABEL };
  root.PlayerLive = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
