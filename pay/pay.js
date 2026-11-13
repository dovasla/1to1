/* Pay with card (Square) for the player app. Version 1, no webhooks.
   - Pay: opens the Square payment link in a new tab. Jord sets the link and the amount in Square.
   - I've paid: sends a CLAIM only, signed with the 90-day sign-in token the phone keeps (no PIN needed).
     A claim is NOT a payment. Jord sees "claims paid" in the organiser, checks Square, and confirms Paid himself.
   - No link in config (squarePayLink empty): render() does nothing and the page keeps its cash/Square text.
   Usage: PlayerPay.render(box, { cfg, backend, nightId, night, token })
   Global: window.PlayerPay. Node: module.exports (for tests).
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerPay = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REASON_MSG = {
    'signed-out': 'Your sign-in has run out. Log in again, then tap I’ve paid.',
    'not-approved': 'Ask at the desk.',
    'no-night': 'Tonight is not ready yet. Try again later.'
  };
  var SIGNED_OUT_MSG = 'Your sign-in has run out. Log in again, then tap I’ve paid.';

  // Only a real https link is used. Anything else (empty, placeholder text) means "no button yet".
  function payUrl(cfg) {
    var u = String((cfg && cfg.squarePayLink) || '').trim();
    return /^https:\/\/\S+$/.test(u) ? u : '';
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function payLabel(night) {
    return night && night.price ? 'Pay ' + night.price + ' on Square' : 'Pay on Square';
  }

  // Builds the Pay + I've paid block inside box. Returns false when there is no link yet.
  function render(box, o) {
    var url = payUrl(o.cfg);
    if (!box || !url) return false;
    box.innerHTML = '';
    box.classList.add('pay-box');

    var payBtn = el('a', 'btn yellow pay-btn', payLabel(o.night));
    payBtn.href = url;
    payBtn.target = '_blank';
    payBtn.rel = 'noopener';

    var paidBtn = el('button', 'btn pay-paid', 'I’ve paid');
    paidBtn.type = 'button';

    var hint = el('p', 'pay-hint', 'Pay on Square, then tap I’ve paid so Jord knows to check.');
    var err = el('p', 'pay-err', '');
    err.setAttribute('role', 'alert');
    err.hidden = true;

    box.appendChild(payBtn);
    box.appendChild(paidBtn);
    box.appendChild(hint);
    box.appendChild(err);

    var state = 'ready'; // ready | sending | claimed
    paidBtn.addEventListener('click', function () {
      if (state !== 'ready') return;
      err.hidden = true;
      var token = typeof o.token === 'function' ? o.token() : o.token;
      if (!token) { err.textContent = SIGNED_OUT_MSG; err.hidden = false; return; }
      state = 'sending';
      paidBtn.disabled = true;
      o.backend.claimPaid(token, o.nightId).then(function (r) {
        if (r && r.ok) {
          state = 'claimed';
          paidBtn.hidden = true;
          hint.textContent = 'Thanks. Jord will check Square and confirm your payment on the night.';
          return;
        }
        state = 'ready';
        paidBtn.disabled = false;
        err.textContent = REASON_MSG[r && r.reason] || 'Could not send. Check your connection and try again.';
        err.hidden = false;
      }).catch(function () {
        state = 'ready';
        paidBtn.disabled = false;
        err.textContent = 'Could not send. Check your connection and try again.';
        err.hidden = false;
      });
    });
    return true;
  }

  return { payUrl: payUrl, render: render, payLabel: payLabel, REASON_MSG: REASON_MSG };
});
