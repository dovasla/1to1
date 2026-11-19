/* Player app: "I'm here" at the hall (D3, R18). Plain JS, no storage, no network except the rpc passed in.
   Calls player_check_in(p_token, p_night, p_code) (migration-25, package D1).
   The code only checks the player in at the door. It never hides the run, "I'm in", Pay or the live score.
   Global: window.PlayerCheckIn. Node: module.exports (tests: node checkin.test.js).
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerCheckIn = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CODE_LEN = 4;
  var MSG = {
    'wrong-code': 'That code isn’t right. Check the organiser’s screen.',
    'too-early': 'No session is open yet. Ask the organiser to start it.',
    'no-session': 'No session is open yet. Ask the organiser to start it.',
    'run-closed': 'This session has ended.',
    'too-many-tries': 'Too many tries. Wait 10 minutes or see the organiser.',
    'short-code': 'Type all 4 digits.',
    'busy': 'No signal. Try again, or see the organiser.'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Keeps digits only, up to 4.
  function cleanCode(v) { return String(v == null ? '' : v).replace(/\D/g, '').slice(0, CODE_LEN); }
  // The QR at the door opens the app with ?code=1234. Anything else returns ''.
  function codeFromSearch(search) {
    var m = /[?&]code=(\d{4})(?=&|$)/.exec(String(search || ''));
    return m ? m[1] : '';
  }
  function messageFor(reason) { return MSG[reason] || MSG.busy; }

  // Resolves { ok: true } or { ok: false, reason }. Never rejects.
  function check(rpc, token, night, code) {
    var c = cleanCode(code);
    if (c.length !== CODE_LEN) return Promise.resolve({ ok: false, reason: 'short-code' });
    return Promise.resolve().then(function () {
      return rpc('player_check_in', { p_token: token, p_night: night, p_code: c });
    }).then(function (r) {
      if (r && r.ok === true) return { ok: true };
      return { ok: false, reason: (r && r.reason) || 'busy' };
    }, function () { return { ok: false, reason: 'busy' }; });
  }

  // state: { phase: 'enter' | 'sending' | 'done', code: '12', reason: '' }
  function html(state) {
    var s = state || { phase: 'enter', code: '' };
    if (s.phase === 'done') {
      return '<div class="ci-card ci-done"><h2>Your spot</h2><p class="ci-muted">Checked in. See you on court.</p></div>';
    }
    var code = cleanCode(s.code);
    var boxes = '';
    for (var i = 0; i < CODE_LEN; i++) {
      boxes += '<span class="ci-box' + (i < code.length ? ' ci-full' : '') + '" aria-hidden="true">' + esc(code.charAt(i)) + '</span>';
    }
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(function (k) {
      return '<button type="button" class="ci-key" data-ci-key="' + k + '">' + k + '</button>';
    }).join('');
    var busy = s.phase === 'sending';
    var err = s.reason ? '<p class="ci-err" role="alert">' + esc(messageFor(s.reason)) + '</p>' : '<p class="ci-err" role="status"></p>';
    return '' +
      '<div class="ci-card" aria-busy="' + (busy ? 'true' : 'false') + '">' +
        '<h2>Enter code</h2>' +
        '<p class="ci-muted">It’s on the organiser’s screen.</p>' +
        '<div class="ci-digits" aria-label="Code, ' + code.length + ' of 4 digits">' + boxes + '</div>' +
        '<div class="ci-pad">' + keys +
          '<button type="button" class="ci-key ci-back" data-ci-key="back">Back</button>' +
          '<button type="button" class="ci-key" data-ci-key="0">0</button>' +
          '<button type="button" class="ci-key ci-go" data-ci-key="go"' + (busy || code.length !== CODE_LEN ? ' disabled' : '') + '>Check in</button>' +
        '</div>' +
        err +
      '</div>';
  }

  // Puts the card in el. opts: { rpc, token, night, code (from the QR, optional) }.
  function mount(el, opts) {
    var o = opts || {};
    var state = { phase: 'enter', code: cleanCode(o.code), reason: '' };
    function paint() { el.innerHTML = html(state); }
    function press(key) {
      if (state.phase === 'sending' || state.phase === 'done') return;
      if (/^\d$/.test(key)) {
        if (state.code.length < CODE_LEN) state.code += key;
        state.reason = '';
        paint();
      } else if (key === 'back') {
        state.code = state.code.slice(0, -1);
        state.reason = '';
        paint();
      } else if (key === 'go') {
        state.phase = 'sending';
        state.reason = '';
        paint();
        check(o.rpc, o.token, o.night, state.code).then(function (r) {
          if (r.ok) { state.phase = 'done'; } else { state.phase = 'enter'; state.reason = r.reason; state.code = ''; }
          paint();
          if (r.ok && typeof o.onDone === 'function') o.onDone();
        });
      }
    }
    function onClick(e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-ci-key]') : null;
      if (!b || !el.contains(b)) return;
      press(b.getAttribute('data-ci-key'));
    }
    el.addEventListener('click', onClick);
    paint();
    return {
      destroy: function () { el.removeEventListener('click', onClick); el.innerHTML = ''; },
      state: function () { return { phase: state.phase, code: state.code, reason: state.reason }; }
    };
  }

  return {
    CODE_LEN: CODE_LEN, MSG: MSG, cleanCode: cleanCode, codeFromSearch: codeFromSearch,
    messageFor: messageFor, check: check, html: html, mount: mount
  };
});
