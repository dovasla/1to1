/* Player app: Home screen ("Today" panel, D3 I'm here). Plain JS, no framework, no network.
   Owner: Home thread (module home-redesign-r3). Shared hooks go through the integrator (N0), see HOOKS.md.

   Usage:
     var h = PlayerHome.mount(el, data, { imIn, pay, paid, checkIn, live, lineup, card, night, shop });
     h.update(newData);   // re-render with fresh data
     h.destroy();         // stop the clock and remove listeners

   Layout, top to bottom:
     1. Live score card, only while a game is on.
     2. Top bar: "Home" and coins.
     3. Next night card: day, time, court, countdown, the ONE yellow main button.
     4. Level strip: name, level and stars (shared PlayerName component) and a thin XP bar.
     5. Slots: cards registered with PlayerHome.register(id, order, renderFn, bindFn).

   Main button order (ruling R18): Watch live (game on) -> I'm in -> Pay £5 -> I'm here (code window,
   not yet checked in) -> See my lineup (published, and paid or pulled in) -> You're set.

   The door code never hides anything. It only means "I'm here".

   data = {
     player: { name, banner, nameStyle, clanTag, callingCard, emblemSrc },
     run:    PlayerXp run object (xp, maxLevel, stars, ...),
     coins:  240,
     court:  'Riverside Sports Hall' (optional),
     next:   { gameNo, vs, dayLabel, startsAt: ISO } or null,
     nextRunLabel: 'Sunday 12:45',           // shown when next is null
     tonight: {                              // optional. Filled by the N2, pay-first and D1 hooks.
       rsvp: 'none' | 'in',                  // "I'm in"
       count, needed, paidCount,             // "12 in, 7 paid" (N2). Shown only when count is a number.
       paid: false, claimed: false,          // pay state. claimed = "I've paid" sent to the organiser
       amount: '£5', payLink: 'https://...', // amount owed and the Square link
       error: false,                         // last "I've paid" send failed
       checkedIn: false,                     // "I'm here" done (D1 player_check_in)
       runClosed: false,                     // run is closed: no more codes
       lineupReady: false,                   // lineup published for this player (never by clock)
       pulledIn: false                       // organiser put this player on court by hand (Pass)
     },
     schedule: [{ no, time, vs, state }],    // game chips, slot 'games'
     lastNight: { xp, games, wins } or null, // slot 'last-night' (hidden when null)
     live: { game, teamA, scoreA, teamB, scoreB, clock } or null, // live card at the top
     updatedAt: '10:42' or null
   }

   handlers.checkIn(code) must return a Promise of { ok: true } or { ok: false, error }. The sheet calls it with the 4 digits.
   handlers.liveFeed() (optional) returns a Promise of { live } (same shape as data.live, or null). Home asks every 5 s while a game is on.
   d.night (optional, from the night-status module): { status, message, payloadCancelled, games: [{startsAt}], spots: {going, capacity} }.
   Empty states (no night yet, cancelled, full, night over) replace the Next night card and hide the main button where needed.
   handle.markHere() marks this phone as checked in (integrator calls it after a #in/1234 link check-in).
   The #in/1234 link, login and the player_check_in call itself belong to the integrator (app.js, backend.js).
   error is one of: 'wrong-code', 'too-early', 'run-closed', 'locked' (shown as "Wait 10 minutes").
   Needs lib/xp.js (window.PlayerXp) and lib/player-name.js (window.PlayerName).
   Nothing animates on open. The only motion is the XP fill, and it stops for reduced motion.
*/
(function (root) {
  'use strict';

  var PN = root.PlayerName;
  var XP = root.PlayerXp;
  var ON_COURT_MS = 7 * 60 * 1000;   // a game is "on" for 7 minutes after tip-off
  var LONDON = 'Europe/London';
  var CODE_ERR = {
    'wrong-code': 'Wrong code',
    'too-early': 'No session is open yet. Ask the organiser to start it.',
    'no-session': 'No session is open yet. Ask the organiser to start it.',
    'run-closed': 'Run closed',
    'locked': 'Wait 10 minutes'
  };
  var COACH_KEY = '1to1-home-coach-v1';
  var registry = [];                 // slots, sorted by order

  // Night status helper (night-status module). Read lazily so load order does not matter.
  function ns() { return root.PlayerNightStatus || null; }

  var ICON = {
    coin: '<svg class="ph-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12.2" cy="11.8" r="8.2"/><path d="M9.6 9.4c.5-.8 1.4-1.2 2.5-1.2 1.6 0 2.6.8 2.6 2 0 2.5-5 1.8-5 4.2 0 1.2 1 2 2.6 2 1 0 1.9-.3 2.4-1.1"/></svg>',
    clock: '<svg class="ph-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12.1" cy="12.2" r="8.6"/><path d="M12 7.6V12.3l3.1 1.9"/></svg>',
    tick: '<svg class="ph-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  function esc(s) { return PN.esc(s == null ? '' : String(s)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Under an hour: 12:40. Never negative.
  function fmt(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor((s % 3600) / 60), sec = s % 60;
    var h = Math.floor(s / 3600);
    return h > 0 ? h + 'h ' + pad(m) + 'm' : pad(m) + ':' + pad(sec);
  }

  // Days then hours (2d 5h), then hours and minutes (5h 12m), then mm:ss under an hour.
  function countdown(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + pad(m) + 'm';
    return fmt(ms);
  }

  // Which tonight state we are in: none, wait, on. ("lineup" is only the label window, 60 s before start.)
  function tonightKind(next, now) {
    if (!next) return 'none';
    var t = next.startsAt ? Date.parse(next.startsAt) : NaN;
    // next-23: the organiser's live games carry no start time. A published game still means tonight (Pay and check-in still work).
    if (isNaN(t)) return 'wait';
    if (now >= t) return now < t + ON_COURT_MS ? 'on' : 'wait';
    return 'wait';
  }

  // The door code works from 2 hours before start until the run is closed.
  function inCodeWindow(d, now) {
    var t = Date.parse(d.next && d.next.startsAt);
    if (isNaN(t)) return false;
    return !tonightOf(d).runClosed;
  }

  // Only Europe/London clock times are shown to players.
  function timeLabel(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LONDON }).format(new Date(t));
    } catch (e) { return ''; }
  }

  function safeUrl(u) { return /^https:\/\/\S+$/.test(String(u || '')) ? String(u) : ''; }

  function codeErrorText(err) { return CODE_ERR[err] || 'Check-in failed. Try again.'; }

  function tonightOf(d) {
    var t = d.tonight || {};
    return {
      lineupReady: !!t.lineupReady,
      pulledIn: !!t.pulledIn,
      checkedIn: !!t.checkedIn,
      ended: !!t.ended,
      runClosed: !!t.runClosed,
      rsvp: t.rsvp === 'in' ? 'in' : 'none',
      rsvpUnknown: !!t.rsvpUnknown,
      count: typeof t.count === 'number' ? t.count : null,
      paidCount: typeof t.paidCount === 'number' ? t.paidCount : null,
      paid: !!t.paid,
      claimed: !!t.claimed,
      amount: t.amount ? String(t.amount) : '',
      payLink: safeUrl(t.payLink),
      payMsg: t.payMsg ? String(t.payMsg) : '',
      error: !!t.error
    };
  }

  // What the night is, for the empty states and banners. Uses the night-status module when it is there.
  // Returns: none, normal, cancelled, full, finished, moved, spots, note.
  function nightKind(d, now) {
    if (tonightOf(d).ended) return 'finished';   // next-33 (R52): the run has ended on the server
    var n = d.night || null;
    var helper = ns();
    if (helper && n) {
      var s = helper.state({
        status: n.status, message: n.message, live: !!d.live,
        games: n.games || [], spots: n.spots || null, payloadCancelled: !!n.payloadCancelled
      }, now);
      if (s !== 'none' && s !== 'live') return s;
    }
    return d.next ? 'normal' : 'none';
  }

  // Plain message from the organiser (escaped by the helper, 120 characters at most).
  function nightMessage(d) {
    var helper = ns();
    return helper && d.night ? helper.clean(d.night.message) : '';
  }

  // Spots left, or null. Only from the night's spots (N2 count).
  function spotsLeft(d) {
    var sp = d.night && d.night.spots;
    if (!sp || !Number.isInteger(sp.capacity) || !Number.isInteger(sp.going)) return null;
    return sp.capacity - sp.going;
  }

  // The one yellow main button. Returns null when there is no night to act on.
  // Order: live now, "I'm in", "Pay £5", "I'm here" (code window), "See my lineup", "You're set".
  // The lineup is never timed: it shows only when it is published for this player.
  // next-31 (R37): a Pay button shows only when it can lead somewhere: a Square link is set, or auto pay is on.
  // With no link and auto pay off, the line reads "Pay at the door" and there is no button.
  function payButtonOk(t) {
    var cfg = window.PLAYER_APP_CONFIG || {};
    return !!t.payLink || cfg.payAuto === true;
  }
  function payDue(t) {
    // R43: Pay is never reachable before the code is accepted (checked in), unless pulled in.
    return !t.paid && !t.runClosed && !!t.amount && payButtonOk(t) && (t.checkedIn || t.pulledIn);
  }

  // next-31 (R42): a paid (or pulled-in) player does not check in with a code: no code box, no "I'm here".
  // An unpaid player still sees "I'm here" in the code window (a cash payer says they have arrived that way).
  // R43: "Join a session" is the one big button from the moment a night is published, not only in the window.
  // Before the window the server answers "Too early", so the player sees why.
  function needsCode(t, d, now) {
    return !t.checkedIn && !t.paid && !t.pulledIn && !t.runClosed;
  }

  function mainAction(d, now) {
    var nk = nightKind(d, now);
    if (nk === 'cancelled' || nk === 'finished') return null;
    var kind = tonightKind(d.next, now);
    if (kind === 'none') return null;
    if (kind === 'on') return { kind: 'live', label: 'Watch live', go: 'live' };
    var t = tonightOf(d);
    if (nk === 'full' && t.rsvp !== 'in') return null;
    // next-22: when the RSVP read failed, skip the I'm in step so Pay still shows.
    // next-23: without "I'm in", the main button shows Pay while a payment is due (so Pay never waits on RSVP),
    // then "I'm here" in the code window, and only then "I'm in".
    if (t.rsvp !== 'in' && !t.rsvpUnknown) {
      if (payDue(t)) return { kind: 'pay', label: 'Pay ' + t.amount + ' by card', go: 'pay', href: t.payLink };
      if (needsCode(t, d, now)) return { kind: 'here', label: 'Join a run', go: 'here' };
      return { kind: 'in', label: 'I’m in', go: 'imIn' };
    }
    if (payDue(t)) return { kind: 'pay', label: 'Pay ' + t.amount + ' by card', go: 'pay', href: t.payLink };
    if (needsCode(t, d, now)) return { kind: 'here', label: 'Join a run', go: 'here' };
    if (t.lineupReady && (t.paid || t.pulledIn)) return { kind: 'lineup', label: 'See my lineup', go: 'lineup' };
    return { kind: 'set', label: t.paid ? 'Paid. You’re in.' : (t.pulledIn ? 'You’re in tonight' : 'You’re set'), go: 'live' };
  }

  // Key that decides when the page must be redrawn (not every second).
  function stateKey(d, now) {
    var a = mainAction(d, now);
    var t = tonightOf(d);
    return nightKind(d, now) + '|' + tonightKind(d.next, now) + '|' + (a ? a.kind : '-') + '|' + (t.claimed ? 'c' : '') +
      (t.checkedIn ? 'k' : '') + (inCodeWindow(d, now) ? 'w' : '');
  }

  function mainButtonHtml(a) {
    if (!a) return '';
    if (a.href) {
      return '<a class="ph-btn" href="' + esc(a.href) + '" target="_blank" rel="noopener" data-go="' + esc(a.go) + '">' + esc(a.label) + '</a>';
    }
    return '<button class="ph-btn" type="button" data-go="' + esc(a.go) + '">' + esc(a.label) + '</button>';
  }

  // Small lines under the main button: the pay side action, the "You're here" tick, and errors.
  function sideHtml(d, a, now, flash) {
    var t = tonightOf(d);
    var out = '';
    // One Pay path (R43): with card pay on, Pay is the only pay action (no separate "I've paid" claim).
    if (a && a.kind === 'pay') {
      out += t.claimed
          ? '<p class="ph-note">Sent. The organiser will check Square.</p>'
          : '<button class="ph-btn ph-btn--ghost" type="button" data-go="paid">Pay at the desk</button>';
      if (t.error) out += '<p class="ph-note" role="alert">Could not send. Try again.</p>';
      if (t.payMsg) out += '<p class="ph-note" role="alert">' + esc(t.payMsg) + '</p>';
      if (t.checkedIn && !t.paid) out += '<p class="ph-note">You’re here. Pay ' + esc(String(t.amount)) + ' to play tonight.</p>';
    }
    // next-31: "I'm here" shows in the code window whenever the player is not checked in, beside any other main
    // button (Pay first, then here). Before the window it is hidden.
    if (a && a.kind !== 'here' && needsCode(t, d, now)) {
      out += '<button class="ph-btn ph-btn--ghost" type="button" data-go="here">Join a run</button>';
    }
    if (a && !t.paid && !t.pulledIn && !!t.amount && !payButtonOk(t)) {
      out += '<p class="ph-note">Pay at the desk</p>';
    }
    // next-30: in the code window "I'm here" is the main button; "I'm in" still shows beside it.
    // next-31 (R39): pay is never a block, so "I'm in" also shows beside a Pay button.
    if (flash) out += '<p class="ph-note" role="alert">' + esc(flash) + '</p>';
    return out;
  }

  function countLineHtml(t) {
    if (t.count == null) return '';
    var txt = t.count + ' in';
    if (t.paidCount != null) txt += ' · ' + t.paidCount + ' paid';
    return '<p class="ph-muted ph-count-line">' + esc(txt) + '</p>';
  }

  // Calm empty card for: no night yet, cancelled, full, night over. Plain words, one next step.
  function emptyCardHtml(k, d, now) {
    var msg = nightMessage(d);
    var E = {
      none: { cap: 'Next night', title: 'No night yet', body: '' },
      cancelled: { cap: 'Tonight', title: 'Cancelled', body: msg || 'Not on tonight.' },
      full: { cap: 'Tonight', title: 'Night full', body: 'No spots left.' },
      finished: { cap: 'Tonight', title: 'This session has ended.', body: 'Thanks for playing.' }
    }[k];
    var when = d.next && k !== 'none' ? '<p class="ph-muted">' + esc(d.next.dayLabel || timeLabel(d.next.startsAt)) + '</p>' : '';
    var body = E.body ? '<p class="ph-muted">' + esc(E.body) + '</p>' : '';
    var nextRun = '<p class="ph-muted">Next run: <b class="ph-ink">' + esc(d.nextRunLabel || 'soon') + '</b></p>';
    var action = tonightOf(d).ended
      ? '<button class="ph-btn" type="button" data-go="here">Join a run</button>'
      : d.lastNight
      ? '<button class="ph-btn ph-btn--ghost" type="button" data-go="night">See last night</button>'
      : '<button class="ph-btn ph-btn--ghost" type="button" data-go="card">Open my profile</button>';
    return '<section class="ph-next ph-next--empty" role="status" aria-label="' + esc(E.cap + ' ' + E.title) + '">' +
      '<span class="ph-cap">' + esc(E.cap) + '</span>' +
      '<h2>' + esc(E.title) + '</h2>' + when + body + nextRun + action +
    '</section>';
  }

  // Spots line (only when 2 or fewer are left) and the organiser's message (moved or note).
  function spotsHtml(d) {
    var left = spotsLeft(d);
    if (left === null || left < 1 || left > 2) return '';
    return '<p class="ph-muted">' + (left === 1 ? '1 spot left' : left + ' spots left') + '</p>';
  }

  function noteHtml(d, nk) {
    var msg = nightMessage(d);
    if (nk === 'moved') return '<p class="ph-note" role="status">Moved. ' + esc(msg || 'Ask the organiser for the new time.') + '</p>';
    if (nk === 'note' && msg) return '<p class="ph-note">' + esc(msg) + '</p>';
    return '';
  }

  // The Next night card. This is the "Today" panel.
  function nextCardHtml(d, now, flash) {
    var nk = nightKind(d, now);
    var inNow = !!(d.tonight && d.tonight.rsvp === 'in');
    if (!d.next) return emptyCardHtml(nk === 'cancelled' ? 'cancelled' : 'none', d, now);
    if (nk === 'cancelled' || nk === 'finished' || (nk === 'full' && !inNow)) return emptyCardHtml(nk, d, now);
    var n = d.next;
    var t = Date.parse(n.startsAt);
    var kind = tonightKind(n, now);
    var a = mainAction(d, now);
    var tn = tonightOf(d);
    var when = n.dayLabel || timeLabel(n.startsAt) || 'Tonight';
    var court = d.court ? '<p class="ph-muted">' + esc(d.court) + '</p>' : '';
    var noTime = isNaN(t);
    var label = kind === 'on' ? 'Game on' : (noTime ? 'Tonight' : 'Starts in');
    var num = kind === 'on'
      ? '<b class="ph-count-num">Now</b>'
      : (noTime ? '<b class="ph-count-num">Soon</b>'
        : '<b class="ph-count-num" data-count>' + esc(countdown(t - now)) + '</b>');
    return '<section class="ph-next" aria-label="Next night">' +
      '<span class="ph-cap">Next night</span>' +
      '<h2>' + esc(when) + '</h2>' +
      court +
      '<div class="ph-count"><span class="ph-count-label">' + label + '</span>' + num + '</div>' +
      countLineHtml(tn) +
      spotsHtml(d) +
      noteHtml(d, nk) +
      mainButtonHtml(a) +
      sideHtml(d, a, now, flash) +
    '</section>';
  }

  // Time left in the game, as text. If the feed gives clockSecs and running, the phone counts it down itself.
  function liveClock(lv, now) {
    if (typeof lv.clockSecs !== 'number') return lv.clock || '';
    var elapsed = lv.running && lv.clockAt ? (now - lv.clockAt) / 1000 : 0;
    return fmt(Math.max(0, lv.clockSecs - elapsed) * 1000) + ' left';
  }

  // Live score card. Sits at the top only while a game is on. The score is also read out in words.
  function liveCardHtml(lv, now) {
    var words = lv.teamA + ' ' + lv.scoreA + ', ' + lv.teamB + ' ' + lv.scoreB;
    return '<a class="ph-live-card" href="#live" data-go="live">' +
      '<span class="ph-cap">Live · Game ' + esc(lv.game) + '</span>' +
      '<span class="ph-sr">' + esc(words) + '.</span>' +
      '<div class="ph-live-score" aria-hidden="true">' +
        '<span class="ph-live-team">' + esc(lv.teamA) + '</span>' +
        '<b>' + esc(lv.scoreA) + '</b><i>–</i><b>' + esc(lv.scoreB) + '</b>' +
        '<span class="ph-live-team">' + esc(lv.teamB) + '</span>' +
      '</div>' +
      '<span class="ph-muted" data-live-clock>' + esc(liveClock(lv, now)) + '</span>' +
    '</a>';
  }

  // Thin level strip. Not a card. Name, level and stars come from the shared PlayerName component.
  // Skill and clan tag are not shown on Home (Profile only): yellow stays for the one action.
  function youHtml(d) {
    var p = d.player || {};
    var run = d.run || XP.newRun();
    var prog = XP.progress(run);
    var pct = prog.isMax ? 100 : (prog.xpForLevel ? Math.round(prog.xpInLevel / prog.xpForLevel * 100) : 0);
    var right = prog.isMax ? 'Max level' : esc(prog.xpToNext) + ' to Level ' + (prog.level + 1);
    var chip = PN.html({
      name: p.name, level: prog.level, stars: prog.stars || run.stars || 0, banner: p.banner,
      nameStyle: p.nameStyle, clanTag: '', callingCard: p.callingCard,
      emblemSrc: p.emblemSrc, size: 'full', noCall: true
    });
    return '<section class="ph-you" aria-label="Your level">' +
      '<a class="ph-you-top" href="#profile" data-go="card" aria-label="' + esc('My player card: ' + (p.name || 'Player') + ', Level ' + prog.level + ', ' + (prog.stars || run.stars || 0) + ' stars') + '">' + chip + '</a>' +
      '<div class="ph-you-row"><b>Level ' + prog.level + '</b><span>' + right + '</span></div>' +
      '<div class="ph-bar" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-valuetext="' + pct + ' percent, ' + esc(right) + '">' +
        '<i style="width:' + pct + '%"></i></div>' +
    '</section>';
  }

  function scheduleHtml(list) {
    if (!list || !list.length) return '';
    var chips = list.map(function (g) {
      var label = { done: 'Done', live: 'Live', next: 'Next', todo: '' }[g.state] || '';
      return '<a class="ph-chip ph-chip--' + esc(g.state) + '" href="#live" data-go="live">' +
        '<span class="ph-cap">G' + esc(g.no) + '</span><b>' + esc(g.time) + '</b>' +
        '<small>' + (label || '&nbsp;') + '</small></a>';
    }).join('');
    return '<h2 class="ph-h2">Tonight’s games</h2><div class="ph-strip">' + chips + '</div>';
  }

  function lastNightHtml(ln) {
    return '<a class="ph-row" href="#nights" data-go="night"><span class="ph-cap">Last night</span><div class="ph-row-body">' +
      '<b>+' + esc(ln.xp) + ' points</b><span>' + esc(ln.games) + ' games · ' + esc(ln.wins) + ' wins</span></div></a>';
  }

  // Built-in slots. A slot returns '' when it has nothing to say, and then leaves no gap.
  // The live score is not a slot: it sits at the top of the page.
  // First-visit tip. Shows once per phone. If storage is blocked it never shows (no nagging).
  function coachShown() {
    try { return !!root.localStorage && root.localStorage.getItem(COACH_KEY) !== '1'; } catch (e) { return false; }
  }
  function coachDone() {
    try { if (root.localStorage) root.localStorage.setItem(COACH_KEY, '1'); } catch (e) { /* nothing to do */ }
  }
  function coachHtml(d, now) {
    var a = mainAction(d, now);
    var line = a
      ? 'Your next step: “' + a.label + '”, on the yellow button.'
      : 'The yellow button shows your next step once a night is on.';
    return '<section class="ph-coach" aria-label="Tip">' +
      '<span class="ph-cap">Your next step</span>' +
      '<p>' + esc(line) + '</p>' +
      '<button class="ph-btn ph-btn--ghost" type="button" data-go="coach-dismiss">Got it</button>' +
    '</section>';
  }

  function registerBuiltIns() {
    // R27 (Fable 15 Nov): Home keeps at most six cards. Coach tip, tonight's games and last night are removed from Home.
    // Their helper functions stay in the file, unused.
  }

  // register(id, order, renderFn, bindFn). renderFn(data, ctx) returns HTML or ''. bindFn(sectionEl) is optional.
  // Same id replaces the old entry, so a module can be swapped without a second card.
  function register(id, order, renderFn, bindFn) {
    if (!id || typeof renderFn !== 'function') return;
    registry = registry.filter(function (s) { return s.id !== id; });
    registry.push({ id: String(id), order: Number(order) || 0, render: renderFn, bind: typeof bindFn === 'function' ? bindFn : null });
    registry.sort(function (a, b) { return a.order - b.order; });
  }

  function slotsHtml(d, now) {
    return registry.map(function (s) {
      var html = '';
      try { html = s.render(d, { now: now }) || ''; } catch (e) { html = ''; if (root.console) root.console.error('Home slot ' + s.id + ' failed', e); }
      return html ? '<section class="ph-slot" data-slot="' + esc(s.id) + '">' + html + '</section>' : '';
    }).join('');
  }

  function page(d, now, flash) {
    var coins = '<a class="ph-coins" href="#shop" data-go="shop" aria-label="Coins, open shop">' + ICON.coin +
      '<b>' + esc(d.coins || 0) + '</b><span class="ph-cap">Coins</span></a>';
    var top = d.live ? liveCardHtml(d.live, now) : '';
    return '' +
      top +
      '<header class="ph-top"><h1>Home</h1>' + coins + '</header>' +
      nextCardHtml(d, now, flash) +
      youHtml(d) +
      '<div class="ph-slots">' + slotsHtml(d, now) + '</div>' +
      ''; // next-27: no "Last updated" line on Home
  }

  function bindSlots(el) {
    registry.forEach(function (s) {
      if (!s.bind) return;
      var node = el.querySelector('[data-slot="' + s.id + '"]');
      if (node) s.bind(node);
    });
  }

  // ---------- Door code sheet (I'm here) ----------
  // The sheet lives on document.body so a redraw of Home never closes it mid-entry.
  function buildSheet() {
    var wrap = document.createElement('div');
    wrap.className = 'ph-sheet-wrap';
    wrap.innerHTML =
      '<div class="ph-sheet-back" data-sheet-close></div>' +
      '<div class="ph-sheet" role="dialog" aria-modal="true" aria-labelledby="phSheetH" tabindex="-1">' +
        '<h2 id="phSheetH">Enter the 4-digit code</h2>' +
        '<p class="ph-muted">It’s on the organiser’s screen.</p>' +
        '<div class="ph-digits" data-digits role="group" aria-label="Door code, 0 of 4 digits entered">' +
          '<span class="ph-box" data-box>&nbsp;</span><span class="ph-box" data-box>&nbsp;</span>' +
          '<span class="ph-box" data-box>&nbsp;</span><span class="ph-box" data-box>&nbsp;</span>' +
        '</div>' +
        '<p class="ph-note ph-sheet-msg" data-msg role="alert"></p>' +
        '<div class="ph-pad">' +
          [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button class="ph-key" type="button" data-key="' + n + '">' + n + '</button>'; }).join('') +
          '<button class="ph-key ph-key--alt" type="button" data-key="del" aria-label="Delete last digit">Del</button>' +
          '<button class="ph-key" type="button" data-key="0">0</button>' +
          '<button class="ph-key ph-key--alt" type="button" data-key="clear" aria-label="Clear all digits">Clear</button>' +
        '</div>' +
        '<button class="ph-btn ph-btn--ghost" type="button" data-sheet-close>Close</button>' +
      '</div>';
    return wrap;
  }

  function mount(el, data, handlers) {
    handlers = handlers || {};
    var state = { data: data || {}, key: null, timer: null, liveTimer: null, local: {}, liveSet: false, liveValue: null, flash: '', sheet: null, sheetDigits: '', busy: false, inerted: [] };

    // Data as shown: the app data, plus any check-in this phone has just made, plus the live feed value.
    function view() {
      if (!state.local.checkedIn && !state.liveSet) return state.data;
      var out = {};
      Object.keys(state.data).forEach(function (k) { out[k] = state.data[k]; });
      if (state.local.checkedIn) {
        var t = {};
        Object.keys(state.data.tonight || {}).forEach(function (k) { t[k] = state.data.tonight[k]; });
        t.checkedIn = true;
        out.tonight = t;
      }
      if (state.liveSet) out.live = state.liveValue;
      return out;
    }

    // Asks the live feed every 5 s while a game is on. Only the live card is redrawn, so focus stays put.
    function pollLive() {
      if (!handlers.liveFeed || (typeof document !== 'undefined' && document.hidden)) return;
      var v = view();
      if (!v.live && tonightKind(v.next, Date.now()) !== 'on') return;
      Promise.resolve().then(function () { return handlers.liveFeed(); }).then(function (res) {
        if (!res || !('live' in res)) return;
        var wasLive = !!view().live;
        state.liveSet = true;
        state.liveValue = res.live || null;
        if (!!state.liveValue !== wasLive) { render(); return; }
        redrawLive();
      }, function () { /* keep the last score on screen */ });
    }

    function redrawLive() {
      var v = view();
      var old = el.querySelector('.ph-live-card');
      var html = v.live ? liveCardHtml(v.live, Date.now()) : '';
      if (old) old.outerHTML = html;
      else if (html) el.insertAdjacentHTML('afterbegin', html);
    }

    function render() {
      var now = Date.now();
      var v = view();
      el.innerHTML = page(v, now, state.flash);
      bindSlots(el);
      state.key = stateKey(v, now);
    }

    // One clock. Redraws only when the state changes, otherwise just the number.
    function tick() {
      var now = Date.now();
      var v = view();
      if (stateKey(v, now) !== state.key) { render(); return; }
      var out = el.querySelector('[data-count]');
      if (out && v.next) out.textContent = countdown(Date.parse(v.next.startsAt) - now);
      var clockOut = el.querySelector('[data-live-clock]');
      if (clockOut && v.live) clockOut.textContent = liveClock(v.live, now);
    }

    function setDigits(s) {
      state.sheetDigits = s;
      if (!state.sheet) return;
      var boxes = state.sheet.querySelectorAll('[data-box]');
      for (var i = 0; i < boxes.length; i++) boxes[i].textContent = s.charAt(i) || ' ';
      state.sheet.querySelector('[data-digits]').setAttribute('aria-label', 'Door code, ' + s.length + ' of 4 digits entered');
    }

    function setMsg(text) {
      if (!state.sheet) return;
      state.sheet.querySelector('[data-msg]').textContent = text || '';
    }

    function setBusy(on) {
      state.busy = on;
      if (!state.sheet) return;
      var keys = state.sheet.querySelectorAll('[data-key]');
      for (var i = 0; i < keys.length; i++) keys[i].disabled = on;
      // A disabled key loses focus, so keep focus on the dialog while the code is checked.
      if (on) state.sheet.focus();
    }

    // Marks everything outside the sheet inert, so screen readers and Tab skip the page behind it.
    // aria-hidden is set too, for browsers without inert. The focus trap covers the rest.
    function setBackgroundInert(on) {
      if (on) {
        state.inerted = [];
        Array.prototype.forEach.call(document.body.children, function (node) {
          if (node === state.sheet || node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true') return;
          state.inerted.push(node);
          node.setAttribute('inert', '');
          node.setAttribute('aria-hidden', 'true');
        });
        return;
      }
      (state.inerted || []).forEach(function (node) { node.removeAttribute('inert'); node.removeAttribute('aria-hidden'); });
      state.inerted = [];
    }

    function closeSheet() {
      if (!state.sheet) return;
      setBackgroundInert(false);
      document.removeEventListener('keydown', onSheetKey);
      state.sheet.parentNode.removeChild(state.sheet);
      state.sheet = null;
      state.sheetDigits = '';
      state.busy = false;
      // Focus goes back to the button that opened the sheet.
      var back = state.returnFocus;
      state.returnFocus = null;
      if (back && back.focus && document.body.contains(back)) back.focus();
    }

    function finishCheckIn(res) {
      if (res && res.ok) {
        state.local.checkedIn = true;
        state.flash = '';
        closeSheet();
        render();
        return;
      }
      state.flash = '';
      setBusy(false);
      setDigits('');
      setMsg(codeErrorText(res && res.error));
    }

    // next-31: the inline Join box. Same check-in as the keypad sheet.
    function submitJoin() {
      var input = el.querySelector('#ph-join-code');
      var code = input ? String(input.value || '').replace(/\D/g, '') : '';
      if (code.length !== 4) { state.flash = 'Enter the 4-digit code.'; render(); return; }
      if (!handlers.checkIn) return;
      state.flash = '';
      Promise.resolve()
        .then(function () { return handlers.checkIn(code); })
        .then(function (res) {
          state.flash = (res && res.ok) ? '' : codeErrorText(res && res.error);
          render();
        }, function () { state.flash = codeErrorText(''); render(); });
    }

    function submitCode(code) {
      if (!handlers.checkIn) { setBusy(false); setMsg(codeErrorText('')); return; }
      setBusy(true);
      setMsg('');
      Promise.resolve()
        .then(function () { return handlers.checkIn(code); })
        .then(finishCheckIn, function () { finishCheckIn({ ok: false, error: '' }); });
    }

    function pressKey(k) {
      if (state.busy || !state.sheet) return;
      if (k === 'clear') { setDigits(''); setMsg(''); return; }
      if (k === 'del') { setDigits(state.sheetDigits.slice(0, -1)); setMsg(''); return; }
      if (state.sheetDigits.length >= 4) return;
      setDigits(state.sheetDigits + k);
      setMsg('');
      if (state.sheetDigits.length === 4) submitCode(state.sheetDigits);
    }

    // Keeps Tab and Shift+Tab inside the sheet while it is open.
    function trapTab(e) {
      var items = Array.prototype.slice.call(state.sheet.querySelectorAll('button')).filter(function (b) { return !b.disabled; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      var inside = state.sheet.contains(document.activeElement);
      if (!inside) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function onSheetKey(e) {
      if (!state.sheet) return;
      if (e.key === 'Escape') { closeSheet(); return; }
      if (e.key === 'Tab') { trapTab(e); return; }
      if (/^[0-9]$/.test(e.key)) { pressKey(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { pressKey('del'); e.preventDefault(); }
    }

    function openSheet() {
      if (state.sheet) return;
      state.returnFocus = document.activeElement;
      state.sheet = buildSheet();
      document.body.appendChild(state.sheet);
      var firstKey = state.sheet.querySelector('[data-key="1"]');
      if (firstKey) firstKey.focus();
      state.sheet.addEventListener('click', function (e) {
        var close = e.target.closest ? e.target.closest('[data-sheet-close]') : null;
        if (close) { closeSheet(); return; }
        var key = e.target.closest ? e.target.closest('[data-key]') : null;
        if (key) pressKey(key.getAttribute('data-key'));
      });
      document.addEventListener('keydown', onSheetKey);
      setBackgroundInert(true);
      setDigits('');
      setMsg('');
    }

    function onClick(e) {
      var a = e.target.closest ? e.target.closest('[data-go]') : null;
      if (!a || !el.contains(a)) return;
      var go = a.getAttribute('data-go');
      if (go === 'here') { e.preventDefault(); openSheet(); return; }
      if (go === 'coach-dismiss') {
        e.preventDefault();
        coachDone();
        render();
        var main = el.querySelector('.ph-btn:not(.ph-btn--ghost)');
        if (main) main.focus();
        return;
      }
      if (go === 'join') { e.preventDefault(); submitJoin(); return; }
      var fn = handlers[go];
      if (typeof fn === 'function') { e.preventDefault(); fn(a); }
    }

    el.classList.add('ph');
    el.addEventListener('click', onClick);
    render();
    state.timer = setInterval(tick, 1000);
    state.liveTimer = setInterval(pollLive, 5000);

    return {
      // The integrator calls this after its own player_check_in succeeds (for example from a #in/1234 link).
      markHere: function () {
        state.local.checkedIn = true;
        state.flash = '';
        closeSheet();
        render();
      },
      update: function (next) {
        state.data = next || {};
        state.local = {};      // the app data now says what is true
        state.liveSet = false; // the app's live value is used again until the next feed reply
        render();
      },
      destroy: function () {
        clearInterval(state.timer);
        clearInterval(state.liveTimer);
        el.removeEventListener('click', onClick);
        closeSheet();
        el.innerHTML = '';
        el.classList.remove('ph');
      }
    };
  }

  registerBuiltIns();

  root.PlayerHome = {
    mount: mount,
    register: register,
    tonightKind: tonightKind,
    mainAction: mainAction,
    inCodeWindow: inCodeWindow,
    codeErrorText: codeErrorText,
    countdown: countdown,
    liveClock: liveClock,
    nightKind: nightKind,
    fmt: fmt
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PlayerHome;
})(typeof window !== 'undefined' ? window : globalThis);
