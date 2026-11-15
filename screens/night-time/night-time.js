/* Night time module for the player app. Pure: no DOM, no device clock tricks.
   nightWhen(night, now) -> what the app shows for a night, always in London time.

   Night shape it reads (all optional except date + run.startTime):
     night.date                  'YYYY-MM-DD' (the run date, London)
     night.run.startTime         'HH:MM' 24h (London)
     night.run.endTime           'HH:MM' 24h (default start + 2 hours)
     night.run.checkInOpens      'HH:MM' 24h (default start - 60 minutes)

   Returns:
     { ok: false, reason: 'no-night' | 'no-time' }   when nothing usable
     { ok: true, dayIndex (0 Sun .. 6 Sat), dayName, when ('Thursday, 8pm'),
       timeLabel ('8pm' or '8:15pm'), checkInOpensAt, startsAt, endsAt (ms),
       state: 'upcoming' | 'checkin' | 'live' | 'over',
       msToStart (ms, 0 once started) }

   Global: window.NightTime. Node: module.exports (for tests).
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NightTime = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TZ = 'Europe/London';
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var HOUR = 60 * 60 * 1000;
  var MIN = 60 * 1000;

  var fmt = null;
  function londonFormatter() {
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
    return fmt;
  }

  // Wall-clock parts in London for an instant (ms).
  function londonParts(ms) {
    var p = {};
    londonFormatter().formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return {
      y: +p.year, mo: +p.month, d: +p.day,
      h: +p.hour, mi: +p.minute, s: +p.second
    };
  }

  // Offset (ms) London is ahead of UTC at an instant. GMT = 0, BST = 1 hour.
  function londonOffset(ms) {
    var w = londonParts(ms);
    var asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
    return asUtc - (ms - (ms % 1000));
  }

  // London wall time (date + HH:MM) -> UTC instant (ms). Two passes handle the clock change.
  function londonToMs(y, mo, d, h, mi) {
    var guess = Date.UTC(y, mo - 1, d, h, mi);
    var off1 = londonOffset(guess);
    var ms = guess - off1;
    var off2 = londonOffset(ms);
    if (off2 !== off1) ms = guess - off2;
    return ms;
  }

  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3] };
  }

  function parseHm(s) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return { h: h, mi: mi };
  }

  function addMinutes(hm, minutes) {
    var t = hm.h * 60 + hm.mi + minutes;
    t = ((t % 1440) + 1440) % 1440;
    return { h: Math.floor(t / 60), mi: t % 60 };
  }

  function timeLabel(hm) {
    var ap = hm.h < 12 ? 'am' : 'pm';
    var h12 = hm.h % 12 === 0 ? 12 : hm.h % 12;
    return hm.mi === 0 ? h12 + ap : h12 + ':' + (hm.mi < 10 ? '0' : '') + hm.mi + ap;
  }

  function nightWhen(night, now) {
    var nowMs = now == null ? Date.now() : (now instanceof Date ? now.getTime() : +now);
    if (!night) return { ok: false, reason: 'no-night' };

    var date = parseDate(night.date);
    var start = night.run ? parseHm(night.run.startTime) : null;
    if (!date || !start) return { ok: false, reason: 'no-time' };

    var end = (night.run && parseHm(night.run.endTime)) || addMinutes(start, 120);
    var checkIn = (night.run && parseHm(night.run.checkInOpens)) || addMinutes(start, -60);

    var startsAt = londonToMs(date.y, date.mo, date.d, start.h, start.mi);
    var endsAt = londonToMs(date.y, date.mo, date.d, end.h, end.mi);
    if (endsAt <= startsAt) endsAt += 24 * HOUR; // ends after midnight
    var checkInOpensAt = londonToMs(date.y, date.mo, date.d, checkIn.h, checkIn.mi);
    if (checkInOpensAt > startsAt) checkInOpensAt -= 24 * HOUR; // check-in starts the day before

    var dayIndex = new Date(Date.UTC(date.y, date.mo - 1, date.d)).getUTCDay();
    var dayName = DAYS[dayIndex];

    var state;
    if (nowMs < checkInOpensAt) state = 'upcoming';
    else if (nowMs < startsAt) state = 'checkin';
    else if (nowMs < endsAt) state = 'live';
    else state = 'over';

    return {
      ok: true,
      dayIndex: dayIndex,
      dayName: dayName,
      timeLabel: timeLabel(start),
      when: dayName + ', ' + timeLabel(start),
      checkInOpensAt: checkInOpensAt,
      startsAt: startsAt,
      endsAt: endsAt,
      state: state,
      msToStart: Math.max(0, startsAt - nowMs)
    };
  }

  return {
    TZ: TZ,
    DAYS: DAYS,
    nightWhen: nightWhen,
    londonParts: londonParts,
    londonToMs: londonToMs,
    timeLabel: timeLabel
  };
});
