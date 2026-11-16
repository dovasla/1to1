/* Morning-after recap card and recap sheet (player app). Package N3. Plain JS, no framework, reads only.
 * Browser: window.PlayerRecap. Node tests: recap.test.js.
 * Data in (already fetched by the caller, no new SQL):
 *   profile  = player_profile(p_token)      { ok, nights: [{ night_id, night_date, games, wins, points, mvp, xp }] }
 *   summary  = player_xp_summary(p_token)   { ok, xp, level, nights: [{ night_id, games, xp_earned, parts, ... }] }
 *   mvp      = { open, voted, confirmed, won }  (from PlayerMvp: open = the MVP vote is still open for that night)
 *   seenIds  = night ids already opened on this phone (see readSeen / markSeen)
 *   now      = Date.now() value
 *   top      = optional [{ name, level, points }] (top three of the night). Hidden when absent. See HOOKS.md.
 * Rules: a player who did not play sees no card (games > 0 is required). Only players who played can vote
 * (Fable R4). The XP shown is the server's ledger XP for that night; the breakdown is its saved parts.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerRecap = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var XP = root.PlayerXp || (typeof require === 'function' ? require('../../lib/xp.js') : null);
  var STORE_KEY = '1to1.recap.seen';
  var KEEP_SEEN = 12;
  var ORDER = { isNew: 10, compact: 80 };   // Home slot order: a new recap sits at the top, then drops down the list.

  // Breakdown lines, in the order the card shows them. Keys match the server's saved parts.
  var PARTS = [
    { key: 'turnUp', label: 'Turned up' },
    { key: 'games', label: 'Games played' },
    { key: 'points', label: 'Points' },
    { key: 'wins', label: 'Wins' },
    { key: 'mvp', label: 'MVP pick' },
    { key: 'streak', label: 'Weekly streak' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { var n = Number(v); return isFinite(n) ? Math.round(n) : 0; }

  // Monday 00:00 (local) of the week that holds this date.
  function weekStart(ms) {
    var d = new Date(ms);
    var back = (d.getDay() + 6) % 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - back);
    return d.getTime();
  }

  function dateLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  // Parts may arrive as an object or as JSON text (depends on the column type).
  function partsOf(ledger) {
    var p = ledger && ledger.parts;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
    return p && typeof p === 'object' ? p : {};
  }

  function lastPlayedNight(profile) {
    var nights = ((profile && profile.nights) || []).filter(function (n) { return n && num(n.games) > 0; });
    nights.sort(function (a, b) { return Date.parse(b.night_date) - Date.parse(a.night_date); });
    return nights[0] || null;
  }

  // Shown once as new (order 10), then as a compact row for the rest of its week, then not at all.
  // A player who did not play gets no card.
  function visibilityOf(night, seenIds, now) {
    if (!night || num(night.games) <= 0) return null;
    var seen = (seenIds || []).indexOf(night.nightId) > -1;
    if (!seen) return 'new';
    var t = Date.parse(night.night_date);
    if (isNaN(t)) return null;
    return weekStart(t) === weekStart(now) ? 'compact' : null;
  }

  // Everything the card and sheet show, worked out from the saved data. Returns null when there is no card.
  function buildRecap(input) {
    var inp = input || {};
    var profile = inp.profile;
    var summary = inp.summary;
    if (!profile || profile.ok === false || !summary || summary.ok === false) return null;
    var last = lastPlayedNight(profile);
    if (!last) return null;

    var ledger = null;
    ((summary.nights) || []).some(function (row) {
      if (row && row.night_id === last.night_id) { ledger = row; return true; }
      return false;
    });

    var earned = ledger ? num(ledger.xp_earned) : num(last.xp);
    var runXp = num(summary.xp);
    var parts = partsOf(ledger);
    var breakdown = PARTS.filter(function (p) { return num(parts[p.key]) !== 0; })
      .map(function (p) { return { label: p.label, xp: num(parts[p.key]) }; });
    var partsSum = PARTS.reduce(function (s, p) { return s + num(parts[p.key]); }, 0);
    var adjust = ledger ? earned - partsSum : 0;   // prestige bonus (+) or night cap (-)
    if (adjust > 0) breakdown.push({ label: 'Prestige bonus', xp: adjust });
    if (adjust < 0) breakdown.push({ label: 'Run cap', xp: adjust });

    var levelTo = num(summary.level) || XP.levelOf(runXp);
    var levelFrom = Math.min(XP.levelOf(Math.max(0, runXp - earned)), levelTo);
    var mvp = inp.mvp || {};
    var nightId = last.night_id;

    var view = {
      nightId: nightId,
      dateLabel: dateLabel(last.night_date),
      games: num(last.games),
      wins: num(last.wins),
      points: num(last.points),
      mvpPick: !!last.mvp,
      xp: earned,
      breakdown: breakdown,
      levelFrom: levelFrom,
      levelTo: levelTo,
      levelUp: levelTo > levelFrom,
      canVote: !!(mvp.open && !mvp.confirmed && !mvp.voted && num(last.games) > 0),   // R4: only players who played
      state: visibilityOf({ nightId: nightId, games: last.games, night_date: last.night_date }, inp.seenIds, inp.now || Date.now()),
      order: null,
      top: Array.isArray(inp.top) ? inp.top.slice(0, 3) : []
    };
    view.order = view.state === 'new' ? ORDER.isNew : ORDER.compact;
    return view;   // always built; view.state tells the slot whether to show the card
  }

  // Home slot pieces. Returns { order, html } or nothing when the card is not shown.
  function cardHtml(view) {
    if (!view || !view.state) return '';
    var isNew = view.state === 'new';
    return '<button type="button" class="rc-card' + (isNew ? ' is-new' : '') + '" data-recap-open="' + esc(view.nightId) + '">' +
      '<span class="rc-cap">Last run</span>' +
      '<span class="rc-title">' + (isNew ? 'Your recap is ready' : 'Last run recap') + '</span>' +
      '<span class="rc-row">' +
        '<span class="rc-mini"><b>' + esc(view.games) + '</b> games</span>' +
        '<span class="rc-mini"><b>' + esc(view.wins) + '</b> wins</span>' +
        '<span class="rc-mini"><b>+' + esc(view.xp) + '</b> XP</span>' +
      '</span>' +
      '<span class="rc-go">See recap</span>' +
    '</button>';
  }

  function levelLine(view) {
    return view.levelUp
      ? 'Level up: ' + esc(view.levelFrom) + ' to ' + esc(view.levelTo)
      : 'Level ' + esc(view.levelTo);
  }

  // The full recap sheet. Pure HTML, so the test can check it.
  function sheetHtml(view) {
    if (!view) return '';
    var breakdown = view.breakdown.map(function (b) {
      return '<li class="rc-line"><span>' + esc(b.label) + '</span><b>' + (b.xp > 0 ? '+' : '') + esc(b.xp) + '</b></li>';
    }).join('');
    var top = '';
    if (view.top && view.top.length) {
      top = '<h3 class="rc-h3">Top three</h3><ol class="rc-top">' + view.top.map(function (p) {
        return '<li class="rc-line"><span>' + esc(p.name) + '</span><span class="rc-sub">Lv ' + esc(num(p.level)) +
          ' · ' + esc(num(p.points)) + ' pts</span></li>';
      }).join('') + '</ol>';
    }
    var mvp = '';
    if (view.mvpPick) mvp = '<p class="rc-note">You got the MVP pick.</p>';
    if (view.canVote) {
      mvp = '<h3 class="rc-h3">MVP vote</h3>' +
        '<button type="button" class="rc-btn" data-recap-vote="' + esc(view.nightId) + '">Vote for MVP</button>' +
        '<p class="rc-note">Only players who played in this run can vote.</p>';
    }
    return '<div class="rc-overlay" data-recap-close>' +
      '<section class="rc-sheet" role="dialog" aria-modal="true" aria-label="Last run recap">' +
        '<h2 class="rc-h2">Last run</h2>' +
        '<p class="rc-date">' + esc(view.dateLabel) + '</p>' +
        '<div class="rc-stats">' +
          '<div class="rc-big"><b>' + esc(view.games) + '</b><span>Games</span></div>' +
          '<div class="rc-big"><b>' + esc(view.wins) + '</b><span>Wins</span></div>' +
          '<div class="rc-big"><b>' + esc(view.points) + '</b><span>Points</span></div>' +
        '</div>' +
        '<h3 class="rc-h3">XP earned</h3>' +
        '<p class="rc-xp"><b>+' + esc(view.xp) + '</b></p>' +
        '<ul class="rc-lines">' + breakdown + '</ul>' +
        '<p class="rc-level' + (view.levelUp ? ' is-up' : '') + '">' + levelLine(view) + '</p>' +
        top + mvp +
        '<button type="button" class="rc-close" data-recap-close>Close</button>' +
      '</section>' +
    '</div>';
  }

  // Storage is injected so the test can pass a fake. Every read and write is guarded.
  function readSeen(storage) {
    try {
      var raw = storage && storage.getItem(STORE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function markSeen(storage, nightId) {
    try {
      if (!storage || !nightId) return;
      var list = readSeen(storage).filter(function (id) { return id !== nightId; });
      list.push(nightId);
      storage.setItem(STORE_KEY, JSON.stringify(list.slice(-KEEP_SEEN)));
    } catch (e) { /* private window or blocked storage: the card just shows as new again */ }
  }

  // Slot for the Home list. N0/N1 register it; slot.html goes in the slot, then slot.bind(slotEl) once.
  // handlers: { storage, onVote(nightId) }. Tapping the card marks it seen and opens the sheet.
  function slot(view, handlers) {
    var h = handlers || {};
    return {
      order: view ? view.order : null,
      html: cardHtml(view),
      bind: function (el) {
        if (!el || !view || !view.state) return;
        el.addEventListener('click', function (e) {
          var t = e.target && e.target.closest ? e.target : null;
          if (!t) return;
          var open = t.closest('[data-recap-open]');
          if (open) {
            markSeen(h.storage, view.nightId);
            openSheet(view, h);
          }
        });
      }
    };
  }

  // Slide-up sheet in the page. Closes on the Close button or the dimmed background.
  function openSheet(view, handlers) {
    if (typeof document === 'undefined' || !view) return null;
    var host = document.createElement('div');
    host.innerHTML = sheetHtml(view);
    var overlay = host.firstChild;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.hasAttribute && t.hasAttribute('data-recap-vote')) {
        if (handlers && handlers.onVote) handlers.onVote(view.nightId);
        return;
      }
      if (t && t.hasAttribute && t.hasAttribute('data-recap-close')) overlay.remove();
    });
    return overlay;
  }

  return {
    ORDER: ORDER,
    PARTS: PARTS,
    esc: esc,
    weekStart: weekStart,
    buildRecap: buildRecap,
    visibilityOf: visibilityOf,
    cardHtml: cardHtml,
    sheetHtml: sheetHtml,
    readSeen: readSeen,
    markSeen: markSeen,
    slot: slot,
    openSheet: openSheet,
    STORE_KEY: STORE_KEY
  };
});
