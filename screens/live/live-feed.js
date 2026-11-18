/* Player app: reads the organiser's live row (table live_state, id 'tonight') and turns it into what the Live tab shows.
   Owner: Live thread. Plain JS, pure, no network. Node tests: tests/live-feed.test.js
   fromFeed(payload, nowMs) -> {
     state:     'none' | 'idle' | 'between' | 'live' | 'paused' | 'full-time' | 'finished'
     live:      true when a game is on court (live, paused or full-time)
     now:       { game, court, teamA, scoreA, teamB, scoreB, foulsA, foulsB, state, clockRunning, clockMs, clockText } or null
     recap:     { games, last, final, winner } or null     (between games and after wrap)
     updatedAt: 'HH:MM' or null                             (time of the organiser's last change)
     updatedMs: epoch ms of that change, or null
     nextRun:   'Fri 20 Nov, 8:00pm' or null
   }
   Clock: while running, the player counts down from clock.remainingMs at updatedAt, using its own clock (no server time needed).
   The payload holds team colours, scores, fouls, the clock, game numbers, court and the run's date and start. Nothing else.
   Version 1 rows (no state, no clock) still read: live true means 'live'.
*/
(function (root) {
  'use strict';

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var STATES = ['idle', 'started', 'between', 'live', 'paused', 'full-time', 'finished'];

  function text(v) { return v == null ? '' : String(v); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  // 'HH:MM' from an ISO time, in the phone's time zone (what the player sees).
  function hhmm(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // 'Fri 20 Nov, 8:00pm' from the run's date ('2026-11-20') and start ('20:00'). Date maths is done in UTC so no time zone can shift the day.
  function runWhen(date, start) {
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(date));
    var t = /^(\d{1,2}):(\d{2})$/.exec(text(start));
    if (!d) return null;
    var dt = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3]));
    var out = DAYS[dt.getUTCDay()] + ' ' + (+d[3]) + ' ' + MONTHS[+d[2] - 1];
    if (t) {
      var h = +t[1], m = t[2], ampm = h >= 12 ? 'pm' : 'am';
      var h12 = h % 12 === 0 ? 12 : h % 12;
      out += ', ' + h12 + ':' + m + ampm;
    }
    return out;
  }

  // Milliseconds left on the clock now. Running clocks count down from the moment the organiser published them.
  function clockMsNow(remainingMs, running, updatedMs, nowMs) {
    var rem = Math.max(0, num(remainingMs));
    if (!running || updatedMs == null || !isFinite(nowMs)) return rem;
    return Math.max(0, rem - Math.max(0, nowMs - updatedMs));
  }

  // 'm:ss' under an hour. Rounds up, so 0:01 shows until the buzzer.
  function clockText(ms) {
    var s = Math.ceil(Math.max(0, num(ms)) / 1000);
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' + r : String(r));
  }

  function side(v) { return { teamA: text(v.teamA), teamB: text(v.teamB) }; }

  function recapFrom(r) {
    if (!r || typeof r !== 'object') return null;
    function row(x) {
      if (!x || typeof x !== 'object') return null;
      return { no: num(x.no), teamA: text(x.teamA), teamB: text(x.teamB), scoreA: num(x.scoreA), scoreB: num(x.scoreB) };
    }
    var last = row(r.last), fin = row(r.final);
    if (!last && !fin) return null;
    return { games: num(r.games), last: last, final: fin, winner: r.winner ? text(r.winner) : null };
  }

  // Court players from the organiser row (players: { a: [...], b: [...] }): name, icon, hidden and points only. No ids reach the app.
  function courtPlayers(list) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object'; }).map(function (x) {
      var name = text(x.name);
      var out = { name: name || 'Player', icon: text(x.icon) || 'i01', hidden: x.hidden === true || !name };
      if (x.pts != null && isFinite(Number(x.pts))) out.pts = Number(x.pts);
      // Worn look and level from the organiser row (banner, name style, level). Only when sent.
      if (text(x.banner)) out.banner = text(x.banner);
      if (text(x.nameStyle)) out.nameStyle = text(x.nameStyle);
      if (x.level != null && isFinite(Number(x.level))) out.level = Number(x.level);
      return out;
    });
  }
  // Mini history from the organiser row: the last baskets, newest first. Public names only; a hidden scorer is "Player".
  function historyFrom(list, teamA, teamB) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object'; }).slice(0, 8).map(function (x) {
      var side = x.side === 'b' ? 'b' : 'a';
      var name = text(x.name);
      return {
        side: side,
        team: side === 'b' ? text(teamB) : text(teamA),
        pts: num(x.pts),
        name: x.hidden === true || !name ? 'Player' : name,
        icon: text(x.icon) || 'i01'
      };
    }).filter(function (x) { return x.pts > 0; });
  }
  function courtPlayersOf(players) {
    var pl = players && typeof players === 'object' ? players : {};
    return { a: courtPlayers(pl.a), b: courtPlayers(pl.b) };
  }

  // Heartbeat rule (Jord): no beat for 5 min -> 'reconnecting'; still none after 10 min -> 'over' ("Run's over").
  // A new beat brings it straight back to live. The beat is the organiser's updatedAt, or the server's stamp when newer.
  var STALE_MS = 5 * 60 * 1000;
  var OVER_MS = 10 * 60 * 1000;
  var OPEN_STATES = ['started', 'between', 'live', 'paused', 'full-time'];

  function fromFeed(payload, nowMs, serverUpdatedMs) {
    var p = payload && typeof payload === 'object' ? payload : {};
    var nowT = nowMs == null ? Date.now() : nowMs;
    var updatedMs = p.updatedAt ? Date.parse(p.updatedAt) : NaN;
    if (!isFinite(updatedMs)) updatedMs = null;
    var srvMs = serverUpdatedMs == null ? NaN : Number(serverUpdatedMs);
    // Only organisers that send updatedAt (v139+) have a heartbeat. Older rows (no field) never go stale.
    var beatMs = updatedMs == null ? null : (Math.max(updatedMs, isFinite(srvMs) ? srvMs : 0) || null);
    var hasState = STATES.indexOf(p.state) >= 0;
    var base = hasState ? p.state : (p.live === true ? 'live' : 'idle');
    var age = beatMs == null ? null : nowT - beatMs;
    var stale = (OPEN_STATES.indexOf(base) >= 0 && age != null && age >= STALE_MS) ? (age >= OVER_MS ? 'over' : 'reconnecting') : null;
    var state = stale || base;
    var onCourt = (base === 'live' || base === 'paused' || base === 'full-time') && p.teamA && p.teamB && stale !== 'over';
    var now = null;
    if (onCourt) {
      var c = p.clock && typeof p.clock === 'object' ? p.clock : null;
      var running = !!(c && c.running) && !stale;
      var ms = c ? clockMsNow(c.remainingMs, running, updatedMs, nowT) : null;
      var fouls = p.fouls && typeof p.fouls === 'object' ? p.fouls : {};
      now = {
        game: num(p.game) || 1, court: text(p.court), state: state,
        teamA: text(p.teamA), scoreA: num(p.scoreA), foulsA: num(fouls.a),
        teamB: text(p.teamB), scoreB: num(p.scoreB), foulsB: num(fouls.b),
        clockRunning: running, clockMs: ms, clockText: ms == null ? null : clockText(ms),
        players: courtPlayersOf(p.players),
        history: historyFrom(p.history, p.teamA, p.teamB)
      };
      if (state === 'full-time' || (ms != null && ms <= 0)) { now.state = 'full-time'; now.clockText = '0:00'; }
    }
    if (!stale && now && now.state === 'full-time') state = 'full-time';
    var sch = p.schedule && typeof p.schedule === 'object' ? p.schedule : {};
    return {
      state: state,
      live: !!now && !stale,
      connection: stale || 'ok',
      now: now,
      recap: recapFrom(p.recap),
      court: text(p.court),
      updatedAt: p.updatedAt ? hhmm(p.updatedAt) : null,
      updatedMs: updatedMs,
      nextRun: runWhen(sch.date, sch.start)
    };
  }

  // The run is over for this player: the organiser ended it ('finished'), or the heartbeat has been silent for 10 min ('over').
  function endedNow(f) { return !!(f && (f.state === 'finished' || f.connection === 'over')); }
  // One run = its date and start, so the closed pop-up shows once per run.
  function runKey(payload) {
    var s = payload && typeof payload.schedule === 'object' && payload.schedule ? payload.schedule : {};
    return text(s.date) + ' ' + text(s.start);
  }

  var api = { endedNow: endedNow, runKey: runKey, fromFeed: fromFeed, runWhen: runWhen, hhmm: hhmm, clockMsNow: clockMsNow, clockText: clockText, recapFrom: recapFrom };
  root.PlayerLiveFeed = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
