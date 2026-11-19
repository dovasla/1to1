/* D5 streak flame and D6 milestone line for Home. Pure: returns HTML strings, no storage.
   Input d: { nightsPlayed, streakWeeks, runOn } from the Home data. Missing fields show nothing (safe).
   Browser: window.PlayerHomeDelights.html(d). Node test: tests/delight-rules.test.js. */
(function (root) {
  'use strict';

  var D = (typeof require === 'function') ? require('./delight-rules.js') : root.PlayerDelights;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Returns '' when there is nothing to show.
  function html(d) {
    d = d || {};
    var out = '';
    var s = D.streakNudge(d.streakWeeks, !!d.runOn);
    if (s.show) {
      out += '<p class="ph-note dl-streak"><b>' + esc(s.text) + '</b>' +
        (s.nudge ? ' <span>' + esc(s.nudge) + '</span>' : '') + '</p>';
    }
    var m = D.milestoneLine(Number(d.nightsPlayed));
    // Not on a run that is over: "Welcome" under "Run is over" reads as stale.
    if (m && !d.runOver) out += '<p class="ph-note dl-milestone"><b>' + esc(m) + '</b></p>';
    return out;
  }

  var api = { html: html };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerHomeDelights = api;
})(typeof window !== 'undefined' ? window : globalThis);
