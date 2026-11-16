/* My account: the More tab panel, the four sheets, the privacy page (player app, T1). Plain JS, reads only.
 * Browser: window.PlayerMyAccount. Node tests: my-account.test.js.
 * The caller calls the server (see HOOKS.md) and passes the result to messageFor(). Nothing here talks to the network.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerMyAccount = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var ACTIONS = [
    { id: 'pin', label: 'Change PIN' },
    { id: 'data', label: 'Download my data' },
    { id: 'delete', label: 'Delete account' }
  ];

  // The More tab panel: four plain rows, no chevrons.
  function buildPanel() {
    return '<section class="ma-panel" aria-label="My account">' +
      '<h2 class="ma-title">My account</h2>' +
      '<ul class="ma-list">' +
      ACTIONS.map(function (a) {
        return '<li><button type="button" class="ma-row' + (a.id === 'delete' ? ' is-danger' : '') + '" data-ma-action="' + a.id + '">' +
          esc(a.label) + '</button></li>';
      }).join('') +
      '</ul>' +
      '<p class="ma-link"><button type="button" class="ma-text" data-ma-action="privacy">Privacy</button></p>' +
      '</section>';
  }

  // Sheets (72h: no name change, names are read-only). kind: 'pin' | 'delete-1' | 'delete-2' | 'privacy'.
  function buildSheet(kind, opts) {
    opts = opts || {};
    var err = opts.error ? '<p class="ma-error" role="alert">' + esc(opts.error) + '</p>' : '';
    if (kind === 'pin') {
      return '<form class="ma-sheet" data-ma-form="pin"><h2 class="ma-title">Change PIN</h2>' + err +
        '<label class="ma-field">Current PIN<input name="old_pin" inputmode="numeric" maxlength="4" autocomplete="off" required></label>' +
        '<label class="ma-field">New PIN<input name="new_pin" inputmode="numeric" maxlength="4" autocomplete="off" required></label>' +
        '<button type="submit" class="ma-btn">Save PIN</button></form>';
    }
    if (kind === 'delete-1') {
      return '<form class="ma-sheet" data-ma-form="delete-1"><h2 class="ma-title">Delete account?</h2>' +
        '<p class="ma-hint">Your name, PIN, stats and history go. Payments stay, with no name on them.</p>' + err +
        '<label class="ma-field">Your PIN<input name="pin" inputmode="numeric" maxlength="4" autocomplete="off" required></label>' +
        '<button type="submit" class="ma-btn is-danger">Continue</button></form>';
    }
    if (kind === 'delete-2') {
      return '<form class="ma-sheet" data-ma-form="delete-2"><h2 class="ma-title">Are you sure?</h2>' +
        '<p class="ma-hint">This cannot be undone.</p>' + err +
        '<button type="submit" class="ma-btn is-danger">Delete my account</button>' +
        '<button type="button" class="ma-btn is-quiet" data-ma-action="cancel">Keep my account</button></form>';
    }
    if (kind === 'privacy') {
      return '<section class="ma-sheet" aria-label="Privacy"><h2 class="ma-title">Privacy</h2>' +
        '<h3 class="ma-sub">What we keep</h3><ul class="ma-plain">' +
        '<li>First name and last initial (your username)</li><li>Your PIN, scrambled. Never shown.</li>' +
        '<li>Your character and the show-me switch</li><li>Alert sign-up, if you turned alerts on</li>' +
        '<li>Game stats, points and history</li><li>Payments (paid or not, and the amount)</li>' +
        '<li>Shop purchases</li></ul>' +
        '<h3 class="ma-sub">What we never keep</h3><ul class="ma-plain">' +
        '<li>Phone number</li><li>Email address</li><li>Card details</li></ul>' +
        '<button type="button" class="ma-btn is-quiet" data-ma-action="cancel">Close</button></section>';
    }
    return '';
  }

  // Plain words for each server reason. Anything not listed gets the general line.
  var REASONS = {
    'wrong-pin': 'That PIN is not right.',
    'locked': 'Too many tries. Wait a few minutes and try again.',
    'bad-pin': 'A PIN is 4 numbers.',
    'too-soon': 'You can change your name once every 30 days.',
    'name-taken': 'Someone already has that name. Add one more letter.',
    'bad-name': 'Use letters only for the first name.',
    'bad-initial': 'The last initial is one letter.',
    'signin': 'Please sign in again.'
  };
  function messageFor(result) {
    if (result && result.ok === true) return { ok: true, text: 'Saved.' };
    var reason = result && result.reason;
    return { ok: false, text: REASONS[reason] || 'Something went wrong. Try again.' };
  }

  function validPin(p) { return /^[0-9]{4}$/.test(String(p || '')); }

  // The download: one JSON file with everything held about the player.
  function dataFile(data) {
    return { filename: 'check-ball-my-data.json', type: 'application/json', text: JSON.stringify(data, null, 2) };
  }

  return { buildPanel: buildPanel, buildSheet: buildSheet, messageFor: messageFor, validPin: validPin,
           dataFile: dataFile, esc: esc, ACTIONS: ACTIONS };
});
