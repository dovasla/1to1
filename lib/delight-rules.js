/* Delight rules (pure, no DOM): milestone lines, streak nudge, bib-number reveal, tap and score easter eggs.
   Browser: window.PlayerDelights. Node tests: tests/delight-rules.test.js.
*/
(function (root) {
  'use strict';

  // D6: milestone lines by nights played (1st, 10th, 25th, 50th).
  var MILESTONES = {
    1: 'Welcome to the run.',
    10: 'Double digits. You’re a regular.',
    25: 'Part of the furniture.',
    50: 'Half a century of nights.'
  };

  function milestoneLine(nights) {
    return Object.prototype.hasOwnProperty.call(MILESTONES, nights) ? MILESTONES[nights] : null;
  }

  // D5: streak flame. weeks = consecutive weeks played. playsTonight = a run is on today.
  function streakNudge(weeks, playsTonight) {
    var w = Math.max(0, Math.floor(Number(weeks) || 0));
    var out = { show: w > 0, weeks: w, text: '', nudge: '' };
    if (!out.show) return out;
    out.text = w + '-week streak';
    if (playsTonight) out.nudge = 'Play tonight to keep your ' + w + '-week streak.';
    return out;
  }

  // D3: game-end wave. Only when the feed has a game-end event; otherwise skip (returns null).
  function gameEndBanner(feed, teams) {
    if (!Array.isArray(feed)) return null;
    var end = null;
    for (var i = feed.length - 1; i >= 0; i--) {
      if (feed[i] && feed[i].type === 'game_end') { end = feed[i]; break; }
    }
    if (!end || !end.winner) return null;
    var a = end.scoreA, b = end.scoreB;
    var name = (teams && teams[end.winner]) ? teams[end.winner] : String(end.winner);
    return { winner: end.winner, text: name.toUpperCase() + ' WIN ' + a + '-' + b };
  }

  // D7: bib number flips in on first check-in only.
  function shouldRevealBib(prevState, nowState) {
    return !prevState || !prevState.checkedIn ? !!(nowState && nowState.checkedIn) : false;
  }

  // D12a: tap the loading ball 3 times within 1.2s to spin it. Returns the new state.
  function ballTap(state, t) {
    var s = state || { count: 0, last: -Infinity };
    var gap = t - s.last;
    var count = gap <= 1200 ? s.count + 1 : 1;
    if (count >= 3) return { count: 0, last: t, spin: true };
    return { count: count, last: t, spin: false };
  }

  // D12b: scoring exactly 21 in a game gives a hidden Blackjack badge.
  function blackjackBadge(points) {
    return Number(points) === 21 ? { id: 'blackjack', label: 'Blackjack' } : null;
  }

  var api = {
    MILESTONES: MILESTONES,
    milestoneLine: milestoneLine,
    streakNudge: streakNudge,
    gameEndBanner: gameEndBanner,
    shouldRevealBib: shouldRevealBib,
    ballTap: ballTap,
    blackjackBadge: blackjackBadge
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerDelights = api;
})(typeof window !== 'undefined' ? window : globalThis);
