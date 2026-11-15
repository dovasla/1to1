/* Player app: Add to calendar. Owner: N4 calendar module. Plain JS, no framework, no network.
   Makes one .ics file in the browser for the next night and downloads it. Works on iPhone and
   Android with no server. Only the title, place and description the caller passes go in the file.

   Browser: window.PlayerCalendar. Node tests: calendar.test.js.

   Usage:
     var c = PlayerCalendar.attach(homeEl, function () { return nightFor(state); }); // once, on a container
     homeEl.innerHTML = '...' + PlayerCalendar.calendarButtonHtml(night) + '...';   // button shows when the night is still to come
     c.destroy();

   night = { startsAt: ISO string or ms, title?, place?, description?, weekly?: true|false }
     weekly: omitted = repeat weekly only if the night is a regular one (Thu 8pm or Sun 11am, London time).
     Rules and reasons: revamp/build/player-app-modules/calendar/README.md
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlayerCalendar = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var G = typeof window !== 'undefined' ? window : globalThis;
  var TZ = 'Europe/London';
  var DURATION_MIN = 120;            // a night is 2 hours
  var ALARM_MIN_BEFORE = 120;        // reminder 2 hours before
  var DEFAULT_TITLE = '1TO1 basketball night';
  var BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  var DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // Regular nights repeat weekly. dow: 0 = Sunday. London local time.
  var REGULAR = [{ dow: 4, h: 20, mi: 0 }, { dow: 0, h: 11, mi: 0 }];
  var VTIMEZONE = [
    'BEGIN:VTIMEZONE',
    'TZID:' + TZ,
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0000',
    'TZOFFSETTO:+0100',
    'TZNAME:BST',
    'DTSTART:19700329T010000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0000',
    'TZNAME:GMT',
    'DTSTART:19701025T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  var partFmt = null;
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  function toMs(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (typeof v !== 'string') return NaN;
    return Date.parse(v);
  }

  // Clock parts of an instant in London time. dow: 0 = Sunday.
  function londonParts(ms) {
    if (!partFmt) {
      partFmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, hourCycle: 'h23', weekday: 'short',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
      });
    }
    var p = {};
    partFmt.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return {
      y: +p.year, mo: +p.month, d: +p.day,
      h: +p.hour, mi: +p.minute, s: +p.second,
      dow: DOW[p.weekday]
    };
  }

  function localStamp(lp) {
    return lp.y + p2(lp.mo) + p2(lp.d) + 'T' + p2(lp.h) + p2(lp.mi) + p2(lp.s);
  }

  function utcStamp(ms) {
    return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function isRegularNight(ms) {
    var p = londonParts(ms);
    return REGULAR.some(function (r) {
      return r.dow === p.dow && r.h === p.h && r.mi === p.mi && p.s === 0;
    });
  }

  // RFC 5545 text escaping.
  function escapeText(s) {
    return String(s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n');
  }

  function utf8Len(ch) {
    var c = ch.codePointAt(0);
    return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }

  // Lines are at most 75 octets. Continuation lines start with one space.
  function fold(line) {
    var out = [], cur = '', bytes = 0;
    Array.from(line).forEach(function (ch) {
      var b = utf8Len(ch);
      if (bytes + b > 75) { out.push(cur); cur = ' '; bytes = 1; }
      cur += ch;
      bytes += b;
    });
    out.push(cur);
    return out.join('\r\n');
  }

  function alarmTrigger(min) {
    return min % 60 === 0 ? '-PT' + (min / 60) + 'H' : '-PT' + min + 'M';
  }

  // Returns the whole .ics text (CRLF line endings). Throws if startsAt is not a date.
  function buildIcs(night, now) {
    night = night || {};
    var start = toMs(night.startsAt);
    if (!isFinite(start)) throw new Error('calendar: bad start time');
    var end = start + DURATION_MIN * 60000;
    var weekly = night.weekly == null ? isRegularNight(start) : !!night.weekly;
    var stamp = now == null ? Date.now() : toMs(now);
    var sp = londonParts(start);
    var ep = londonParts(end);
    var title = night.title || DEFAULT_TITLE;

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//1TO1//Player app//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ].concat(VTIMEZONE, [
      'BEGIN:VEVENT',
      'UID:1to1-' + utcStamp(start) + (weekly ? '-weekly' : '') + '@1TO1',
      'DTSTAMP:' + utcStamp(stamp),
      'DTSTART;TZID=' + TZ + ':' + localStamp(sp),
      'DTEND;TZID=' + TZ + ':' + localStamp(ep)
    ]);
    if (weekly) lines.push('RRULE:FREQ=WEEKLY;BYDAY=' + BYDAY[sp.dow]);
    lines.push('SUMMARY:' + escapeText(title));
    if (night.place) lines.push('LOCATION:' + escapeText(night.place));
    if (night.description) lines.push('DESCRIPTION:' + escapeText(night.description));
    lines.push(
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + escapeText(title + ' starts in 2 hours'),
      'TRIGGER:' + alarmTrigger(ALARM_MIN_BEFORE),
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    );
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  // File name in London time, e.g. 1to1-night-20261119-2000.ics
  function fileName(night) {
    var p = londonParts(toMs(night.startsAt));
    return '1to1-night-' + p.y + p2(p.mo) + p2(p.d) + '-' + p2(p.h) + p2(p.mi) + '.ics';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Button for the Next night card or More. Empty when there is no night, or the night has started.
  // opts: { label, primary (yellow, default false: ghost so it never competes with the main button), now }
  function calendarButtonHtml(night, opts) {
    opts = opts || {};
    var start = night ? toMs(night.startsAt) : NaN;
    if (!isFinite(start)) return '';
    var now = opts.now == null ? Date.now() : toMs(opts.now);
    if (start <= now) return '';
    var cls = 'cal-btn' + (opts.primary ? '' : ' cal-btn--ghost');
    return '<button type="button" class="' + cls + '" data-cal-add>' + esc(opts.label || 'Add to calendar') + '</button>';
  }

  // Downloads the text as a file. Safari and Chrome hand .ics to the calendar app when opened.
  function download(text, name, doc) {
    doc = doc || G.document;
    var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    var url = G.URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    setTimeout(function () { G.URL.revokeObjectURL(url); }, 4000);
  }

  // One listener on the container, so it keeps working after the Home screen re-renders.
  // getNight: a night object, or a function that returns one. opts.onDone('ok' | 'error') is optional.
  function attach(el, getNight, opts) {
    opts = opts || {};
    var doc = el.ownerDocument || G.document;
    function onClick(e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-cal-add]') : null;
      if (!b || !el.contains(b)) return;
      e.preventDefault();
      var night = typeof getNight === 'function' ? getNight() : getNight;
      try {
        if (!night) throw new Error('calendar: no night');
        download(buildIcs(night), fileName(night), doc);
        if (typeof opts.onDone === 'function') opts.onDone('ok');
      } catch (err) {
        if (typeof opts.onDone === 'function') opts.onDone('error');
      }
    }
    el.addEventListener('click', onClick);
    return {
      destroy: function () { el.removeEventListener('click', onClick); }
    };
  }

  return {
    buildIcs: buildIcs,
    londonParts: londonParts,
    isRegularNight: isRegularNight,
    fileName: fileName,
    escapeText: escapeText,
    fold: fold,
    calendarButtonHtml: calendarButtonHtml,
    download: download,
    attach: attach,
    DURATION_MIN: DURATION_MIN,
    ALARM_MIN_BEFORE: ALARM_MIN_BEFORE,
    REGULAR: REGULAR
  };
});
