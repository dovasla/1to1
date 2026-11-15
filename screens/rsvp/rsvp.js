/* 1TO1 player app: "I'm in" for the next night, with the live count (N2).
   Rules and small render helpers. Browser: window.PlayerRsvp. Node tests: require('./rsvp.js').
   The server decides everything that matters (who may say in, the count, the break-even). This file only
   shows counts and the player's own status. The player side never has names: the names list is organiser-only. */
(function (root) {
  'use strict';

  var STATES = ['in', 'out'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function whole(v, lo, hi, fallback) {
    var n = Math.round(Number(v));
    return v !== null && v !== '' && isFinite(n) && n >= lo && n <= hi ? n : fallback;
  }
  function isValidState(s) { return STATES.indexOf(s) !== -1; }

  // Server answer -> the shape the screen uses. Anything missing becomes a safe empty value.
  function normalise(res) {
    if (!res || res.ok !== true) return { ok: false, reason: (res && res.reason) || 'error' };
    return {
      ok: true,
      closed: !!res.closed,
      cancelled: !!res.cancelled,
      needed: whole(res.needed, 1, 200, null),
      inCount: whole(res.inCount, 0, 999, 0),
      paidCount: whole(res.paidCount, 0, 999, 0),
      toBreakEven: whole(res.toBreakEven, 0, 999, null),
      me: isValidState(res.me) ? res.me : null
    };
  }

  // none: nothing to show (no night, or signed out). error: could not load. cancelled, closed, open.
  function phase(d) {
    if (!d) return 'none';
    if (!d.ok) return (d.reason === 'no-night' || d.reason === 'signed-out') ? 'none' : 'error';
    if (d.cancelled) return 'cancelled';
    if (d.closed) return 'closed';
    return 'open';
  }

  function countLine(d) { return d.inCount + ' in, ' + d.paidCount + ' paid'; }

  function needLine(d) {
    if (!d.needed) return '';
    if (d.inCount >= d.needed) return 'On. ' + d.needed + ' needed.';
    return 'Needs ' + d.needed + ' to run. ' + (d.needed - d.inCount) + ' more to go.';
  }

  function buttons(d) {
    return [
      { state: 'in', label: d.me === 'in' ? "You're in" : "I'm in", pressed: d.me === 'in', primary: d.me !== 'in' },
      { state: 'out', label: "Can't make it", pressed: d.me === 'out', primary: false }
    ];
  }

  // Home slot. Returns '' when there is nothing to show, so the slot leaves no gap.
  function slotHtml(d) {
    var ph = phase(d);
    if (ph === 'none') return '';
    if (ph === 'error') {
      // next-22: quiet. A failed count never blocks Home, so this is a muted line, not an alert.
      return '<p class="ph-muted rs-quiet">Who’s coming is not available yet.</p>';
    }
    // next-27: the in/paid count is shown once, in the Next night card. This card keeps the title, the note and the buttons.
    var head = '<h2 id="rs-h" class="rs-h">Who\'s coming</h2>';
    var body;
    if (ph === 'cancelled') {
      body = '<p class="rs-note">This night is cancelled.</p>';
    } else if (ph === 'closed') {
      body = '<p class="rs-note">The night has started, so changes are closed.</p>';
    } else {
      var need = needLine(d);
      body = (need ? '<p class="rs-need">' + esc(need) + '</p>' : '') +
        '<div class="rs-btns">' + buttons(d).map(function (b) {
          return '<button type="button" class="rs-btn ' + (b.primary ? 'rs-btn--in' : 'rs-btn--ghost') +
            '" data-rsvp="' + b.state + '" aria-pressed="' + b.pressed + '">' + esc(b.label) + '</button>';
        }).join('') + '</div>';
    }
    return '<section class="rs-card" aria-labelledby="rs-h">' +
      '<p class="rs-kicker">Next night</p>' + head + body +
      '</section>';
  }

  // The calls the screen makes. rpc is backend.rpc(name, body) (returns a promise of the JSON answer).
  function api(rpc) {
    function call(name, body) { return Promise.resolve().then(function () { return rpc(name, body); }); }
    return {
      set: function (token, nightId, state) {
        if (!isValidState(state)) return Promise.resolve({ ok: false, reason: 'bad-state' });
        return call('player_rsvp_set', { p_token: token, p_night: nightId, p_state: state });
      },
      list: function (token, nightId) {
        return call('player_rsvp_list', { p_token: token, p_night: nightId }).then(normalise);
      },
    };
  }

  // Puts the slot in el and keeps it fresh (every 30 s, and after each tap). opts: { api, token, nightId, poll }
  function mount(el, opts) {
    var data = null, busy = false, note = '';
    var timer = null;
    function paint() {
      if (!data) return;
      var html = slotHtml(data);
      if (note && html) html = html.replace('<div class="rs-btns">', '<p class="rs-note" role="alert">' + esc(note) + '</p><div class="rs-btns">');
      el.innerHTML = html;
    }
    function refresh() {
      return opts.api.list(opts.token, opts.nightId).then(function (d) { data = d; paint(); })
        .catch(function () { data = { ok: false, reason: 'error' }; paint(); });
    }
    el.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-rsvp],[data-rsvp-retry]') : null;
      if (!t) return;
      if (t.hasAttribute('data-rsvp-retry')) { refresh(); return; }
      var want = t.getAttribute('data-rsvp');
      if (!isValidState(want) || busy) return;
      busy = true; note = '';
      opts.api.set(opts.token, opts.nightId, want).then(function (res) {
        if (!res || res.ok !== true) throw new Error(res && res.reason || 'error');
        return refresh();
      }).catch(function () {
        note = 'Could not save that. Check the signal and try again.';
        paint();
      }).then(function () { busy = false; });
    });
    refresh();
    timer = setInterval(refresh, opts.poll || 30000);
    return { refresh: refresh, destroy: function () { clearInterval(timer); } };
  }

  var api_ = { STATES: STATES, esc: esc, isValidState: isValidState, normalise: normalise,
    phase: phase, countLine: countLine, needLine: needLine, buttons: buttons, slotHtml: slotHtml,
    api: api, mount: mount };
  root.PlayerRsvp = api_;
  if (typeof module !== 'undefined' && module.exports) module.exports = api_;
})(typeof window !== 'undefined' ? window : globalThis);
