/* Player Home card: "Who's in tonight". Shows counts only (in, paid), never names.
 * Global: window.PlayerTonightCount.mount(host, opts) -> { refresh(), destroy() }
 * opts = { rpc: function (name, body) -> Promise (backend.rpc), token: sign-in token, nightId: 'tonight' }
 * Calls player_night_counts (migration-31): counts only, no names or ids reach the phone.
 * Refreshes every 120 seconds while the page is visible. A failed refresh keeps the last numbers, quietly.
 * All text is set with textContent. Needs lib/tonight-count.js first.
 */
(function (root) {
  'use strict';
  var EVERY = 120 * 1000;
  var lib = root.PlayerTonightCount;

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function stat(big, label) {
    var c = el('div', 'tc-stat');
    c.appendChild(el('span', 'tc-big', big));
    c.appendChild(el('span', 'tc-lab', label));
    return c;
  }

  function paint(host, c) {
    host.replaceChildren();
    var card = el('section', 'tc-card');
    card.setAttribute('aria-label', "Who's in tonight");
    card.appendChild(el('h2', 'tc-title', "Who's in tonight"));
    if (!c.ok) {
      card.appendChild(el('p', 'tc-line', lib.labelFor(c)));
      host.appendChild(card);
      return;
    }
    var nums = el('div', 'tc-stats');
    nums.appendChild(stat(String(c.inCount), 'in'));
    nums.appendChild(stat(String(c.paidCount), 'paid'));
    // next-26: only in and paid are shown. Players do not need the extra figure.
    card.appendChild(nums);
    card.appendChild(el('p', 'tc-line', lib.labelFor(c)));
    host.appendChild(card);
  }

  function mount(host, opts) {
    if (!host || !lib || !opts || typeof opts.rpc !== 'function') return { refresh: function () {}, destroy: function () {} };
    var timer = null;
    var stopped = false;
    var last = { ok: false };
    var nightId = opts.nightId || 'tonight';

    function schedule() {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(refresh, EVERY);
    }
    function refresh() {
      if (stopped) return;
      if (document.hidden) { schedule(); return; }
      Promise.resolve(opts.rpc('player_night_counts', { p_token: opts.token, p_night: nightId }))
        .then(function (res) {
          if (stopped) return;
          var c = lib.countsFrom(res);
          if (c.ok) last = c; // keep the last good numbers when a reply is not usable
          paint(host, c.ok ? c : last);
          schedule();
        }, function () {
          if (stopped) return;
          paint(host, last);
          schedule();
        });
    }
    function onVis() { if (!document.hidden && !stopped) refresh(); }
    document.addEventListener('visibilitychange', onVis);

    paint(host, { ok: false });
    refresh();
    return {
      refresh: refresh,
      destroy: function () {
        stopped = true;
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVis);
        host.replaceChildren();
      }
    };
  }

  root.PlayerTonightCount = Object.assign(lib || {}, { mount: mount });
})(typeof window !== 'undefined' ? window : globalThis);
