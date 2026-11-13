/* Player app: Home lobby screen. Owner: Home thread. Plain JS, no framework, no network.
   Usage:
     var h = PlayerHome.mount(el, data, { onCard, onLineup, onLive, onNight, onShop });
     h.update(newData);   // re-render with fresh data
     h.destroy();         // stop the clock and remove listeners
   data = {
     player: { name, banner, nameStyle, clanTag, callingCard, emblemSrc, skill: 'Steady Starter', games, wins },
     run:    PlayerXp run object (xp, maxLevel, stars, ...),
     coins:  240,
     next:   { gameNo: 3, vs: 'Team Red', dayLabel: 'Thursday, 7:45', startsAt: ISO string } or null,
     nextRunLabel: 'Sunday 12:45',           // shown when next is null
     schedule: [{ no: 1, time: '19:00', vs: 'Team Blue', state: 'done'|'live'|'next'|'todo' }],
     lastNight: { xp: 143, games: 3, wins: 2 } or null,
     live: { game: 2, teamA: 'Red', scoreA: 14, teamB: 'Blue', scoreB: 12, clock: '4:10 left' } or null,
     updatedAt: '10:42' or null           // shows "Last updated" when set (offline)
   }
   Needs lib/xp.js (window.PlayerXp) and lib/player-name.js (window.PlayerName).
   Rules: revamp/build/player-app-plan/XP-SYSTEM.md. Skill (1 to 30) is shown as a name only, never mixed with XP level.
   Lineup button shows only in the last 60 seconds before tip-off. Nothing animates on open.
*/
(function (root) {
  'use strict';

  var PN = root.PlayerName;
  var XP = root.PlayerXp;
  var LINEUP_LEAD_MS = 60 * 1000;   // lineup reveal starts 1 minute before tip-off
  var ON_COURT_MS = 7 * 60 * 1000;  // a game is "on" for 7 minutes after tip-off

  var ICON = {
    coin: '<svg class="ph-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12.2" cy="11.8" r="8.2"/><path d="M9.6 9.4c.5-.8 1.4-1.2 2.5-1.2 1.6 0 2.6.8 2.6 2 0 2.5-5 1.8-5 4.2 0 1.2 1 2 2.6 2 1 0 1.9-.3 2.4-1.1"/></svg>',
    clock: '<svg class="ph-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12.1" cy="12.2" r="8.6"/><path d="M12 7.6V12.3l3.1 1.9"/></svg>'
  };

  function esc(s) { return PN.esc(s == null ? '' : String(s)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // 1h 12m above an hour, 12:40 under it. Never negative.
  function fmt(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? h + 'h ' + pad(m) + 'm' : pad(m) + ':' + pad(sec);
  }

  // Which tonight state we are in. Drives what the Tonight card shows.
  function tonightKind(next, now) {
    if (!next || !next.startsAt) return 'none';
    var t = Date.parse(next.startsAt);
    if (isNaN(t)) return 'none';
    if (now >= t) return now < t + ON_COURT_MS ? 'on' : 'wait';
    return (t - now) <= LINEUP_LEAD_MS ? 'lineup' : 'wait';
  }

  function heroHtml(d, prog) {
    var p = d.player || {};
    var chip = PN.html({
      name: p.name, level: prog.level, stars: prog.stars, banner: p.banner,
      nameStyle: p.nameStyle, clanTag: p.clanTag, callingCard: p.callingCard,
      emblemSrc: p.emblemSrc, size: 'full', noCall: true
    });
    return '' +
      '<a class="ph-hero" href="#card" data-go="card" aria-label="Open my player card">' +
        '<div class="ph-hero-top"><span class="ph-pill">1TO1</span><span class="ph-cap">Admit one</span></div>' +
        '<div class="ph-hero-name">' + chip + '</div>' +
        (p.skill ? '<div class="ph-skill">Skill <b>' + esc(p.skill) + '</b></div>' : '') +
        '<div class="ph-dash" aria-hidden="true"></div>' +
        '<div class="ph-stats">' +
          '<div><span class="ph-cap">XP level</span><b>' + prog.level + '</b></div>' +
          '<div><span class="ph-cap">Games</span><b>' + (p.games || 0) + '</b></div>' +
          '<div><span class="ph-cap">Wins</span><b>' + (p.wins || 0) + '</b></div>' +
        '</div>' +
      '</a>';
  }

  function xpHtml(prog) {
    var pct = prog.isMax ? 100 : (prog.xpForLevel ? Math.round(prog.xpInLevel / prog.xpForLevel * 100) : 0);
    var right = prog.isMax
      ? (prog.canPrestige ? 'Ready to prestige' : 'Max level')
      : esc(prog.xpToNext) + ' XP to Level ' + (prog.level + 1);
    return '' +
      '<section class="ph-xp" aria-label="Experience">' +
        '<div class="ph-xp-row"><b>Level ' + prog.level + '</b><span>' + right + '</span></div>' +
        '<div class="ph-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
          '<i style="width:' + pct + '%"></i></div>' +
      '</section>';
  }

  function tonightHtml(d, now) {
    var kind = tonightKind(d.next, now);
    if (kind === 'none') {
      return '' +
        '<div class="ph-card">' +
          '<span class="ph-cap">Tonight</span>' +
          '<h2>No run on</h2>' +
          '<p class="ph-muted">Next run: <b class="ph-ink">' + esc(d.nextRunLabel || 'soon') + '</b></p>' +
        '</div>';
    }
    var n = d.next;
    var t = Date.parse(n.startsAt);
    var head = '<span class="ph-cap">' + esc(n.dayLabel || 'Tonight') + '</span>' +
               '<h2>Game ' + esc(n.gameNo) + '</h2>' +
               '<p class="ph-vs">vs <b>' + esc(n.vs) + '</b></p>';
    var count;
    var action = '';
    if (kind === 'on') {
      count = '<span class="ph-count-label">Game on</span><b class="ph-count-num">Now</b>';
      action = '<a class="ph-btn ph-btn--ghost" href="#live" data-go="live">Watch live</a>';
    } else if (kind === 'lineup') {
      count = '<span class="ph-count-label">Tip-off in</span><b class="ph-count-num" data-count>' + fmt(t - now) + '</b>';
      action = '<a class="ph-btn" href="#lineup" data-go="lineup">See my lineup</a>';
    } else {
      count = '<span class="ph-count-label">Starts in</span><b class="ph-count-num" data-count>' + fmt(t - now) + '</b>';
      action = '<p class="ph-note">Lineup opens 1 minute before tip-off.</p>';
    }
    // Pay on Square opens the link only. "I've paid" needs the PIN, so it is tapped on the night page.
    var payUrl = String((window.PLAYER_APP_CONFIG || {}).squarePayLink || '').trim();
    if (/^https:\/\/\S+$/.test(payUrl)) {
      action += '<a class="ph-btn ph-btn--ghost" href="' + esc(payUrl) + '" target="_blank" rel="noopener">Pay on Square</a>';
    }
    return '<div class="ph-card ph-card--hero">' + head +
      '<div class="ph-count">' + count + '</div>' + action + '</div>';
  }

  function scheduleHtml(list) {
    if (!list || !list.length) return '';
    var chips = list.map(function (g) {
      var label = { done: 'Done', live: 'Live', next: 'Next', todo: '' }[g.state] || '';
      return '<a class="ph-chip ph-chip--' + esc(g.state) + '" href="#live" data-go="live">' +
        '<span class="ph-cap">G' + esc(g.no) + '</span><b>' + esc(g.time) + '</b>' +
        '<small>' + (label || '&nbsp;') + '</small></a>';
    }).join('');
    return '<section class="ph-block"><h2 class="ph-h2">Tonight</h2><div class="ph-strip">' + chips + '</div></section>';
  }

  function lastNightHtml(ln) {
    var body = ln
      ? '<b>+' + esc(ln.xp) + ' XP</b><span>' + esc(ln.games) + ' games · ' + esc(ln.wins) + ' wins</span>'
      : '<b>No run yet</b><span>Your last night shows here</span>';
    return '<a class="ph-row" href="#nights" data-go="night"><span class="ph-cap">Last night</span><div class="ph-row-body">' + body + '</div></a>';
  }

  function liveHtml(lv) {
    var body = lv
      ? '<b>Live · Game ' + esc(lv.game) + '</b><span>' + esc(lv.teamA) + ' ' + esc(lv.scoreA) + ' – ' + esc(lv.scoreB) + ' ' + esc(lv.teamB) + ' · ' + esc(lv.clock) + '</span>'
      : '<b>No live game</b><span>Live opens on run night</span>';
    return '<a class="ph-row" href="#live" data-go="live"><span class="ph-cap">Live</span><div class="ph-row-body">' + body + '</div></a>';
  }

  function page(d, now) {
    var run = d.run || XP.newRun();
    var prog = XP.progress(run);
    return '' +
      '<header class="ph-top">' +
        '<h1>Your Lobby</h1>' +
        '<a class="ph-coins" href="#shop" data-go="shop" aria-label="Coins, open shop">' + ICON.coin +
          '<b>' + esc(d.coins || 0) + '</b><span class="ph-cap">Coins</span></a>' +
      '</header>' +
      heroHtml(d, prog) +
      xpHtml(prog) +
      '<div data-slot="tonight">' + tonightHtml(d, now) + '</div>' +
      scheduleHtml(d.schedule) +
      '<section class="ph-block">' + lastNightHtml(d.lastNight) + liveHtml(d.live) + '</section>' +
      (d.updatedAt ? '<p class="ph-note ph-updated">' + ICON.clock + ' Last updated ' + esc(d.updatedAt) + '</p>' : '');
  }

  function mount(el, data, handlers) {
    handlers = handlers || {};
    var state = { data: data || {}, kind: null, timer: null };

    function render() {
      var now = Date.now();
      el.innerHTML = page(state.data, now);
      state.kind = tonightKind(state.data.next, now);
    }

    // One clock. Re-renders only when the tonight state changes, otherwise just the number.
    function tick() {
      var now = Date.now();
      var kind = tonightKind(state.data.next, now);
      if (kind !== state.kind) { render(); return; }
      var out = el.querySelector('[data-count]');
      if (out && state.data.next) out.textContent = fmt(Date.parse(state.data.next.startsAt) - now);
    }

    function onClick(e) {
      var a = e.target.closest ? e.target.closest('[data-go]') : null;
      if (!a || !el.contains(a)) return;
      var fn = handlers[a.getAttribute('data-go')];
      if (typeof fn === 'function') { e.preventDefault(); fn(a); }
    }

    el.classList.add('ph');
    el.addEventListener('click', onClick);
    render();
    state.timer = setInterval(tick, 1000);

    return {
      update: function (next) { state.data = next || {}; render(); },
      destroy: function () {
        clearInterval(state.timer);
        el.removeEventListener('click', onClick);
        el.innerHTML = '';
        el.classList.remove('ph');
      }
    };
  }

  root.PlayerHome = { mount: mount, tonightKind: tonightKind, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PlayerHome;
})(typeof window !== 'undefined' ? window : globalThis);
