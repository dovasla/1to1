/* Player app: payment receipt line on Home (Brief 26, ruling R44 item 1). Plain JS, no framework, no network.
   Owner: receipt module (own files only). Hook lines go to the Fable faults thread, see HOOKS.md.

   After a paid join, Home shows under the Pay line:
     Paid £5 · 15 Nov · ref 4F2K
     You’re in.
   It is what a player shows Jord if the two phones disagree.

   Off unless config receiptOn === true (window.PLAYER_APP_CONFIG). Set receiptOn to false to hide it.

   Usage (integrator, see HOOKS.md):
     PlayerReceipt.register(PlayerHome.register);   // once, after home.js has loaded
   Reads from the Home data:
     d.tonight.paid    true only when the server says paid (never by tap)
     d.tonight.amount  e.g. '£5' (optional)
     d.receipt         { dateISO, ref } (both optional). dateISO is the night's start, ref the short order code.
   Missing parts are left out, so the line never shows "undefined".

   Global: window.PlayerReceipt. Node: module.exports (for tests).
*/
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerReceipt = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var SLOT_ID = 'receipt';
  var SLOT_ORDER = 25;          // sits between the I'm in row (20) and the streak card (30)
  var LONDON = 'Europe/London';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Receipt is on only when the config says so. Default is off.
  function isOn(cfg) { return !!(cfg && cfg.receiptOn === true); }

  // "15 Nov" in London time. Falls back to the phone's own clock if Intl is missing.
  function dayLabel(iso) {
    if (!iso) return '';
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    try {
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, day: 'numeric', month: 'short' }).formatToParts(new Date(t));
      var day = '', month = '';
      parts.forEach(function (p) { if (p.type === 'day') day = p.value; if (p.type === 'month') month = p.value; });
      return day && month ? day + ' ' + month : '';
    } catch (e) {
      var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var d = new Date(t);
      return d.getDate() + ' ' + MON[d.getMonth()];
    }
  }

  // Short order code: letters and digits only, max 8 characters. Anything else is dropped.
  function refCode(ref) {
    var s = String(ref == null ? '' : ref).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return s.length ? s.slice(0, 8) : '';
  }

  // The receipt text, or '' when there is nothing to show.
  // Shown only when paid is true. Parts are joined with a middle dot.
  function receiptLine(d) {
    var t = d && d.tonight;
    if (!t || t.paid !== true) return '';
    var r = (d && d.receipt) || {};
    var parts = ['Paid'];
    var amount = t.amount ? String(t.amount).trim() : '';
    if (amount) parts[0] = 'Paid ' + amount;
    var date = dayLabel(r.dateISO);
    if (date) parts.push(date);
    var ref = refCode(r.ref);
    if (ref) parts.push('ref ' + ref);
    return parts.join(' · ');
  }

  // Slot HTML for Home, or '' (no gap) when off or not paid.
  function slotHtml(d, cfg) {
    if (!isOn(cfg)) return '';
    var line = receiptLine(d);
    if (!line) return '';
    return '<div class="rc-card" role="status" aria-label="Payment receipt">' +
      '<p class="rc-line">' + esc(line) + '</p>' +
      '<p class="rc-sub">You’re in.</p>' +
      '</div>';
  }

  // Read at render time, so a config change (or a test stub) takes effect without a reload.
  function liveConfig() {
    var g = (typeof window !== 'undefined') ? window : (root || {});
    return (g && g.PLAYER_APP_CONFIG) || {};
  }

  // Adds the slot to Home. reg is PlayerHome.register. Returns true when added.
  function register(reg) {
    if (typeof reg !== 'function') return false;
    reg(SLOT_ID, SLOT_ORDER, function (d) { return slotHtml(d, liveConfig()); });
    return true;
  }

  return {
    register: register,
    slotHtml: slotHtml,
    receiptLine: receiptLine,
    dayLabel: dayLabel,
    refCode: refCode,
    isOn: isOn,
    SLOT_ID: SLOT_ID,
    SLOT_ORDER: SLOT_ORDER
  };
});
