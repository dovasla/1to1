/* "Filling up" word for the next-session card (R1). Word only: no number, no names.
 * Global: window.PlayerFillingUp = { wordFor }.
 * wordFor(res): res is the server's reply with fillingUp true when enough players have said "I'm in"
 * (the organiser sets the threshold). Anything else gives '' so the card shows nothing extra.
 */
(function (root) {
  'use strict';

  function wordFor(res) {
    return res && res.ok === true && res.fillingUp === true ? 'Filling up' : '';
  }

  var api = { wordFor: wordFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerFillingUp = api;
})(typeof window !== 'undefined' ? window : globalThis);
