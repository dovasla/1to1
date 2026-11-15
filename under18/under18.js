/* Under-18 box on sign-up (Fable R11). Form-only: never sent, never stored online.
   the organiser sets under-18 in the organiser at the Door.
   Usage: PlayerUnder18.line(checked) -> text to show, or '' ; PlayerUnder18.forServer(clean) -> payload without under18.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerUnder18 = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LINE = 'Under 18? Tell the organiser at the door. A parent or guardian must say yes.';
  function line(checked) { return checked ? LINE : ''; }
  // Removes every under-18 field before the sign-up call. The server never receives it.
  function forServer(clean) {
    var out = {};
    Object.keys(clean || {}).forEach(function (k) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, '') !== 'under18') out[k] = clean[k];
    });
    return out;
  }
  return { LINE: LINE, line: line, forServer: forServer };
});
