/* Player app: Live tab. Owner: patch C (Live). Plain JS, no framework, no network, read-only.
   Usage:
     var lv = PlayerLive.mount(el, data, { onReveal: function () {}, onSeePlayer: function (p) {} });
     lv.update(newData);   // re-render with fresh data
     lv.destroy();         // remove listeners and any open card or sheet
   data = {
     me:      { team: 'Blue' } or null,
     now:     { game: 2, court: 'Court 1', teamA: 'Blue', scoreA: 14, teamB: 'Red', scoreB: 12, clock: '4:10 left',
                players: { a: [ courtItem ], b: [ courtItem ] } } or null,
     nextUp:  { team: 'Red', note: 'Winner stays on' } or null,
     lineup:  { game: 3, teamA: 'Blue', teamB: 'Red', players: { Blue: [ player ], Red: [ player ] } } or null,
     upcoming: [ { no: 3, time: '19:45', vs: 'Red', state: 'done'|'live'|'next'|'todo' } ],
     results: [ { no: 1, teamA: 'Blue', teamB: 'Red', scoreA: 10, scoreB: 8, final: true } ] or null,
     updatedAt: '19:42' or null
   }
   courtItem: { name, icon, hidden, pts? }   (pts only when the organiser sends per-player points)
   player:    { id, name, level, stars, banner, nameStyle, clanTag, callingCard, emblemSrc, captain }
   Tap: a name in the lineup or on the court opens the small card (points this game, See player, Close).
   See player opens the sheet, or calls handlers.onSeePlayer(p) when the page passes one.
   Results: the list shows only when data.results has games. No results, no section.
   The Live tab never changes data. Reveal opens via onReveal (the reveal/ screen).
*/
(function (root) {
  'use strict';

  var PN = root.PlayerName || (typeof require === 'function' ? require('../../lib/player-name.js') : null);
  var CV = root.PlayerCourtView || (typeof require === 'function' ? require('../court-view/court-view.js') : null);
  // Lazy: the browser has these as globals (script tags); node tests use require.
  function SB() { return root.PlayerLiveScoreboard || (typeof require === 'function' ? require('./live-scoreboard.js') : null); }
  function LT() { return root.LoadTimeout || (typeof require === 'function' ? require('../../lib/load-timeout.js') : null); }

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
    var mode = d.runOver ? 'over' : (now ? 'on' : (d.upcoming && d.upcoming.length ? 'between' : 'none'));
    return { mode: mode, yourTeamOnCourt: onCourt, yourTeam: me };
  }

  function upcomingRows(list) {
    return (list || []).map(function (g) {
      var st = STATE_LABEL[g.state] ? g.state : 'todo';
      return { no: g.no, time: g.time || '', vs: g.vs || '', versus: g.versus || '', state: st, label: STATE_LABEL[st] };
    });
  }

  // Per-player game points for one finished game (optional: players: { a: [{ name, pts }], b: [...] }). Pure.
  function gamePtsOf(list) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object' && x.name != null; })
      .map(function (x) { return { name: String(x.name || '') || 'Player', pts: Number(x.pts) || 0 }; })
      .filter(function (x) { return x.pts > 0; })
      .sort(function (a, b) { return b.pts - a.pts; });
  }
  // Points line under a Results row. Empty when the feed sends no per-player points.
  function gamePtsHtml(r) {
    var a = gamePtsOf(r.players && r.players.a), b = gamePtsOf(r.players && r.players.b);
    function line(team, list) {
      if (!list.length) return '';
      return '<span class="lv-rpts"><b>' + esc(teamWord(team)) + '</b> ' +
        list.map(function (x) { return esc(x.name) + ' ' + esc(x.pts); }).join(' · ') + '</span>';
    }
    return line(r.teamA, a) + line(r.teamB, b);
  }

  // Finished games for the Results list: newest game first. Pure.
  function resultRows(list) {
    return (Array.isArray(list) ? list : []).filter(function (r) { return r && typeof r === 'object'; })
      .map(function (r) {
        return { no: Number(r.no) || 0, teamA: String(r.teamA || ''), teamB: String(r.teamB || ''),
          scoreA: Number(r.scoreA) || 0, scoreB: Number(r.scoreB) || 0, players: r.players || null };
      })
      .sort(function (a, b) { return b.no - a.no; });
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
        '<h2 class="lv-h" id="lvNow">The court</h2>' +
        '<div class="lv-score-row">' + side(now.teamA, now.scoreA, now.teamA === me) +
          '<span class="lv-vs" aria-hidden="true">–</span>' +
          side(now.teamB, now.scoreB, now.teamB === me) + '</div>' +
        '<div class="lv-meta">' + court + clock + '</div>' +
      '</section>';
  }

  function nextUpHtml(nextUp) {
    if (!nextUp || (!nextUp.team && !nextUp.versus)) return '';
    var what = nextUp.team ? 'vs ' + esc(String(nextUp.team)) : esc(String(nextUp.versus));
    return '<p class="lv-next"><span class="lv-cap">Next up:</span> <b>' + what + '</b>' +
      (nextUp.note ? ' <span class="lv-muted">' + esc(nextUp.note) + '</span>' : '') + '</p>';
  }

  // One lineup player, tappable: the card gets the name, team and level.
  function teamListHtml(team, players, isMine) {
    var list = orderLineup(players).map(function (p, i) {
      var chip = PN.html({ name: p.name, level: p.level, levelWord: 'Skill ', stars: p.stars, banner: p.banner,
        nameStyle: p.nameStyle, clanTag: (window.ShopTree && ShopTree.fromPublic(p).clanTag) || p.clanTag, callingCard: p.callingCard, emblemSrc: p.emblemSrc, size: 'compact' });
      var tap = '<button class="cv-tap cv-tap--chip" type="button" data-player' +
        ' data-name="' + esc(p.name) + '" data-team="' + esc(team) + '"' +
        (CV.count(p.level) != null ? ' data-level="' + esc(CV.count(p.level)) + '"' : '') + '>' + chip + '</button>';
      return '<li class="lv-player">' + (i === 0 ? '<span class="lv-cap lv-capt">Captain</span>' : '') + tap + '</li>';
    }).join('');
    return '<div class="lv-team-block' + (isMine ? ' is-mine' : '') + '">' +
      '<h3 class="lv-h3">' + esc(teamWord(team)) + (isMine ? ' <b class="lv-you">Your team</b>' : '') + '</h3>' +
      '<ul class="lv-plist">' + (list || '<li class="lv-muted">No players yet</li>') + '</ul>' +
    '</div>';
  }

  function lineupHtml(lineup, me) {
    if (!lineup) return '';
    var players = lineup.players || {};
    // r196h: a player in neither team sees "Who’s playing" and no reveal button.
    var left = !!lineup.left;
    return '<section class="lv-card" aria-labelledby="lvLine">' +
      '<div class="lv-top"><span class="lv-cap">Game ' + esc(lineup.game) + ' lineup</span></div>' +
      '<h2 class="lv-h" id="lvLine">' + (left ? 'Who\u2019s playing' : 'Who you play with') + '</h2>' +
      '<div class="lv-teams">' +
        teamListHtml(lineup.teamA, players[lineup.teamA] || [], lineup.teamA === me) +
        teamListHtml(lineup.teamB, players[lineup.teamB] || [], lineup.teamB === me) +
      '</div>' +
      (left ? '' : '<button class="lv-btn" type="button" data-action="reveal">See the reveal</button>') +
    '</section>';
  }

  function upcomingHtml(list) {
    var rows = upcomingRows(list);
    if (!rows.length) return '';
    return '<section aria-labelledby="lvUp">' +
      '<h2 class="lv-h" id="lvUp">Up next</h2>' +
      '<ol class="lv-games">' + rows.map(function (r) {
        return '<li class="lv-game is-' + r.state + '">' +
          '<span class="lv-no">' + esc(r.no) + '</span>' +
          // r8: one line per game, "Game 1 · time". The opponent is not repeated on every row (it shows once, in Next up).
          '<span class="lv-gbody"><b>' + esc('Game ' + r.no + (r.time ? ' · ' + r.time : '')) + '</b></span>' +
          '<span class="lv-state">' + esc(r.label) + '</span></li>';
      }).join('') + '</ol></section>';
  }

  // Results: finished games from the feed. Hidden when there are none.
  function resultsHtml(list) {
    var rows = resultRows(list);
    if (!rows.length) return '';
    return '<section class="lv-results" aria-labelledby="lvRes">' +
      '<h2 class="lv-h" id="lvRes">Results</h2>' +
      '<ol class="lv-games lv-res-list">' + rows.map(function (r) {
        return '<li class="lv-res">' +
          '<span class="lv-no">' + esc(r.no) + '</span>' +
          '<span class="lv-gbody"><span class="lv-rline"><b>' + esc(teamWord(r.teamA)) + '</b>' +
          '<span class="lv-rs">' + esc(r.scoreA) + ' – ' + esc(r.scoreB) + '</span>' +
          '<b>' + esc(teamWord(r.teamB)) + '</b></span>' +
          '<span class="lv-muted">Game ' + esc(r.no) + '</span>' + gamePtsHtml(r) + '</span></li>';
      }).join('') + '</ol></section>';
  }

  // R143 / the organiser: in or paid but not on a team yet. Personal page only: no names, no counts.
  function waitingHtml(d) {
    return '<section class="lv-card lv-empty lv-wait" aria-label="Your run"><h2 class="lv-h">You’re in. More to come.</h2>' +
      (d.paid ? '<p class="lv-muted">Paid for today.</p>' : '') +
      '<p class="lv-muted">Teams show here when the organiser sends them.</p></section>';
  }

  // P13: the live scoreboard. Error, timeout and Try again come from LoadTimeout; not live shows nothing extra.
  function boardHtml(board) {
    if (!board) return '';
    if (board.state === 'error' || board.state === 'timeout') {
      return '<section class="lv-card lv-empty" aria-label="Scoreboard">' + LT().stateHtml(board.state,
        { timeout: 'The scoreboard is taking too long. Check your signal.', error: 'Could not load the scoreboard.' }) + '</section>';
    }
    if (board.state === 'ok' && board.data) return SB().html(board.data);
    return '';
  }

  // P13: my spot could not be checked. Error and timeout only; Try again reloads it.
  function waitErrorHtml() {
    return '<section class="lv-card lv-empty" aria-label="Your run">' + LT().stateHtml('error',
      { error: 'Could not check your spot in the run. Check your signal.' }) + '</section>';
  }

  // Run over (72q): the organiser ended the run. Results (if any) still show below.
  function overHtml(word) {
    return '<section class="lv-card lv-empty" aria-label="Run over"><h2 class="lv-h">' + esc(word || 'Run is over') + '</h2><p class="lv-muted">Thanks for coming.</p></section>';
  }

  // Run started on the organiser, no game on court yet (the live row says 'started').
  function runOnHtml() {
    return '<section class="lv-card lv-empty" aria-label="Run on"><h2 class="lv-h">Run is on</h2>' +
      '<p class="lv-muted">Games show here when the first one starts. Teams show when the organiser sends them.</p></section>';
  }

  // Closed pop-up: shown once per run, only when the player was watching and the run ends. Returns the run key, or null.
  function closedPopupKey(prev, next, seen) {
    var key = next && next.runKey;
    if (!next || !next.runOver || !key) return null;
    if (prev && prev.runOver) return null;
    if (Array.isArray(seen) && seen.indexOf(key) >= 0) return null;
    return key;
  }
  var SEEN_KEY = 'oneto1.live.closedSeen';
  function seenKeys() {
    try { var v = JSON.parse(root.localStorage.getItem(SEEN_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function markSeen(key) {
    try {
      var list = seenKeys();
      if (list.indexOf(key) < 0) list.push(key);
      root.localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-20)));
    } catch (e) { /* private window or blocked storage: the pop-up may show again, nothing breaks */ }
  }
  function closedPopupHtml() {
    return '<section class="lv-card lv-closed" role="dialog" aria-modal="true" aria-labelledby="lvClosed">' +
      '<h2 class="lv-h" id="lvClosed">The run has been closed</h2>' +
      '<p class="lv-muted">Thanks for coming.</p>' +
      '<button class="lv-btn" type="button" data-cv="home">Go Home</button>' +
      '<button class="lv-btn" type="button" data-cv="close">Close</button></section>';
  }

  function emptyHtml() {
    return '<section class="lv-card lv-empty"><h2 class="lv-h">No game on court</h2>' +
      '<p class="lv-muted">Games show here when the run starts. This page updates on its own.</p></section>';
  }

  // Pictures: a and v ids are SVG files in icons/characters/set. i ids are drawn in code (icons/players).
  // A picture that is missing or fails to load shows the plain mark, never a blank.
  var iconModule = null;
  function loadIconModule() {
    if (!iconModule) iconModule = import('../../icons/players/player-icons.js');
    return iconModule;
  }

  function setPicture(slot, m, id, label) {
    slot.innerHTML = '';
    if (id.charAt(0) === 'i') { slot.innerHTML = m.playerIconSvg(id, { size: 64, label: label }); return; }
    var img = document.createElement('img');
    img.width = 64; img.height = 64; img.alt = label;
    img.onerror = function () { setPicture(slot, m, CV.PLAIN_ICON, label); };
    img.src = 'icons/characters/set/' + id + '.svg';
    slot.appendChild(img);
  }

  function fillPictures(host) {
    var slots = host.querySelectorAll('.lv-pic[data-icon]');
    if (!slots.length) return;
    loadIconModule().then(function (m) {
      Array.prototype.forEach.call(slots, function (slot) {
        setPicture(slot, m, slot.getAttribute('data-icon'), slot.getAttribute('data-label'));
      });
    }, function () { /* no icon module: tiles keep their name */ });
  }

  // D3: game-end banner. Built from the live state at full time (the row has no events).
  function endBannerHtml(now) {
    var DL = root.PlayerDelights;
    if (!DL || !now || now.state !== 'full-time') return '';
    var a = Number(now.scoreA) || 0, b = Number(now.scoreB) || 0;
    if (a === b) return '';
    var line = DL.gameEndBanner([{ type: 'game_end', winner: a > b ? 'A' : 'B', scoreA: a, scoreB: b }], { A: now.teamA, B: now.teamB });
    return line ? '<div class="lv-endbanner" role="status">' + esc(line.text) + '</div>' : '';
  }

  function html(d) {
    d = d || {};
    var s = summary(d);
    var me = s.yourTeam;
    var head = '<div class="lv-head"><h1>Live</h1>' +
      (d.updatedAt ? '<span class="lv-cap" role="status">Updated ' + esc(d.updatedAt) + '</span>' : '') + '</div>';
    var body = d.connection === 'reconnecting' ? '<p class="lv-cap" role="status">Reconnecting…</p>' : '';
    body += endBannerHtml(d.now);
    if (s.mode === 'on') body += nowHtml(d.now, me) + CV.courtHtml(d.now, me, d.lineup);
    body += nextUpHtml(d.nextUp);
    if (s.mode !== 'over') body += boardHtml(d.board);
    // Run closed: the Live tab goes back to its default "no game on court" view (no stale court, no board).
    if (s.mode === 'over') body += emptyHtml();
    else if (d.runStarting && !d.now && !d.lineup) body += runOnHtml();
    else if (s.mode !== 'on' && !d.lineup && d.waiting) body += waitingHtml(d);
    else if (s.mode !== 'on' && !d.lineup && d.waitError && !d.waiting) body += waitErrorHtml();
    else if (s.mode === 'none' && !d.lineup && d.runOn) body += runOnHtml();
    else if (s.mode === 'none' && !d.lineup) body += emptyHtml();
    body += lineupHtml(d.lineup, me);
    if (s.mode !== 'over') body += upcomingHtml(d.upcoming);
    body += resultsHtml(d.results);
    return '<div class="lv">' + head + body + '</div>';
  }

  function mount(el, data, handlers) {
    var state = { data: data || {}, handlers: handlers || {} };
    var doc = el.ownerDocument || document;
    var layer = null, keyFn = null, lastFocus = null, current = null;

    function close() {
      if (keyFn) doc.removeEventListener('keydown', keyFn);
      keyFn = null;
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
      layer = null;
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      lastFocus = null;
    }

    function show(markup) {
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
      keyFn && doc.removeEventListener('keydown', keyFn);
      layer = doc.createElement('div');
      layer.className = 'cv-layer';
      layer.innerHTML = markup;
      doc.body.appendChild(layer);
      layer.addEventListener('click', onLayerClick);
      keyFn = function (e) { if (e.key === 'Escape' || e.key === 'Esc') close(); };
      doc.addEventListener('keydown', keyFn);
      fillPictures(layer);
      var first = layer.querySelector('[data-cv="see"], [data-cv="close"]');
      if (first && typeof first.focus === 'function') first.focus();
    }

    function onLayerClick(e) {
      var t = e.target;
      if (t === layer) { close(); return; }                       // tap on the dark backdrop
      var b = t && t.closest ? t.closest('[data-cv]') : null;
      if (!b) return;
      var act = b.getAttribute('data-cv');
      if (act === 'close') { close(); return; }
      if (act === 'home') { close(); if (typeof state.handlers.onHome === 'function') state.handlers.onHome(); return; }
      if (act === 'see') {
        if (typeof state.handlers.onSeePlayer === 'function') { var p = current; close(); state.handlers.onSeePlayer(p); return; }
        show(CV.sheetHtml(current));
      }
    }

    function onClick(e) {
      if (pressFired) { pressFired = false; e.preventDefault(); return; }
      var rt = e.target && e.target.closest ? e.target.closest('[data-retry]') : null;
      if (rt) { if (state.handlers.onRetry) state.handlers.onRetry(); return; }
      var rv = e.target && e.target.closest ? e.target.closest('[data-action="reveal"]') : null;
      if (rv) { if (state.handlers.onReveal) state.handlers.onReveal(); return; }
      var pl = e.target && e.target.closest ? e.target.closest('[data-player]') : null;
      if (!pl) return;
      current = {
        name: pl.getAttribute('data-name') || 'Guest',
        icon: pl.getAttribute('data-icon') || CV.PLAIN_ICON,
        team: pl.getAttribute('data-team') || '',
        pts: CV.count(pl.getAttribute('data-pts')),
        level: CV.count(pl.getAttribute('data-level')),
        banner: pl.getAttribute('data-banner') || '',
        hk: pl.getAttribute('data-hk') || '',
        side: pl.getAttribute('data-side') || 'a',
        allTime: CV.count(pl.getAttribute('data-alltime'))
      };
      lastFocus = pl;
      show(CV.cardHtml(current));
    }

    function render() { el.innerHTML = html(state.data); fillPictures(el); }
    // Own score bump: one moment per screen (lib/moments.js). The visual is a CSS bump; motion-off is handled there.
    var moments = root.PlayerMoments && root.PlayerMoments.create ? root.PlayerMoments.create({
      vibrate: function (ms) { if (navigator.vibrate) navigator.vibrate(ms); }
    }) : null;
    function motionEnv() {
      var mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
      var fx = doc.documentElement && doc.documentElement.getAttribute('data-fx');
      return { reducedMotion: !!(mq && mq.matches), fxLow: fx === 'low', soundOn: false };
    }
    if (moments) moments.setEnv(motionEnv());
    function myScoreGain(prev, next) {
      var me = next && next.me && next.me.team;
      if (!me || !prev || !prev.now || !next || !next.now) return 0;
      var key = next.now.teamA === me ? 'scoreA' : (next.now.teamB === me ? 'scoreB' : null);
      if (!key || prev.now.game !== next.now.game) return 0;
      return (Number(next.now[key]) || 0) - (Number(prev.now[key]) || 0);
    }
    function bump() {
      var sc = el.querySelector('.lv-side.is-mine .lv-score');
      if (!sc) return;
      sc.classList.remove('lv-bump'); void sc.offsetWidth; sc.classList.add('lv-bump');
    }
    // D8: long-press a player (about 500 ms) opens the full sheet straight away. A short tap still opens the card.
    var pressTimer = null, pressFired = false;
    function playerFrom(pl) {
      return {
        name: pl.getAttribute('data-name') || 'Guest',
        icon: pl.getAttribute('data-icon') || CV.PLAIN_ICON,
        team: pl.getAttribute('data-team') || '',
        side: pl.getAttribute('data-side') || 'a',
        pts: CV.count(pl.getAttribute('data-pts')),
        level: CV.count(pl.getAttribute('data-level')),
        banner: pl.getAttribute('data-banner') || '',
        hk: pl.getAttribute('data-hk') || '',
        allTime: CV.count(pl.getAttribute('data-alltime'))
      };
    }
    function onDown(e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-player]') : null;
      if (!t) return;
      pressFired = false;
      pressTimer = setTimeout(function () {
        pressFired = true;
        current = playerFrom(t); lastFocus = t; show(CV.sheetHtml(current));
      }, 500);
    }
    function onUp() { clearTimeout(pressTimer); pressTimer = null; }
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onUp);
    el.addEventListener('click', onClick);
    render();
    return {
      update: function (next) {
        // Points that went up since the last read light the token up ("just scored"). Pure copy, the feed is not changed.
        var data = next || {};
        var prevNow = state.data && state.data.now;
        if (data.now && CV.markScored) data = Object.assign({}, data, { now: CV.markScored(data.now, prevNow) });
        var prev = state.data;
        state.data = data;
        render();
        var gain = myScoreGain(prev, data);
        if (gain > 0 && moments) moments.fire('live', { kind: 'bounce', haptic: true, visual: bump });
        else if (moments) moments.setEnv(motionEnv());
        // The pop-up only when the Live tab is on screen (a player who was watching when the run ended).
        var key = closedPopupKey(prev, data, seenKeys());
        if (key && el.getClientRects().length) { markSeen(key); show(closedPopupHtml()); }
      },
      destroy: function () { el.removeEventListener('click', onClick); close(); el.innerHTML = ''; }
    };
  }

  var api = {
    mount: mount, html: html, summary: summary, closedPopupKey: closedPopupKey, orderLineup: orderLineup, upcomingRows: upcomingRows,
    resultRows: resultRows, resultsHtml: resultsHtml, STATE_LABEL: STATE_LABEL,
    courtModel: function (now, me) { return CV.courtModel(now, me); },
    courtPlayer: function (p) { return CV.courtPlayer(p); }
  };
  root.PlayerLive = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
