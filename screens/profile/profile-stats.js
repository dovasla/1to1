/* My numbers + night history for the Profile screen (player app). Pure render: data in, HTML out.
   Browser: window.PlayerProfileStats. Node tests: profile-stats.test.js.
   Shown under "Your numbers" in profile.js. Stats come from the night results the organiser publishes.
   Data in:
     totals { games, wins, points, fouls, violations, nights, mvp }   (numbers, missing = 0)
     nights [{ night_id, date (ISO), games, wins, points, fouls, violations, mvp (bool), xp }]  newest first
   Fouls and violations are shown as numbers only. They never change XP or anything else.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlayerProfileStats = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var HISTORY_MAX = 5;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function int0(v) { var x = parseInt(v, 10); return isNaN(x) || x < 0 ? 0 : x; }
  function num(n) { return int0(n).toLocaleString('en-GB'); }

  function dateLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // Totals as a list of { label, value }. Pure, so tests can check it.
  function totalsOf(t) {
    t = t || {};
    return [
      { label: 'Games', value: int0(t.games) },
      { label: 'Wins', value: int0(t.wins) },
      { label: 'Points', value: int0(t.points) },
      { label: 'Fouls', value: int0(t.fouls) },
      { label: 'Violations', value: int0(t.violations) },
      { label: 'MVP', value: int0(t.mvp) }
    ];
  }

  // The last HISTORY_MAX nights, newest first, with one line each.
  function historyOf(nights) {
    return (nights || []).slice(0, HISTORY_MAX).map(function (n) {
      return {
        id: String(n.night_id || ''),
        date: dateLabel(n.date),
        line: int0(n.games) + ' games · ' + int0(n.wins) + ' wins · ' + int0(n.points) + ' pts · ' +
          int0(n.fouls) + ' fouls' + (int0(n.violations) ? ' · ' + int0(n.violations) + ' violations' : ''),
        xp: int0(n.xp),
        mvp: !!n.mvp
      };
    });
  }

  function render(data) {
    var d = data || {};
    var totals = totalsOf(d.totals);
    var hist = historyOf(d.nights);
    var h = '<section aria-labelledby="stT"><h2 class="cap" id="stT">Your stats</h2>';
    h += '<div class="grid4 stats-grid">';
    totals.forEach(function (t) {
      h += '<div class="stat"><b>' + num(t.value) + '</b><span>' + esc(t.label) + '</span></div>';
    });
    h += '</div></section>';

    h += '<section class="card" aria-labelledby="hiT"><h2 class="cap" id="hiT">Recent nights</h2>';
    if (!hist.length) {
      h += '<p class="muted">Your nights show here after your first game.</p>';
    } else {
      h += '<ul class="list night-history">';
      hist.forEach(function (n) {
        h += '<li><div><b>' + esc(n.date) + '</b>' + (n.mvp ? ' <span class="badge">MVP</span>' : '') +
          '<br><span class="muted">' + esc(n.line) + '</span></div>' +
          '<span class="night-xp">+' + num(n.xp) + ' XP</span></li>';
      });
      h += '</ul>';
    }
    h += '</section>';
    return h;
  }

  return {
    render: render,
    totalsOf: totalsOf,
    historyOf: historyOf,
    HISTORY_MAX: HISTORY_MAX
  };
});
