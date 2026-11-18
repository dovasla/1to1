/* D11 seasonal skins: one data-season class on <html>, picked from the date. Pure except apply().
   winter: December (snow court lines). halloween: 20 to 31 October (orange court). Otherwise none.
   Season start (tip-off on Home) is not set here: it needs the season's first night date from the server.
   Browser: window.PlayerSeasonal.apply(document, new Date()). Node test: tests/seasonal.test.js. */
(function (root) {
  'use strict';

  function seasonFor(date) {
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    var m = d.getMonth(); // 0 = January
    var day = d.getDate();
    if (m === 11) return 'winter';
    if (m === 9 && day >= 20) return 'halloween';
    return null;
  }

  function apply(doc, date) {
    var root = doc && doc.documentElement;
    if (!root) return null;
    var s = seasonFor(date || new Date());
    if (s) root.setAttribute('data-season', s); else root.removeAttribute('data-season');
    return s;
  }

  var api = { seasonFor: seasonFor, apply: apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerSeasonal = api;
})(typeof window !== 'undefined' ? window : globalThis);
