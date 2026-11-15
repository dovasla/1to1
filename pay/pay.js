/* Pay with card (Square) for the player app. Version 1, no webhooks.
   - Pay: opens the Square payment link in a new tab. The organiser sets the link and the amount in Square.
   - I've paid: sends a CLAIM only, signed with the 90-day sign-in token the phone keeps (no PIN needed).
     A claim is NOT a payment. The organiser sees "claims paid" in the organiser, checks Square, and confirms Paid himself.
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
    'no-night': 'Tonight is not ready yet. Try again later.',
    'no-price': 'Tonight has no price yet. Ask at the desk.',
    'already-paid': 'You are paid for tonight. See you on the night.',
    'code-first': 'Enter the session code first.',
    'square-error': 'No signal. Try again, or pay at the door.'
  };
  var POLL_MS = 5000;          // next-31 (R39): look for Paid every 5 s ...
  var POLL_LIMIT_MS = 120000;  // ... for 2 minutes after the Square link opens, then the "check again" button stays
  var NO_SIGNAL = (typeof PlayerSignal !== 'undefined') ? PlayerSignal.MESSAGE : 'No signal. Try again, or see the organiser.';
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

  // Automatic mode: config payAuto true. The server makes a Square link for this player, and only
  // the Square webhook can mark the night paid. The phone just shows what the server says.
  function autoOn(cfg) { return !!(cfg && cfg.payAuto === true); }

  // One listener for the whole page (added once). It calls the latest drawn box's check, so a re-render never stacks listeners.
  var resumeCheck = null;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && resumeCheck) resumeCheck();
  });

  function renderAuto(box, o) {
    box.innerHTML = '';
    box.classList.add('pay-box');
    var token = function () { return typeof o.token === 'function' ? o.token() : o.token; };

    var payBtn = el('button', 'btn yellow pay-btn', payLabel(o.night));
    payBtn.type = 'button';
    var paidMsg = el('p', 'pay-hint', 'Paid. You’re in.');
    paidMsg.hidden = true;
    var hint = el('p', 'pay-hint', 'Pay on Square. This updates by itself when Square confirms it.');
    var err = el('p', 'pay-err', '');
    err.setAttribute('role', 'alert');
    err.hidden = true;
    var cashBtn = el('button', 'pay-other', 'Paid another way (cash)?');
    cashBtn.type = 'button';
    var cashMsg = el('p', 'pay-hint', 'Thanks. The organiser will check and confirm it on the night.');
    cashMsg.hidden = true;
    var checkBtn = el('button', 'btn pay-check', 'I’ve paid, check again');
    checkBtn.type = 'button';
    checkBtn.hidden = true;

    box.appendChild(payBtn);
    box.appendChild(checkBtn);
    box.appendChild(paidMsg);
    box.appendChild(hint);
    box.appendChild(err);
    box.appendChild(cashBtn);
    box.appendChild(cashMsg);

    var timer = null;
    var pollUntil = 0;
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function showPaid() {
      stop();
      if (typeof o.onPaid === 'function') o.onPaid();   // next-31 (R42): Home reads the same paid answer
      payBtn.hidden = true; checkBtn.hidden = true; hint.hidden = true; cashBtn.hidden = true; cashMsg.hidden = true;
      paidMsg.hidden = false;
    }
    // Asks the server. Returns true when paid. Stops itself when the box is no longer on the page.
    function check() {
      if (!document.body.contains(box)) { stop(); return Promise.resolve(false); }
      var t = token();
      if (!t) return Promise.resolve(false);
      return o.backend.paymentStatus(t, o.nightId).then(function (r) {
        if (r && r.ok && r.paid) { showPaid(); return true; }
        return false;
      }, function () { return false; });
    }
    // next-31: look every 5 s for 2 minutes after the Square link opens; "I've paid, check again" stays under the button.
    function startPoll() {
      stop();
      pollUntil = Date.now() + POLL_LIMIT_MS;
      checkBtn.hidden = false;
      timer = setInterval(function () {
        if (Date.now() > pollUntil) { stop(); return; }
        check();
      }, POLL_MS);
    }
    checkBtn.addEventListener('click', function () {
      checkBtn.disabled = true;
      check().then(function (paid) {
        checkBtn.disabled = false;
        if (!paid) { err.textContent = 'Not confirmed yet. Give Square a minute, then tap again.'; err.hidden = false; }
      });
    });

    // One open link per player per night: a second tap re-opens the same link (no new link is made).
    var openUrl = '';
    payBtn.addEventListener('click', function () {
      err.hidden = true;
      var t = token();
      if (!t) { err.textContent = SIGNED_OUT_MSG; err.hidden = false; return; }
      if (openUrl) { window.open(openUrl, '_blank'); startPoll(); return; }
      // Open the tab inside the tap (phone browsers block a tab opened later), then send it to Square.
      var win = window.open('', '_blank');
      payBtn.disabled = true;
      o.backend.payLink(t, o.nightId).then(function (r) {
        payBtn.disabled = false;
        if (r && r.ok && r.url) {
          openUrl = r.url;
          if (win) win.location.href = r.url; else window.location.href = r.url;
          startPoll();
          return;
        }
        if (win) win.close();
        if (r && r.reason === 'already-paid') { check(); return; }
        err.textContent = REASON_MSG[r && r.reason] || 'Card payment is not working. Pay at the door.';
        err.hidden = false;
      }, function () {
        payBtn.disabled = false;
        if (win) win.close();
        err.textContent = 'Card payment is not working. Pay at the door.';
        err.hidden = false;
      });
    });

    cashBtn.addEventListener('click', function () {
      var t = token();
      if (!t) { err.textContent = SIGNED_OUT_MSG; err.hidden = false; return; }
      cashBtn.disabled = true;
      o.backend.claimPaid(t, o.nightId).then(function (r) {
        if (r && r.ok) { cashMsg.hidden = false; cashBtn.hidden = true; return; }
        cashBtn.disabled = false;
        err.textContent = REASON_MSG[r && r.reason] || NO_SIGNAL;
        err.hidden = false;
      }, function () { cashBtn.disabled = false; });
    });

    // Back from Square: look again straight away. Also one look when the box is drawn (already paid?).
    resumeCheck = function () { if (timer) check(); };
    check();
    return true;
  }

  // Per-night key: the night id plus the day of its first game, so next week's night starts fresh.
  function paidKey(o) {
    var first = o && o.night && o.night.games && o.night.games[0];
    var day = first && first.startsAt ? String(first.startsAt).slice(0, 10) : 'na';
    return '1to1-paid-' + (o && o.nightId ? o.nightId : 'tonight') + '-' + day;
  }
  function wasSent(key) {
    try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
  }
  function markSent(key) {
    try { localStorage.setItem(key, '1'); } catch (e) { /* private window: shows again after a reload */ }
  }

  // Builds the Pay + I've paid block inside box. Returns false when there is no link yet.
  function render(box, o) {
    if (box && autoOn(o.cfg)) return renderAuto(box, o);
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

    var hint = el('p', 'pay-hint', 'Pay on Square, then tap I’ve paid so the organiser knows to check.');
    var err = el('p', 'pay-err', '');
    err.setAttribute('role', 'alert');
    err.hidden = true;

    box.appendChild(payBtn);
    box.appendChild(paidBtn);
    box.appendChild(hint);
    box.appendChild(err);

    var SENT_TEXT = 'Sent. The organiser will check Square.';
    var key = paidKey(o);
    var state = 'ready'; // ready | sending | claimed
    // Remembered per night on this phone, so a reload keeps "Sent" (the server is still the real record).
    if (key && wasSent(key)) {
      state = 'claimed';
      paidBtn.hidden = true;
      hint.textContent = SENT_TEXT;
    }
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
          hint.textContent = SENT_TEXT;
          if (key) markSent(key);
          return;
        }
        state = 'ready';
        paidBtn.disabled = false;
        err.textContent = REASON_MSG[r && r.reason] || NO_SIGNAL;
        err.hidden = false;
      }).catch(function () {
        state = 'ready';
        paidBtn.disabled = false;
        err.textContent = NO_SIGNAL;
        err.hidden = false;
      });
    });
    return true;
  }

  return { payUrl: payUrl, render: render, payLabel: payLabel, autoOn: autoOn, REASON_MSG: REASON_MSG,
    sentKey: paidKey, wasSent: wasSent, markSent: markSent };
});
