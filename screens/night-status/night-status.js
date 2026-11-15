/* Player app: night status banner (N14, 15 Nov 2026). Plain JS, no framework, no network.
   Owner: night-status thread. Shown as the top slot on Home. See README.md and HOOKS.md.

   Usage:
     var input = { status: 'on', message: 'Moved to 8:30', live: false,
                   games: [{ startsAt: '2026-11-19T19:00:00Z' }], spots: { going: 18, capacity: 20 },
                   payloadCancelled: false };
     PlayerNightStatus.html(input, Date.now());     // banner HTML, or '' when there is nothing to say
     PlayerNightStatus.hides(input, Date.now());    // { actions: bool, pay: bool }

   status            nights.status: 'on' | 'cancelled' | 'moved'. Anything else reads as 'on'.
   message           nights.message. Max 120 characters. Shown as plain text only (always escaped).
   live              true while a game is on court (from the live feed).
   games             [{ startsAt: ISO }] for the night. The last game decides "Night over".
   spots             { going, capacity } or null. "going" is the "I'm in" count (N2). Missing means no spot line.
   payloadCancelled  the old Cancel run flag (payload.cancelled). Counts as cancelled until the first game starts (Fable R10).
*/
(function (root) {
  'use strict';

  var MAX_MESSAGE = 120;
  var ON_COURT_MS = 7 * 60 * 1000;   // same as Home: a game is "on" for 7 minutes after tip-off

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Plain text: control characters and runs of spaces become one space, trimmed, 120 characters at most.
  function clean(message) {
    var s = String(message == null ? '' : message).replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
    var chars = Array.from(s);
    return chars.length > MAX_MESSAGE ? chars.slice(0, MAX_MESSAGE).join('') : s;
  }

  // Anything other than 'cancelled' or 'moved' reads as 'on', so a bad value can never hide a night.
  function status(v) { return v === 'cancelled' || v === 'moved' ? v : 'on'; }

  // A row from the nights table (or the backend's getNight result) to the three fields used here.
  function fromRow(row) {
    return { status: status(row && row.status), message: clean(row && row.message) };
  }

  function times(games) {
    var out = [];
    (games || []).forEach(function (g) {
      var t = Date.parse(g && g.startsAt);
      if (!isNaN(t)) out.push(t);
    });
    return out;
  }

  // The old Cancel run flag only counts until the first game starts. After that the night drops as before.
  function payloadCancelledNow(input, now) {
    if (!input || !input.payloadCancelled) return false;
    var t = times(input.games);
    return !t.length || now < Math.min.apply(null, t);
  }

  // One state for the top slot. Order matters: cancelled beats everything, then live, then over.
  function state(input, now) {
    var inp = input || {};
    if (status(inp.status) === 'cancelled' || payloadCancelledNow(inp, now)) return 'cancelled';
    if (inp.live) return 'live';
    var t = times(inp.games);
    if (t.length && now >= Math.max.apply(null, t) + ON_COURT_MS) return 'finished';
    if (status(inp.status) === 'moved') return 'moved';
    var sp = inp.spots;
    if (sp && Number.isInteger(sp.capacity) && Number.isInteger(sp.going)) {
      var left = sp.capacity - sp.going;
      if (left <= 0) return 'full';
      if (left <= 2) return 'spots';
    }
    return clean(inp.message) ? 'note' : 'none';
  }

  var COPY = {
    cancelled: { cap: 'Tonight', title: 'Cancelled', fallback: 'Not on tonight.' },
    moved:     { cap: 'Tonight', title: 'Moved', fallback: 'Check the new time with the organiser.' },
    live:      { cap: 'Tonight', title: 'Live now' },
    finished:  { cap: 'Tonight', title: 'Night over' },
    full:      { cap: 'Tonight', title: 'Night full', fallback: 'No spots left.' },
    spots:     { cap: 'Tonight', title: function (sp) { var n = sp.capacity - sp.going; return n === 1 ? '1 spot left' : n + ' spots left'; } },
    note:      { cap: 'From the organiser' }
  };

  // Which Home actions to hide. Cancelled hides I'm in and Pay. Over hides I'm in only.
  function hides(input, now) {
    var s = state(input, now);
    return { actions: s === 'cancelled' || s === 'finished', pay: s === 'cancelled' };
  }

  // Banner HTML. Empty string when there is nothing to say (no message, normal night).
  function html(input, now) {
    var s = state(input, now);
    if (s === 'none') return '';
    var c = COPY[s];
    var inp = input || {};
    var title = typeof c.title === 'function' ? c.title(inp.spots) : c.title;
    var msg = clean(inp.message);
    var body = msg || c.fallback || '';
    return '<section class="ns ns--' + s + '" role="status" aria-live="polite" data-night-status="' + s + '">' +
      '<span class="ns-cap">' + esc(c.cap) + '</span>' +
      (title ? '<h2 class="ns-title">' + esc(title) + '</h2>' : '') +
      (body ? '<p class="ns-msg">' + esc(body) + '</p>' : '') +
    '</section>';
  }

  root.PlayerNightStatus = {
    html: html, hides: hides, state: state, clean: clean, status: status, fromRow: fromRow,
    payloadCancelledNow: payloadCancelledNow, esc: esc, MAX_MESSAGE: MAX_MESSAGE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PlayerNightStatus;
})(typeof window !== 'undefined' ? window : globalThis);
