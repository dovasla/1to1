/* MVP pick (player app). Players vote once per night for the MVP. Pure rules + a small render. No network here.
   Browser: window.PlayerMvp. Node tests: mvp.test.js.
   Rules (The organiser, 15 Nov): one vote each, can't vote for self, only players who played that night.
   The organiser confirms the winner (+25 XP through the ledger, see migration-10-mvp.sql).
   Data in (from the server, all names are the night's players only):
     night { id, confirmed: boolean, winnerId: string|null }
     players [{ id, first, lastInitial }]   players who played that night
     me { id }
     myVote: candidate id or null
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PlayerMvp = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function nameOf(p) { return String(p.first || '') + ' ' + String(p.lastInitial || ''); }

  // Who the phone may vote for: the night's players, minus the voter.
  function candidatesFor(data) {
    var me = data && data.me ? data.me.id : null;
    return (data && data.players || []).filter(function (p) { return p && p.id && p.id !== me; });
  }

  // Can this vote be cast? Returns { ok, reason } so the screen can say why not.
  function checkVote(data, candidateId) {
    if (!data || !data.night) return { ok: false, reason: 'no-night' };
    if (data.night.confirmed) return { ok: false, reason: 'closed' };
    if (!data.me || !data.me.id) return { ok: false, reason: 'not-signed-in' };
    if (candidateId === data.me.id) return { ok: false, reason: 'self' };
    var played = (data.players || []).some(function (p) { return p && p.id === candidateId; });
    if (!played) return { ok: false, reason: 'not-played' };
    return { ok: true, reason: '' };
  }

  var REASON_TEXT = {
    'no-night': 'There is no run to vote for yet.',
    'closed': 'The MVP for this run is already picked.',
    'not-signed-in': 'Log in again to vote.',
    'self': 'You can’t vote for yourself.',
    'not-played': 'Only players who played in this run can get a vote.'
  };

  // Everything the card shows, worked out from the data. Pure, so tests can check it.
  function viewOf(data) {
    var night = (data && data.night) || {};
    var list = candidatesFor(data);
    var mine = data && data.myVote ? data.myVote : null;
    var status;
    if (!data || !data.night) status = 'none';
    else if (night.confirmed) status = 'confirmed';
    else if (mine) status = 'voted';
    else status = 'open';
    var winner = night.confirmed && night.winnerId
      ? (data.players || []).filter(function (p) { return p.id === night.winnerId; })[0] || null
      : null;
    return {
      status: status,
      candidates: list.map(function (p) {
        return { id: p.id, name: nameOf(p), selected: p.id === mine };
      }),
      winnerName: winner ? nameOf(winner) : '',
      headline: status === 'confirmed' ? 'MVP picked' : 'Who was MVP this run?',
      note: status === 'open' ? 'One vote each. Tap a name.'
        : status === 'voted' ? 'Vote saved. You can change it until the MVP is picked.'
        : status === 'confirmed' ? (winner ? nameOf(winner) + ' is MVP this run. +25 XP.' : 'MVP picked for this run.')
        : ''
    };
  }

  // The card. Each name is one 48px button. Nothing shows when there is no night.
  function render(data) {
    var v = viewOf(data);
    if (v.status === 'none') return '';
    var h = '<section class="mvp card" aria-labelledby="mvpT"><h2 class="cap" id="mvpT">' + esc(v.headline) + '</h2>';
    if (v.note) h += '<p class="muted" aria-live="polite">' + esc(v.note) + '</p>';
    if (v.status !== 'confirmed' && v.candidates.length) {
      h += '<ul class="mvp-list" role="list">';
      v.candidates.forEach(function (c) {
        h += '<li><button type="button" class="mvp-pick' + (c.selected ? ' on' : '') + '" data-mvp="' + esc(c.id) +
          '" aria-pressed="' + (c.selected ? 'true' : 'false') + '">' + esc(c.name) + '</button></li>';
      });
      h += '</ul>';
    } else if (v.status !== 'confirmed') {
      h += '<p class="muted">Only players who played in this run can get a vote.</p>';
    }
    h += '<p class="muted mvp-msg" data-mvp-msg role="status"></p></section>';
    return h;
  }

  // One tap picks. onVote(candidateId) is called only after checkVote passes.
  function bind(container, data, onVote) {
    var msg = container.querySelector('[data-mvp-msg]');
    container.querySelectorAll('[data-mvp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-mvp');
        var check = checkVote(data, id);
        if (!check.ok) { if (msg) msg.textContent = REASON_TEXT[check.reason] || ''; return; }
        if (onVote) onVote(id);
      });
    });
  }

  return {
    candidatesFor: candidatesFor,
    checkVote: checkVote,
    viewOf: viewOf,
    render: render,
    bind: bind,
    REASON_TEXT: REASON_TEXT
  };
});
