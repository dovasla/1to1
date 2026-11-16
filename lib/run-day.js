/* Player app: the one shared rule for "which day is a run on". Pure logic, no DOM, no network.
   Rule (R141 section E): a run belongs to the London day it starts on. It stays that run until it
   ends, even after midnight. The phone clock only tells us what time it is now (an absolute moment);
   it never decides which day a run is on. Times from the server are ISO strings with a Z.
   Loads in the browser as window.PlayerRunDay, and in node via require().
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlayerRunDay = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var TZ = 'Europe/London';
  var GAME_MS = 7 * 60 * 1000;        // a game is "on" for 7 minutes after tip-off (same as Home)
  var PART_FMT = null;

  function fmt() {
    if (!PART_FMT) {
      PART_FMT = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
      });
    }
    return PART_FMT;
  }

  function toMs(v) {
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    var t = Date.parse(String(v || ''));
    return isNaN(t) ? NaN : t;
  }

  // 'YYYY-MM-DD' for the London calendar day of a moment (ms, Date or ISO text). '' when unknown.
  function londonDayKey(v) {
    var ms = toMs(v);
    if (isNaN(ms)) return '';
    var p = {};
    fmt().formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }

  // The first game's start of a run, as ms. Accepts run.games[0].startsAt, run.startsAt or run.next.startsAt.
  function runStartMs(run) {
    if (!run) return NaN;
    var g = run.games && run.games[0];
    return toMs((g && g.startsAt) || run.startsAt || (run.next && run.next.startsAt));
  }

  // The day a run is on: the London day of its start. A server date ('YYYY-MM-DD', already London) is
  // used when there is no start time. Returns '' when neither is known (never a guessed day).
  function runDayKey(run) {
    var ms = runStartMs(run);
    if (!isNaN(ms)) return londonDayKey(ms);
    var d = run && run.date;
    return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? String(d) : '';
  }

  // When the run is over: last game's start + 7 min. Falls back to run.endsAt when the server sends one.
  function runEndMs(run) {
    if (run && run.endsAt) { var e = toMs(run.endsAt); if (!isNaN(e)) return e; }
    var games = (run && run.games) || [];
    var last = NaN;
    games.forEach(function (g) { var t = toMs(g && g.startsAt); if (!isNaN(t) && (isNaN(last) || t > last)) last = t; });
    if (isNaN(last)) { last = runStartMs(run); }
    return isNaN(last) ? NaN : last + GAME_MS;
  }

  // True while the run has not ended yet, whatever day it is now. This is what keeps a 23:30 run on through midnight.
  function isRunOn(run, nowMs) {
    var end = runEndMs(run), now = toMs(nowMs);
    if (isNaN(end) || isNaN(now)) return false;
    return now < end;
  }

  // "Tonight" only when the run's day is today in London. After midnight the run keeps its own day.
  function isTonight(run, nowMs) {
    var key = runDayKey(run);
    return !!key && key === londonDayKey(nowMs);
  }

  // Short label for the run's day, London time: 'Thu 19 Nov'. Empty when unknown.
  function dayLabel(run) {
    var ms = runStartMs(run);
    if (isNaN(ms)) return '';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short'
    }).format(new Date(ms));
  }

  return {
    TZ: TZ,
    GAME_MS: GAME_MS,
    londonDayKey: londonDayKey,
    runStartMs: runStartMs,
    runDayKey: runDayKey,
    runEndMs: runEndMs,
    isRunOn: isRunOn,
    isTonight: isTonight,
    dayLabel: dayLabel
  };
});
