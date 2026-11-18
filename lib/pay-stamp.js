/* D2 ticket punch: when the night is confirmed paid, the bib card stamps PAID, a hole punches the corner, and it buzzes.
   Browser: window.PlayerPayStamp.stamp(cardEl). Only confirmed payment stamps (not a claim). Node test: tests/delight-rules.test.js.
   Motion goes through the classes in lib/delights.css (dl-stamp), so reduced motion and low effects turn it off. */
(function (root) {
  'use strict';

  function buzz(ms) {
    try {
      if (root.navigator && typeof root.navigator.vibrate === 'function') root.navigator.vibrate(ms || 20);
    } catch (e) { /* no vibration here */ }
  }

  // Adds the stamp once. Returns true if it was added now.
  function stamp(card) {
    if (!card || card.querySelector && card.querySelector('.dl-paid-stamp')) return false;
    var doc = card.ownerDocument || (root.document);
    var st = doc.createElement('span');
    st.className = 'dl-paid-stamp dl-stamp';
    st.setAttribute('aria-label', 'Paid');
    st.textContent = 'PAID';
    var hole = doc.createElement('span');
    hole.className = 'dl-punch';
    hole.setAttribute('aria-hidden', 'true');
    card.appendChild(hole);
    card.appendChild(st);
    buzz(20);
    return true;
  }

  var api = { stamp: stamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerPayStamp = api;
})(typeof window !== 'undefined' ? window : globalThis);
