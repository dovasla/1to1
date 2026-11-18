/* Hype taps on the Live tab: a viewer taps 🔥 on a player's token and that token lights up for everyone watching.
   Pure except loadLedger/saveLedger (take a storage object, so tests pass a fake). Browser: window.PlayerHype.
   Node tests: tests/hype.test.js.

   Key: keyOf(team, name) = "Team|Name" for the token on the court. The server resolves it for tonight's night.
   Rate limits (the server enforces them too; this stops the button before a wasted call):
     - the same player once every 30 seconds from you
     - 20 taps from you in any hour
   A hype lights a token up for 60 seconds.
   The buttons stay hidden until the server answers player_hype_rows, so nothing shows when the server piece is missing.
*/
(function (root) {
  'use strict';

  var LIGHT_MS = 60 * 1000;
  var EACH_MS = 30 * 1000;
  var HOUR_MS = 60 * 60 * 1000;
  var HOUR_MAX = 20;
  var KEY = 'cb.hype.ledger';

  var MSG = {
    wait: 'Already hyped. Try again in a moment.',
    hourly: 'You have used your hype taps for this hour.',
    bad: 'Can’t hype this player.'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function emptyLedger() { return { at: [], by: {} }; }

  function keyOf(team, name) { return String(team || '') + '|' + String(name || ''); }

  function canHype(ledger, key, now) {
    var L = ledger || emptyLedger();
    if (!key) return { ok: false, reason: 'bad', message: MSG.bad };
    var last = (L.by || {})[key];
    if (last && now - last < EACH_MS) return { ok: false, reason: 'wait', message: MSG.wait };
    var recent = (L.at || []).filter(function (t) { return now - t < HOUR_MS; });
    if (recent.length >= HOUR_MAX) return { ok: false, reason: 'hourly', message: MSG.hourly };
    return { ok: true, reason: '', message: '' };
  }

  // Returns a new ledger (old entries past an hour are dropped).
  function recordHype(ledger, key, now) {
    var L = ledger || emptyLedger();
    var at = (L.at || []).filter(function (t) { return now - t < HOUR_MS; });
    at.push(now);
    var by = {};
    Object.keys(L.by || {}).forEach(function (k) { if (now - L.by[k] < HOUR_MS) by[k] = L.by[k]; });
    by[key] = now;
    return { at: at, by: by };
  }

  // rows from player_hype_rows: [{ key, at }] where at is ms or an ISO string. Returns { key: true } for lit tokens.
  function litKeys(rows, now) {
    var out = {};
    (rows || []).forEach(function (r) {
      if (!r || !r.key) return;
      var t = typeof r.at === 'number' ? r.at : Date.parse(r.at);
      if (isFinite(t) && now - t >= 0 && now - t < LIGHT_MS) out[r.key] = true;
    });
    return out;
  }

  // store is a Storage-like object (localStorage in the app). Any failure gives an empty ledger, never a throw.
  function loadLedger(store) {
    try {
      var v = JSON.parse(store.getItem(KEY) || 'null');
      return v && typeof v === 'object' ? { at: Array.isArray(v.at) ? v.at : [], by: v.by && typeof v.by === 'object' ? v.by : {} } : emptyLedger();
    } catch (e) { return emptyLedger(); }
  }
  function saveLedger(store, L) {
    try { store.setItem(KEY, JSON.stringify(L)); return true; } catch (e) { return false; }
  }

  function buttonHtml(key) {
    return '<button type="button" class="cv-btn hype-btn" data-hype-btn="' + esc(key) + '">🔥 Hype</button>';
  }

  // Lights the court tokens whose key is lit. Tokens carry data-hk="Team|Name". Safe on an empty DOM.
  function apply(doc, lit) {
    if (!doc || !doc.querySelectorAll) return;
    var tokens = doc.querySelectorAll('[data-hk]');
    for (var i = 0; i < tokens.length; i++) {
      var li = tokens[i].closest ? tokens[i].closest('li') : null;
      if (li) li.classList.toggle('is-hyped', !!(lit && lit[tokens[i].getAttribute('data-hk')]));
    }
  }

  var api = {
    LIGHT_MS: LIGHT_MS, EACH_MS: EACH_MS, HOUR_MS: HOUR_MS, HOUR_MAX: HOUR_MAX, MSG: MSG,
    keyOf: keyOf, canHype: canHype, recordHype: recordHype, litKeys: litKeys,
    loadLedger: loadLedger, saveLedger: saveLedger, buttonHtml: buttonHtml, apply: apply
  };

  root.PlayerHype = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
