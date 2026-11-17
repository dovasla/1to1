/* ==========================================================
   Check Ball shop effects (production module)
   Plain browser JS, no build step. Exposes window.ShopFx.
   Works with shop-effects.css. See INTEGRATION.md for markup and calls.
   Never writes to the server. Never stores anything.
   ========================================================== */
(function (window, document) {
  'use strict';
  if (window.ShopFx) return;

  var root = document.documentElement;
  var reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  // The 14 glow families from items.json (effect column). "none" = Plain.
  var GLOWS = ['aura', 'neon', 'pulse', 'flame', 'ice', 'electric', 'plasma', 'holo',
    'gold-foil', 'void', 'galaxy', 'glitch', 'rainbow-ring', 'embers'];

  // Legend and Epic banner looks. PROPOSAL (16 Nov): desk may change these.
  var LOOKS = ['solar', 'void', 'storm', 'inferno'];
  var LOOK_BY_ITEM = {
    'bg-gold-foil': 'solar',
    'bg-vip-crown': 'solar',
    'bg-void': 'void',
    'bg-neon-grid': 'void',
    'bg-galaxy': 'storm',
    'bg-ice': 'storm',
    'bg-rainbow-ring': 'inferno',
    'bg-ember': 'inferno'
  };

  var inited = false;
  var pending = null, tiltQueued = false, lastBanner = null;
  var moments = [], momentBusy = false;

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  function reducedMotion() { return !!(reduceQuery && reduceQuery.matches); }

  // True when no loop, tilt or slide should run.
  function still() {
    return root.getAttribute('data-calm') === '1' ||
      root.getAttribute('data-fx') === 'low' ||
      reducedMotion();
  }

  function setCalm(on) {
    if (on) root.setAttribute('data-calm', '1'); else root.removeAttribute('data-calm');
  }

  function setLow(on) {
    if (on) root.setAttribute('data-fx', 'low'); else root.removeAttribute('data-fx');
  }

  // Restart a one-shot class (wipe, pop, sweep, glitch) and remove it when done.
  function oneShot(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    window.setTimeout(function () { el.classList.remove(cls); }, ms);
  }

  // ---------- Items -> data attributes ----------
  // item: one entry from items.json (id, layer, tier, depth, effect).
  function lookFor(item) {
    if (!item || item.layer !== 'background') return null;
    return LOOK_BY_ITEM[item.id] || null;
  }

  function apply(el, item) {
    if (!el || !item) return el;
    el.classList.add('fx-surface');
    el.setAttribute('data-fx-id', String(item.id || ''));
    el.setAttribute('data-fx-layer', String(item.layer || ''));
    el.setAttribute('data-fx-tier', String(item.tier || 'common'));
    el.setAttribute('data-fx-depth', String(item.depth == null ? 0 : item.depth));
    if (item.effect && item.effect !== 'none' && GLOWS.indexOf(item.effect) !== -1) {
      el.setAttribute('data-fx-glow', item.effect);
    } else {
      el.removeAttribute('data-fx-glow');
    }
    var look = lookFor(item);
    if (look) el.setAttribute('data-fx-look', look); else el.removeAttribute('data-fx-look');
    if (item.tier && item.tier !== 'common' && !el.querySelector(':scope > .fx-halo')) {
      var halo = document.createElement('span');
      halo.className = 'fx-halo';
      halo.setAttribute('aria-hidden', 'true');
      el.insertBefore(halo, el.firstChild);
    }
    return el;
  }

  // ---------- Pointer: 3D tilt for Legend banners, holo foil ----------
  function resetBanner(banner) {
    var card = banner && banner.querySelector('.fx-card');
    if (!card) return;
    card.style.setProperty('--fx-rx', '0deg');
    card.style.setProperty('--fx-ry', '0deg');
    card.style.setProperty('--fx-dx', '0');
    card.style.setProperty('--fx-dy', '0');
  }

  function applyPointer() {
    tiltQueued = false;
    var e = pending;
    pending = null;
    if (!e || !e.target || !e.target.closest) return;
    var banner = e.target.closest('.fx-banner[data-fx-depth="3"][data-fx-look]');
    var holo = e.target.closest('[data-fx-glow="holo"]');

    if (lastBanner && lastBanner !== banner) resetBanner(lastBanner);
    lastBanner = banner;

    if (holo && !still()) {
      var hr = holo.getBoundingClientRect();
      if (hr.width) {
        holo.style.setProperty('--fx-hp', (clamp01((e.clientX - hr.left) / hr.width) * 100).toFixed(1));
      }
    }
    if (!banner || still()) return;

    var card = banner.querySelector('.fx-card');
    if (!card) return;
    var r = banner.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var x = clamp01((e.clientX - r.left) / r.width);
    var y = clamp01((e.clientY - r.top) / r.height);
    card.style.setProperty('--fx-ry', ((x - 0.5) * 22).toFixed(2) + 'deg');
    card.style.setProperty('--fx-rx', ((0.5 - y) * 16).toFixed(2) + 'deg');
    card.style.setProperty('--fx-dx', ((x - 0.5) * 2).toFixed(3));
    card.style.setProperty('--fx-dy', ((y - 0.5) * 2).toFixed(3));
  }

  function onPointerMove(e) {
    pending = e;
    if (!tiltQueued) {
      tiltQueued = true;
      window.requestAnimationFrame(applyPointer);
    }
  }

  function onPointerUp() {
    if (lastBanner) resetBanner(lastBanner);
    lastBanner = null;
  }

  function onPointerDown(e) {
    var g = e.target && e.target.closest ? e.target.closest('[data-fx-glow="glitch"]') : null;
    if (!g || still()) return;
    oneShot(g, 'fx-hit', 520);
  }

  // ---------- Moments: unlock, prestige. One at a time, tap to skip ----------
  function runNextMoment() {
    if (momentBusy || !moments.length) return;
    momentBusy = true;
    var job = moments.shift();
    playMoment(job.kind, job.opts).then(function () {
      momentBusy = false;
      job.resolve();
      runNextMoment();
    });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  function playMoment(kind, opts) {
    return new Promise(function (resolve) {
      var prestige = kind === 'prestige';
      var ms = prestige ? 2400 : 1600;
      var wrap = el('div', 'fx-moment' + (prestige ? ' fx-moment-prestige' : ''));
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      wrap.setAttribute('data-fx-tier', String(opts.tier || (prestige ? 'legend' : 'common')));

      var card = el('div', 'fx-moment-card');
      if (!prestige) card.appendChild(el('div', 'fx-moment-sweep'));
      card.appendChild(el('div', 'fx-moment-word', opts.word || (prestige ? 'Prestige' : 'Unlocked')));
      card.appendChild(el('div', 'fx-moment-name', opts.name || ''));
      if (opts.line) card.appendChild(el('div', 'fx-moment-line', opts.line));

      if (prestige) {
        wrap.appendChild(el('div', 'fx-moment-star', '★'));
        wrap.appendChild(el('span', 'fx-ring'));
        wrap.appendChild(el('span', 'fx-ring fx-r2'));
        wrap.appendChild(el('span', 'fx-ring fx-r3'));
      }
      wrap.appendChild(card);
      wrap.appendChild(el('div', 'fx-moment-skip', 'Tap to skip'));

      var timer = 0;
      function close() {
        window.clearTimeout(timer);
        document.removeEventListener('keydown', onKey);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        resolve();
      }
      function onKey(e) { if (e.key === 'Escape') close(); }

      wrap.addEventListener('pointerdown', close);
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
      timer = window.setTimeout(close, ms);
    });
  }

  // kind: 'unlock' | 'levelup' | 'prestige'. opts: { name, word, line, tier }.
  // Returns a promise that resolves when the moment has ended.
  function moment(kind, opts) {
    return new Promise(function (resolve) {
      moments.push({ kind: kind, opts: opts || {}, resolve: resolve });
      runNextMoment();
    });
  }

  // ---------- Equip, buy, pop (short one-shots, no queue) ----------
  // Equip: the banner wipes to the new look. The name never moves.
  function equip(banner) {
    if (still()) return;
    oneShot(banner && banner.querySelector('.fx-bg'), 'fx-wipe', 340);
  }

  // Buy: one light sweep across the banner card (900 ms).
  function buy(banner) {
    if (still()) return;
    oneShot(banner && banner.querySelector('.fx-card'), 'fx-go', 900);
  }

  function pop(node) {
    if (still()) return;
    oneShot(node, 'fx-pop', 230);
  }

  // ---------- Performance and tab visibility ----------
  // Weak phone check: if frames run slow in the first 60 frames, switch to flat.
  function sampleFrames() {
    if (still() || root.getAttribute('data-fx') === 'low') return;
    var last = window.performance.now(), slow = 0, n = 0;
    function tick(now) {
      var dt = now - last;
      last = now;
      n++;
      if (n > 5 && dt > 24) slow++;
      if (n === 60) {
        if (slow > 12) setLow(true);
        return;
      }
      window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);
  }

  function onVisibility() {
    if (document.hidden) root.setAttribute('data-fx-hidden', '1');
    else root.removeAttribute('data-fx-hidden');
  }

  function init() {
    if (inited) return api;
    inited = true;
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointercancel', onPointerUp, { passive: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    sampleFrames();
    return api;
  }

  // ---------- Buy moment (from the 72x module): adds .fx-unlock to the card for ~1.3 s ----------
  var unlockReduced = false;
  try { unlockReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  function unlock(el) {
    if (!el || unlockReduced) return;
    try {
      el.classList.remove('fx-unlock');
      void el.offsetWidth;
      el.classList.add('fx-unlock');
      setTimeout(function () { el.classList.remove('fx-unlock'); }, 1300);
    } catch (e) {}
  }

  var api = {
    init: init,
    apply: apply,
    unlock: unlock,
    lookFor: lookFor,
    setCalm: setCalm,
    setLow: setLow,
    still: still,
    moment: moment,
    equip: equip,
    buy: buy,
    pop: pop,
    GLOWS: GLOWS.slice(),
    LOOKS: LOOKS.slice()
  };

  window.ShopFx = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
