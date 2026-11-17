/* Player app: the run-state line on Home (P12). Pure logic, no DOM, no network.
   States: 'upcoming' | 'checkin' | 'checking' | 'live' | 'over'.
   - The phone clock only decides 'upcoming' vs 'checkin' (the check-in window opens 60 minutes before the start).
   - 'live' and 'over' come from the server's run status (player_run_status): serverState. The phone clock never sets them.
   - After the start, with no server answer yet, the state is 'checking' (never 'live' from the clock alone).
   Browser: window.PlayerRunState. Node: module.exports.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerRunState = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var CHECKIN_LEAD_MS = 60 * 60 * 1000;   // check-in opens 60 minutes before the start
  // closed: the organiser pressed End run (the night row carries run.status closed).
  var OVER = { ended: true, cancelled: true, 'called-off': true, closed: true };

  var LABEL = {
    upcoming: 'Run is coming up',
    checkin: 'Check-in open',
    checking: 'Checking the run…',
    live: 'Run is live',
    over: 'Run is over'
  };

  // startsAt: ISO string (with Z) or epoch ms. now: epoch ms. serverState: the player_run_status state, or '' when unknown.
  function stateFor(startsAt, now, serverState) {
    var server = String(serverState || '');
    if (OVER[server]) return 'over';
    if (server === 'live') return 'live';
    var start = typeof startsAt === 'number' ? startsAt : Date.parse(String(startsAt || ''));
    if (isNaN(start)) return null;
    if (now < start - CHECKIN_LEAD_MS) return 'upcoming';
    if (now < start) return 'checkin';
    return 'checking';
  }

  function labelFor(state) {
    return LABEL[state] || '';
  }

  // The published run status, the same value Live reads (NightShape.runOn). Pure: takes the night object.
  function statusOf(night) {
    var f = night && (night.fields || night);
    if (!f) return '';
    if (f.cancelled === true) return 'cancelled';
    return String((f.run && f.run.status) || '');
  }

  // Home's run state. liveNow is NightShape.runOn(night, now), the exact flag the Live tab uses, so Home and Live agree.
  // Over comes from the published status only. Otherwise the phone clock decides upcoming or check-in.
  function homeState(startsAt, now, liveNow, runStatus) {
    if (OVER[String(runStatus || '')]) return 'over';
    if (liveNow) return 'live';
    return stateFor(startsAt, now, '');
  }

  // Check-in button shows only in the window (60 minutes before the start, up to the start) and never after the server says the run is over.
  function checkinOpen(startsAt, now, serverState) {
    return stateFor(startsAt, now, serverState) === 'checkin';
  }

  return { CHECKIN_LEAD_MS: CHECKIN_LEAD_MS, stateFor: stateFor, labelFor: labelFor, checkinOpen: checkinOpen,
    statusOf: statusOf, homeState: homeState };
});
