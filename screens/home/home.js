/* Player app: Home lobby screen. Owner: Home thread. Plain JS, no framework, no network.
   Usage:
     var h = PlayerHome.mount(el, data, { onCard, onLineup, onLive, onNight, onShop });
     h.update(newData);   // re-render with fresh data
     h.destroy();         // stop the clock and remove listeners
   data = {
     player: { name, banner, nameStyle, clanTag, callingCard, emblemSrc, skill: 'Steady Starter', games, wins },
     run:    PlayerXp run object (xp, maxLevel, stars, ...),
     coins:  240,
     next:   { gameNo: 3, vs: 'Team Red', dayLabel: 'Day, 7:45', startsAt: ISO string } or null,
     nextRunLabel: 'No run set',         // shown when next is null
     schedule: [{ no: 1, time: '19:00', vs: 'Team Blue', state: 'done'|'live'|'next'|'todo' }],
     lastNight: { xp: 143, games: 3, wins: 2 } or null,
     live: { game: 2, teamA: 'Red', scoreA: 14, teamB: 'Blue', scoreB: 12, clock: '4:10 left' } or null,
     updatedAt: '10:42' or null,          // shows "Last updated" when set (offline)
     rsvp:   { ok, reason, closed, cancelled, me: 'in' | 'out' | null, fillingUp } or null,  // from player_get_in (R74, R88)
     rsvpError: false                     // true after a failed "I'm in" / "Can't make it" save
   }
   Shows at most three cards: tonight, pay (while owed), last night (after a run). Old copy: screens/home/_old/home-next59b.js.
   handlers.rsvp(state) is called on "I'm in" ('in') or "Can't make it" ('out'). It may return a promise; the buttons are off until it settles.
   Rules: revamp/build/player-app-plan/XP-SYSTEM.md. Skill (1 to 30) is shown as a name only, never mixed with XP level.
   Lineup button shows only in the last 60 seconds before tip-off. Nothing animates on open.
*/
(function (root) {
  'use strict';

  var PN = root.PlayerName;
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
    // R177: no game times on the night. Count down to the run start, then say the game is next (no countdown).
    if (next.timed === false) return now >= t ? 'next' : ((t - now) <= LINEUP_LEAD_MS ? 'lineup' : 'wait');
    if (now >= t) return now < t + ON_COURT_MS ? 'on' : 'wait';
    return (t - now) <= LINEUP_LEAD_MS ? 'lineup' : 'wait';
  }

  // "I'm in / Can't make it" (R74, R85): a quiet row under the Tonight card, only while no run is open.
  // Players see their own answer and the "Filling up" word. Never names or counts.
  function rsvpWord(r) {
    if (root.PlayerFillingUp && typeof root.PlayerFillingUp.wordFor === 'function') return root.PlayerFillingUp.wordFor(r);
    return r && r.ok === true && r.fillingUp === true ? 'Filling up' : '';
  }

  function rsvpHtml(d, kind, busy) {
    var r = d.rsvp;
    if (kind !== 'wait' || !r) return '';
    if (d.pay && d.pay.gate) return '<p class="ph-rsvp-quiet">Pay first to say you’re coming. See the Pay line below.</p>';
    if (r.ok !== true) {
      return (r.reason === 'no-night' || r.reason === 'signed-out') ? '' :
        '<p class="ph-rsvp-quiet">Who’s coming is not available yet.</p>';
    }
    if (r.cancelled) return '<p class="ph-rsvp-quiet">This run is cancelled.</p>';
    if (r.closed) return '';
    var btn = function (state, label, on) {
      return '<button type="button" class="ph-rsvp-btn' + (on ? ' is-on' : '') + '" data-rsvp="' + state +
        '" aria-pressed="' + (on ? 'true' : 'false') + '"' + (busy ? ' disabled' : '') + '>' + label + '</button>';
    };
    var word = rsvpWord(r);
    return '<div class="ph-rsvp" role="group" aria-label="Are you coming?">' +
      '<p class="ph-rsvp-q">Are you coming?</p>' +
      '<div class="ph-rsvp-btns">' +
        btn('in', r.me === 'in' ? 'You’re in' : 'I’m in', r.me === 'in') +
        btn('out', 'Can’t make it', r.me === 'out') +
      '</div>' +
      '<p class="ph-more">More to come<span class="ph-dots" aria-hidden="true"><i></i><i></i><i></i></span></p>' +
      (word ? '<p class="ph-rsvp-word">' + esc(word) + '</p>' : '') +
      (d.rsvpError ? '<p class="ph-note" role="alert">Could not save that. Check the signal and try again.</p>' : '') +
    '</div>';
  }

  // Join keypad (door code, 4 digits), on Home inside the tonight card. Never shows the code.
  // kp = { code, busy, msg, sub, action: null | 'retry' | 'signin', lockedUntil: ms, joined }
  // Clock time for the player, e.g. 8:14 PM. Accepts an ISO string or epoch ms.
  function clock(t) {
    var d = new Date(typeof t === 'number' ? t : Date.parse(t));
    if (isNaN(d.getTime())) return 'soon';
    var h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + pad(d.getMinutes()) + ' ' + ap;
  }

  // Turns a join answer into what the keypad shows. See R113 in revamp/FABLE-RULINGS-15NOV.md.
  function joinOutcome(r) {
    if (r && r.ok === true) return { joined: true };
    var reason = r && r.reason;
    if (reason === 'wrong-code') {
      var n = Number(r.triesLeft);
      return { clear: true, msg: 'That code is not right. Ask at the desk.',
        sub: isNaN(n) ? '' : n + (n === 1 ? ' try left' : ' tries left') };
    }
    if (reason === 'locked') {
      var until = typeof r.until === 'number' ? r.until : Date.parse(r.until);
      // No usable time from the server: the wording without the countdown (R119).
      if (isNaN(until)) return { clear: true, msg: 'Too many tries. Ask the organiser to let you in.' };
      return { clear: true, lockedUntil: until };
    }
    if (reason === 'no-code') return { clear: true, msg: 'No run is open yet.' };
    if (reason === 'closed') return { clear: true, msg: 'This run has ended.' };
    if (reason === 'too-early') {
      var opens = r.opensAt ? (typeof r.opensAt === 'number' ? r.opensAt : Date.parse(r.opensAt)) : NaN;
      return { clear: true, msg: isNaN(opens) ? 'The code is not open yet.' : 'The code opens at ' + clock(r.opensAt) + '.' };
    }
    if (reason === 'signin') return { msg: 'Sign in to join.', action: 'signin' };
    if (reason === 'timeout') return { msg: 'Can’t reach Check Ball right now. Check your signal.', action: 'retry' };
    return { msg: 'Could not join. Check the signal and try again.', action: 'retry' };
  }

  // Lock wait in words, counted from the server's until time (R119). Rounds up, so it never says 0.
  function waitWords(ms) {
    var secs = Math.ceil(ms / 1000);
    if (secs <= 60) return secs + (secs === 1 ? ' second' : ' seconds');
    var mins = Math.ceil(secs / 60);
    return mins + (mins === 1 ? ' minute' : ' minutes');
  }

  // r8: Home shows one "Enter the code" button. The keypad opens on tap, so the card is calm until it is needed.
  function keyHtml(kp) {
    if (!kp) return '';
    if (kp.joined || kp.open) return keypadHtml(kp);
    return '<button type="button" class="ph-btn ph-kp-open" data-key="open">Enter the code</button>';
  }

  function keypadHtml(kp) {
    if (kp.joined) return '<p class="ph-kp-done" role="status">You’re in. See you at the run.</p>';
    var left = kp.lockedUntil ? kp.lockedUntil - Date.now() : 0;
    var locked = left > 0;
    var msg = locked ? 'Too many tries. Try again in ' + waitWords(left) + ', or ask the organiser to let you in.' : kp.msg;
    var cells = '';
    for (var i = 0; i < 4; i++) {
      cells += '<span class="ph-kp-cell' + (i < kp.code.length ? ' is-set' : '') + '" aria-hidden="true">' +
        (i < kp.code.length ? '•' : '') + '</span>';
    }
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];
    var btns = keys.map(function (k) {
      var label = k === 'del' ? 'Del' : (k === 'go' ? 'Join' : k);
      var dis = kp.busy || locked || (k === 'go' && kp.code.length !== 4) ? ' disabled' : '';
      return '<button type="button" class="ph-kp-key' + (k === 'go' ? ' ph-kp-key--go' : '') + '" data-key="' + k + '"' + dis + '>' + label + '</button>';
    }).join('');
    var extra = '';
    if (kp.action === 'retry') extra = '<button type="button" class="ph-kp-retry" data-key="retry"' + (kp.busy ? ' disabled' : '') + '>Try again</button>';
    if (kp.action === 'signin') extra = '<button type="button" class="ph-kp-retry" data-go="signin">Sign in</button>';
    return '<div class="ph-kp" role="group" aria-label="Enter the code from the organiser">' +
      '<p class="ph-rsvp-q">Enter the code from the organiser</p>' +
      '<div class="ph-kp-cells">' + cells + '</div>' +
      '<div class="ph-kp-keys">' + btns + '</div>' +
      (msg ? '<p class="ph-note ph-kp-msg" role="alert">' + esc(msg) + (!locked && kp.sub ? ' <b>' + esc(kp.sub) + '</b>' : '') + '</p>' : '') +
      extra +
    '</div>';
  }

  // Run day word (M): a run belongs to the London day it starts on. "Tonight" only while it is tonight.
  function runWord(n, now) {
    var R = typeof window !== 'undefined' ? window.PlayerRunDay : null;
    if (!R) return n.dayLabel || 'Next run';
    return R.isTonight(n, now) ? (n.dayLabel || 'Tonight') : R.dayLabel(n);
  }

  function tonightHtml(d, now, busy, kp) {
    // 72h (R300): one state only. A run that is live (organiser pressed Start run) shows as on, never with a countdown.
    var kind = d.runOn && d.next ? 'on' : tonightKind(d.next, now);
    if (kind === 'none' && d.runOn) {
      return '' +
        '<div class="ph-card ph-card--hero">' +
          '<span class="ph-cap">' + (d.next && window.PlayerRunDay && window.PlayerRunDay.isTonight(d.next, now) ? 'Tonight' : 'Next run') + '</span>' +
          '<h2>Run is on</h2>' +
          (d.runLabel ? '<p class="ph-vs">' + esc(d.runLabel) + '</p>' : '') +
          '<p class="ph-note">Teams show when the organiser sends them.</p>' +
          keyHtml(kp) +
        '</div>';
    }
    if (kind === 'none') {
      return '' +
        '<div class="ph-card">' +
          '<span class="ph-cap">Run</span>' +
          '<h2>No run on</h2>' +
          '<p class="ph-muted">Next run: <b class="ph-ink">' + esc(d.nextRunLabel || 'soon') + '</b></p>' +
        '</div>';
    }
    var n = d.next;
    var t = Date.parse(n.startsAt);
    var head = '<span class="ph-cap">' + esc(runWord(n, now)) + '</span>' +
               '<h2>Game ' + esc(n.gameNo) + '</h2>' +
               (n.vs ? '<p class="ph-vs">vs <b>' + esc(n.vs) + '</b></p>' : (n.versus ? '<p class="ph-vs"><b>' + esc(n.versus) + '</b></p>' : ''));
    var count;
    var action = '';
    if (kind === 'on') {
      count = '<span class="ph-count-label">Game on</span><b class="ph-count-num">Now</b>';
      action = '<a class="ph-btn ph-btn--ghost" href="#live" data-go="live">Watch live</a>';
    } else if (kind === 'next') {
      count = '<span class="ph-count-label">Game is next</span>';
    } else if (kind === 'lineup') {
      count = '<span class="ph-count-label">Tip-off in</span><b class="ph-count-num" data-count>' + fmt(t - now) + '</b>';
      action = '<a class="ph-btn" href="#lineup" data-go="lineup">See my lineup</a>';
    } else {
      count = '<span class="ph-count-label">Starts in</span><b class="ph-count-num" data-count>' + fmt(t - now) + '</b>';
      action = '<p class="ph-note">' + (d.teamsIn ? 'Teams show 1 minute before the start.' : 'Teams show when the organiser sends them.') + '</p>';
    }
    if (n.notIn && kind !== 'on') {
      action = '<p class="ph-note">You’re not in this game.' + (n.playsIn ? ' You play in Game ' + esc(n.playsIn) + '.' : '') + '</p>';
    }
    // r8: while the code keypad is open, the extra buttons step aside so the keypad is the one job on the card.
    var kpOpen = !!(kp && kp.open && !kp.joined);
    if (kpOpen) action = '';
    // Add to calendar (P8): only while the night is still to come, and never for a night you are not in.
    var calHtml = (hasCalendar() && !n.notIn && !kpOpen) ? PlayerCalendar.calendarButtonHtml(calNight(n), { now: now }) : '';
    var rsLine = d.runState ? '<p class="ph-runstate" role="status">' + esc(d.runState) + '</p>' : '';
    return '<div class="ph-card ph-card--hero">' + head + rsLine +
      '<div class="ph-count">' + count + '</div>' + action + calHtml + rsvpHtml(d, kind, busy) + keyHtml(kp) + '</div>';
  }

  // The one Pay line in the app (Home only). "I’ve paid cash" is a claim for the organiser to check, not a payment.
  // pay = { amount, status: 'due' | 'claimed' | 'paid', link, error }
  function payHtml(pay) {
    if (!pay || !pay.amount) return '';
    if (pay.status === 'paid') {
      return '<section class="ph-block ph-pay"><p><b>Paid. You’re in.</b></p></section>';
    }
    if (pay.status === 'claimed') {
      return '<section class="ph-block ph-pay"><p><b>Waiting for the organiser to confirm.</b></p></section>';
    }
    var card = /^https:\/\/\S+$/.test(String(pay.link || ''))
      ? '<a class="ph-btn" href="' + esc(pay.link) + '" target="_blank" rel="noopener" data-go="cardpay">Pay by card</a>'
      : '';
    if (pay.status === 'card') {
      // 72k: never a dead end. Checking line, then both ways to pay stay on screen.
      return '<section class="ph-block ph-pay"><p><b>Checking your card payment</b></p><p class="ph-note">This turns to Paid by itself. If it did not go through, you can still pay.</p>' +
        card +
        '<button class="ph-btn ph-btn--ghost" type="button" data-go="paid">I’m paying cash</button></section>';
    }
    return '<section class="ph-block ph-pay">' +
      '<p><b>You owe ' + esc(pay.amount) + '.</b> Pay by card or in cash.</p>' +
      card +
      '<button class="ph-btn ph-btn--ghost" type="button" data-go="paid">I’m paying cash</button>' +
      (pay.error ? '<p class="ph-note" role="alert">Could not send. Try again.</p>' : '') +
    '</section>';
  }

  function lastNightHtml(ln) {
    var body = ln
      ? '<b>+' + esc(ln.xp) + ' points</b><span>' + esc(ln.games) + ' games · ' + esc(ln.wins) + ' wins</span>'
      : '<b>No run yet</b><span>Your last run shows here</span>';
    return '<a class="ph-row ph-card" href="#stats" data-go="night"><span class="ph-cap">Last run</span><div class="ph-row-body">' + body + '</div></a>';
  }

  // Home shows at most three cards (R62): the tonight card, the pay card while owed, and the last-night card after a run.
  // Live, Stats and Profile hold the rest.
  function page(d, now, busy, kp) {
    var sv = (typeof window !== 'undefined' && window.ShopStrip && window.ShopStrip.html({ coins: d.coins || 0, level: d.level || 0, live: !!d.live, items: (d.shopItems || []), newLooks: !!d.newLooks, worn: d.shopWorn || {} })) || '';
    return '' +
      '<header class="ph-top">' +
        '<h1>Home</h1>' +
        '<a class="ph-coins" href="#shop" data-go="shop" aria-label="Coins, open shop">' + ICON.coin +
          '<b>' + esc(d.coins == null ? '–' : d.coins) + '</b><span class="ph-cap">Coins</span></a>' +
      '</header>' +
      '<div data-slot="tonight">' + tonightHtml(d, now, busy, kp) + '</div>' +
      sv +
      payHtml(d.pay) +
      (d.lastNight ? lastNightHtml(d.lastNight) : '') +
      (d.updatedAt ? '<p class="ph-note ph-updated">' + ICON.clock + ' Last updated ' + esc(d.updatedAt) + '</p>' : '');
  }

  // The night the calendar file is made from: the next run's start time.
  function hasCalendar() { return typeof window !== 'undefined' && !!window.PlayerCalendar; }
  function calNight(n) { return n && n.startsAt ? { startsAt: n.startsAt, title: 'Check Ball run' } : null; }

  function mount(el, data, handlers) {
    handlers = handlers || {};
    var state = { data: data || {}, kind: null, timer: null, busy: false,
      kp: { code: '', busy: false, msg: null, sub: null, action: null, lockedUntil: 0, open: false, joined: !!(data && data.checkedIn) } };
    var showKp = typeof handlers.join === 'function';
    if (hasCalendar()) PlayerCalendar.attach(el, function () { return calNight(state.data.next); });

    function render() {
      var now = Date.now();
      el.innerHTML = page(state.data, now, state.busy, showKp && (state.kind !== 'none' || state.data.runOn) ? state.kp : null);
      state.kind = tonightKind(state.data.next, now);
    }

    // "I'm in" / "Can't make it": one tap at a time. The integrator saves, then calls update() with fresh data.
    function tapRsvp(btn) {
      if (state.busy || typeof handlers.rsvp !== 'function') return;
      state.busy = true;
      render();
      var done = function () { state.busy = false; render(); };
      Promise.resolve().then(function () { return handlers.rsvp(btn.getAttribute('data-rsvp')); }).then(done, done);
    }

    // Join keypad: digits add to the code (4 max), Del removes one, Join sends it once.
    // Wrong code, locked, closed and the rest clear the entry. Timeout and sign-in keep it, and timeout is not a wrong try.
    var JOIN_TIMEOUT_MS = typeof handlers.joinTimeoutMs === 'number' ? handlers.joinTimeoutMs : 8000;
    function submitJoin() {
      var kp = state.kp;
      if (kp.code.length !== 4 || kp.busy) return;
      kp.busy = true; kp.msg = null; kp.sub = null; kp.action = null; render();
      var timer;
      var timeout = new Promise(function (res) { timer = setTimeout(function () { res({ ok: false, reason: 'timeout' }); }, JOIN_TIMEOUT_MS); });
      var ask = Promise.resolve().then(function () { return handlers.join(kp.code); });
      var apply = function (r) {
        clearTimeout(timer);
        var o = joinOutcome(r);
        kp.busy = false;
        kp.open = true;   // the answer is always shown, so the keypad stays open after a join attempt
        if (o.joined) { kp.joined = true; kp.code = ''; kp.msg = null; kp.sub = null; kp.action = null; }
        else {
          if (o.clear) kp.code = '';
          kp.msg = o.msg || null; kp.sub = o.sub || null; kp.action = o.action || null;
          if (o.lockedUntil) kp.lockedUntil = o.lockedUntil;
        }
        render();
      };
      Promise.race([ask, timeout]).then(apply, function () { apply({ ok: false, reason: 'error' }); });
    }
    function tapKey(k) {
      var kp = state.kp;
      if (kp.busy || kp.joined) return;
      if (k === 'open') { kp.open = true; render(); return; }
      if (k === 'retry') { submitJoin(); return; }
      if (kp.lockedUntil && Date.now() < kp.lockedUntil) return;
      if (k === 'del') { kp.code = kp.code.slice(0, -1); kp.msg = null; kp.sub = null; kp.action = null; render(); return; }
      if (k === 'go') { submitJoin(); return; }
      if (kp.code.length >= 4) return;
      kp.code += k; kp.msg = null; kp.sub = null; kp.action = null; render();
    }

    // One clock. Re-renders only when the tonight state changes, otherwise just the number.
    function tick() {
      var now = Date.now();
      if (state.kp.lockedUntil && now >= state.kp.lockedUntil) { state.kp.lockedUntil = 0; render(); return; }
      if (state.kp.lockedUntil) { render(); return; }  // live countdown while locked
      var kind = tonightKind(state.data.next, now);
      if (kind !== state.kind) { render(); return; }
      var out = el.querySelector('[data-count]');
      if (out && state.data.next) out.textContent = fmt(Date.parse(state.data.next.startsAt) - now);
    }

    function onClick(e) {
      var kk = e.target.closest ? e.target.closest('[data-key]') : null;
      if (kk && el.contains(kk)) { e.preventDefault(); tapKey(kk.getAttribute('data-key')); return; }
      var rs = e.target.closest ? e.target.closest('[data-rsvp]') : null;
      if (rs && el.contains(rs)) { e.preventDefault(); tapRsvp(rs); return; }
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
      update: function (next) {
        state.data = next || {};
        state.kp.joined = !!state.data.checkedIn;   // follows the remembered join for this night, so a new run shows the keypad again
        render();
      },
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
