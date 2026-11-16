/* Live feed cadence: how long to wait before the next read of the live row.
 * 2 s while a game is live (scores feel live), 10 s after a failed read, 30 s otherwise.
 * Browser: window.PlayerLiveCadence. Node: module.exports. Plain JS.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerLiveCadence = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var LIVE_MS = 2000, OFFLINE_MS = 10000, IDLE_MS = 30000;
  function delayMs(state) {
    if (state && state.offline) return OFFLINE_MS;
    return state && state.live ? LIVE_MS : IDLE_MS;
  }
  return { LIVE_MS: LIVE_MS, OFFLINE_MS: OFFLINE_MS, IDLE_MS: IDLE_MS, delayMs: delayMs };
});
