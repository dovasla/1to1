/* Lineup timing (R168): "Who you play with" shows from the published night, one minute before each game.
   No published teams, or more than a minute to go, means nothing about other players.
   Loads in the browser as window.LineupGate, and in node via require(). Pure: the clock is passed in. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LineupGate = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var LEAD_MS = 60000;

  function published(game) {
    var teams = (game && game.teams) || [];
    return teams.some(function (t) { return (t.players || []).length > 0; });
  }

  // True when the lineup may be shown at nowMs. A game with a start time uses it. A game without one (R177)
  // uses the run start, and only when the organiser has flagged it next.
  function shows(game, nowMs, runStartMs) {
    if (!game || !published(game)) return false;
    var start;
    if (game.timed === false || isNaN(Date.parse(game.startsAt))) {
      if (game.next !== true || isNaN(runStartMs)) return false;
      start = runStartMs;
    } else {
      start = Date.parse(game.startsAt);
    }
    return start - nowMs <= LEAD_MS;
  }

  return { LEAD_MS: LEAD_MS, published: published, shows: shows };
});
