/* Pay-first player flow (Home). Owner: Pay-first thread. Plain JS, no framework.
   Rule (The organiser): players cannot play without paying. Pay is the first, biggest action on Home.

   States (from stateOf):
     'none' : no night (or the night is cancelled, the app already hides those). Renders nothing.
     'due'  : "Pay now" + amount + Pay button. Waiting to pay. Teams do not come out for this player.
     'sent' : this phone sent "I've paid" for tonight. Still waiting to pay, the organiser checks Square.
     'paid' : "You're in". Paid by the server (Square webhook, or the organiser's confirm). Joins the night.

   Usage:
     var pf = PayFirst.create({ backend: be, token: readToken, nightId: NIGHT_ID,
                                cfg: window.PLAYER_APP_CONFIG, storage: localStorage,
                                onChange: function () { S.home.update(homeData(Date.now())); } });
     pf.bind(homeEl);          // one delegated click listener on the Home container (add once)
     pf.html(S.night);         // HTML for the block, put it first on Home
     pf.start();               // one look at the server now (paid already?), polls while waiting
     pf.destroy();             // stop timers and listeners

   Auto mode (cfg.payAuto === true): the Pay button asks the server for a Square link for this player.
   Only the Square webhook sets paid. Manual mode (payAuto false): a plain Square link, then "I've paid"
   sends a CLAIM only (never a payment). "I've paid" is remembered on this phone per night, so it still
   shows after a reload.
   Global: window.PayFirst. Node: module.exports (for tests).
*/
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PayFirst = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var POLL_WAIT_MS = 15000;    // after Pay opened Square (auto mode): look every 15 s
  var POLL_SENT_MS = 60000;    // after "I've paid" (manual mode): look every minute, only for a confirm
  var KEY_PREFIX = '1to1-paid-';   // same key scheme as pay/pay.js in player-app-src-3 (night id + day of first game)

  var REASON_MSG = {
    'code-first': 'Join the session first. Enter the code on the organiser’s screen.',
    'run-closed': 'This session has ended.',
    'no-session': 'No session is open yet. Ask the organiser to start it.',
    'signed-out': 'Your sign-in has run out. Log in again, then try again.',
    'not-approved': 'Ask at the desk.',
    'no-night': 'Tonight is not ready yet. Try again later.',
    'no-price': 'Tonight has no price yet. Ask at the desk.',
    'square-error': 'Card payment isn’t working. Pay cash at the door.'
  };
  var DEFAULT_ERR = 'Could not send. Check your connection and try again.';
  var CODE_FIRST_MSG = 'Join the session first. Enter the 4-digit code on the organiser’s screen.';   // R43
  var PAID_LINE = 'Paid. You’re in.';   // R42/R43 confirmed-payment line
  var PAY_LINK_ERR = 'Card payment isn’t working. Pay cash at the door.';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Only a real https link counts. Empty or placeholder text means "no link yet".
  function payUrl(cfg) {
    var u = String((cfg && cfg.squarePayLink) || '').trim();
    return /^https:\/\/\S+$/.test(u) ? u : '';
  }

  // Automatic Square pay: config payAuto true. Off by default until the Square sandbox test passes.
  function autoOn(cfg) { return !!(cfg && cfg.payAuto === true); }

  // Pure. night: tonight payload or null. paid: server says paid. sent: this phone sent "I've paid".
  function stateOf(night, paid, sent) {
    if (!night || typeof night !== 'object' || night.cancelled) return 'none';
    if (paid) return 'paid';
    return sent ? 'sent' : 'due';
  }

  // Per-night key: the night id plus the day of its first game, so next week's night starts fresh.
  function sentKey(nightId, night) {
    var first = night && night.games && night.games[0];
    var day = first && first.startsAt ? String(first.startsAt).slice(0, 10) : 'na';
    return KEY_PREFIX + (nightId || 'tonight') + '-' + day;
  }
  // Storage can be missing, blocked or throw (private window). Then the claim is simply not remembered.
  function wasSent(storage, key) {
    try { return !!storage && !!key && storage.getItem(key) === '1'; } catch (e) { return false; }
  }
  function markSent(storage, key) {
    try { if (storage && key) storage.setItem(key, '1'); } catch (e) { /* not remembered, shows again after reload */ }
  }

  function create(o) {
    o = o || {};
    var storage = o.storage || null;
    var st = {
      key: '',         // sentKey for the night on screen, set by model(night)
      paid: false,
      sent: false,
      opened: false,   // auto mode: Square opened, waiting for the webhook
      busy: false,
      err: '',
      timer: null,
      ms: 0,
      container: null
    };

    function tokenOf() { return typeof o.token === 'function' ? o.token() : o.token; }
    function emit() { if (typeof o.onChange === 'function') o.onChange(); }
    function haveBackend(fn) { return !!(o.backend && typeof o.backend[fn] === 'function'); }

    function stop() { if (st.timer) { clearInterval(st.timer); st.timer = null; st.ms = 0; } }
    function syncTimer() {
      if (st.paid || !(st.opened || st.sent)) { stop(); return; }
      var want = st.opened ? POLL_WAIT_MS : POLL_SENT_MS;
      if (st.timer && st.ms === want) return;
      stop();
      st.ms = want;
      st.timer = setInterval(check, want);
    }

    // Asks the server once. Only the server can say paid. Returns a promise of true/false.
    function check() {
      var t = tokenOf();
      if (!t || !haveBackend('paymentStatus') || !o.nightId) return Promise.resolve(false);
      return o.backend.paymentStatus(t, o.nightId).then(function (r) {
        if (r && r.ok && r.paid) {
          st.paid = true; st.opened = false; st.err = '';
          stop();
          emit();
          return true;
        }
        return false;
      }, function () { return false; });
    }

    // Manual mode "I've paid" (auto mode: "I paid another way"). A claim only, the organiser checks Square.
    function claim() {
      if (st.busy || st.sent || st.paid) return Promise.resolve();
      var t = tokenOf();
      if (!t) { st.err = REASON_MSG['signed-out']; emit(); return Promise.resolve(); }
      if (!haveBackend('claimPaid')) { st.err = DEFAULT_ERR; emit(); return Promise.resolve(); }
      st.busy = true; st.err = '';
      emit();
      return o.backend.claimPaid(t, o.nightId).then(function (r) {
        st.busy = false;
        if (r && r.ok) {
          st.sent = true;
          markSent(storage, st.key);
          syncTimer();
        } else if (r && r.reason === 'already-paid') {
          return check().then(function () { emit(); });
        } else {
          st.err = REASON_MSG[r && r.reason] || DEFAULT_ERR;
        }
        emit();
      }, function () {
        st.busy = false;
        st.err = DEFAULT_ERR;
        emit();
      });
    }

    // Auto mode Pay. Opens the tab inside the tap (phone browsers block a tab opened later), then sends it to Square.
    function payAuto() {
      if (st.busy || st.paid) return Promise.resolve();
      // R43: code first. Pay is only for a player the door has accepted tonight.
      if (typeof o.checkedIn === 'function' && !o.checkedIn()) {
        st.err = CODE_FIRST_MSG; emit(); return Promise.resolve();
      }
      var t = tokenOf();
      if (!t) { st.err = REASON_MSG['signed-out']; emit(); return Promise.resolve(); }
      if (!haveBackend('payLink')) { st.err = PAY_LINK_ERR; emit(); return Promise.resolve(); }
      var win = root.open ? root.open('', '_blank') : null;
      st.busy = true; st.err = '';
      emit();
      return o.backend.payLink(t, o.nightId).then(function (r) {
        st.busy = false;
        if (r && r.ok && r.url) {
          if (win) win.location.href = r.url; else root.location.href = r.url;
          st.opened = true;
          syncTimer();
        } else {
          if (win) win.close();
          if (r && r.reason === 'already-paid') return check().then(function () { emit(); });
          st.err = REASON_MSG[r && r.reason] || PAY_LINK_ERR;
        }
        emit();
      }, function () {
        st.busy = false;
        if (win) win.close();
        st.err = 'Could not make your payment link. Check your connection and try again.';
        emit();
      });
    }

    function onClick(e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-pf]') : null;
      if (!b || !st.container || !st.container.contains(b)) return;
      var action = b.getAttribute('data-pf');
      if (action === 'pay') payAuto();
      else if (action === 'claim') claim();
    }

    function onVisible() {
      if (root.document && root.document.visibilityState === 'visible' && !st.paid && (st.opened || st.sent)) check();
    }

    // Re-reads the "I've paid" memory whenever the night on screen changes.
    function refresh(night) {
      var k = sentKey(o.nightId, night);
      if (k !== st.key) { st.key = k; st.sent = wasSent(storage, k); }
    }

    function model(night) {
      refresh(night);
      var state = stateOf(night, st.paid, st.sent);
      return {
        state: state,
        amount: night && night.price ? String(night.price) : '',
        link: payUrl(o.cfg),
        auto: autoOn(o.cfg),
        busy: st.busy,
        err: st.err,
        nightId: o.nightId || ''
      };
    }

    function pill(text, cls) {
      return '<div class="pf-top"><span class="pf-pill ' + cls + '">' + esc(text) + '</span></div>';
    }

    function payButtonHtml(m) {
      if (!m.amount) return '';
      var label = 'Pay ' + esc(m.amount) + ' on Square';
      if (m.auto) {
        return '<button class="pf-btn" type="button" data-pf="pay"' + (m.busy ? ' disabled' : '') + '>' + label + '</button>';
      }
      if (m.link) {
        return '<a class="pf-btn" href="' + esc(m.link) + '" target="_blank" rel="noopener">' + label + '</a>';
      }
      return '';
    }

    function html(night) {
      var m = model(night);
      if (m.state === 'none') return '';
      if (m.state === 'paid') {
        return '<section class="pf pf--paid" aria-label="You are in">' +
          pill('Paid', 'pf-pill--paid') +
          '<h2 class="pf-head">' + PAID_LINE + '</h2>' +
          '<p class="pf-text">You are paid for tonight. Teams come out on the night.</p>' +
          '</section>';
      }
      var parts = [
        '<section class="pf pf--' + m.state + '" aria-label="Pay to play">',
        pill('Waiting to pay', 'pf-pill--due'),
        '<h2 class="pf-head">Pay now</h2>'
      ];
      if (m.amount) {
        parts.push('<p class="pf-amount">' + esc(m.amount) + '</p>');
        parts.push('<p class="pf-text">Pay before you can be picked for a team tonight.</p>');
      } else {
        parts.push('<p class="pf-text">Ask at the desk for tonight’s price.</p>');
      }
      if (m.state === 'sent') {
        parts.push('<p class="pf-note">Sent. The organiser will check Square and confirm you on the night.</p>');
      }
      parts.push(payButtonHtml(m));
      if (m.state === 'due') {
        var label = m.auto ? 'I paid another way' : 'I’ve paid';
        parts.push('<button class="pf-btn pf-btn--ghost" type="button" data-pf="claim"' + (m.busy ? ' disabled' : '') + '>' + label + '</button>');
        if (!m.auto && m.amount && m.link) parts.push('<p class="pf-note">Pay on Square, then tap I’ve paid.</p>');
      }
      if (m.err) parts.push('<p class="pf-err" role="alert">' + esc(m.err) + '</p>');
      parts.push('</section>');
      return parts.join('');
    }

    return {
      model: model,
      html: html,
      // The one Pay action (Home's Pay button calls this). Same rules as the data-pf button.
      payNow: function () { return payAuto(); },
      bind: function (container) {
        if (st.container) return;
        st.container = container;
        container.addEventListener('click', onClick);
      },
      start: function () {
        check().then(function () { syncTimer(); });
        if (root.document && root.document.addEventListener) root.document.addEventListener('visibilitychange', onVisible);
      },
      destroy: function () {
        stop();
        if (st.container) st.container.removeEventListener('click', onClick);
        st.container = null;
        if (root.document && root.document.removeEventListener) root.document.removeEventListener('visibilitychange', onVisible);
      },
      // For tests and the app: read the flags without changing them.
      _state: function () { return { paid: st.paid, sent: st.sent, opened: st.opened, busy: st.busy, err: st.err, polling: !!st.timer, ms: st.ms }; }
    };
  }

  return {
    create: create,
    stateOf: stateOf,
    payUrl: payUrl,
    autoOn: autoOn,
    esc: esc,
    sentKey: sentKey,
    wasSent: wasSent,
    markSent: markSent,
    REASON_MSG: REASON_MSG,
    CODE_FIRST_MSG: CODE_FIRST_MSG,
    PAID_LINE: PAID_LINE,
    POLL_WAIT_MS: POLL_WAIT_MS,
    POLL_SENT_MS: POLL_SENT_MS,
    KEY_PREFIX: KEY_PREFIX
  };
});
