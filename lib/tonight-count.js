/* Player Home: "Who's in tonight" count. Pure logic, no DOM, no network.
 * Global: window.PlayerTonightCount = { countsFrom, labelFor }.
 * Names are never kept or shown here. Only the counts leave this file.
 * countsFrom(res): res is the player_night_counts reply (migration-31, count only, no names).
 * Anything else gives { ok: false }. Only the six known keys are kept.
 * toBreakEven comes from the server: null when the night has no break-even number, never below 0.
 */
(function (root) {
  'use strict';

  function count(v) {
    var n = Number(v);
    return isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }

  function countsFrom(res) {
    if (!res || res.ok !== true) return { ok: false };
    var be = res.toBreakEven;
    return {
      ok: true,
      inCount: count(res.inCount),
      paidCount: count(res.paidCount),
      toBreakEven: be == null ? null : count(be),
      cancelled: res.cancelled === true,
      closed: res.closed === true
    };
  }

  // Short words for the Home card. Pure, so the tests can pin the wording.
  function labelFor(c) {
    if (!c || !c.ok) return 'Not available right now';
    if (c.cancelled) return 'Tonight is cancelled';
    if (c.closed) return 'Tonight has started';
    if (c.inCount === 0) return 'Nobody yet. Be the first in.';
    return c.inCount === 1 ? '1 player is in' : c.inCount + ' players are in';
  }

  var api = { countsFrom: countsFrom, labelFor: labelFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerTonightCount = api;
})(typeof window !== 'undefined' ? window : globalThis);
