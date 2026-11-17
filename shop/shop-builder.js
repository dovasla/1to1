// shop-builder.js: the card-builder screen. NEW file, does not touch shop-v2.js.
// Usage: var b = ShopBuilder.init({ mount: '#builder', items: [...], owned: [ids], worn: {layer: id},
//   player: {name, initials, level, stars, coins, vip, badges}, onBuy(item), onEquip(item) });
// Then b.update({ owned, worn, player, items }) after the real data changes.
(function (global) {
  'use strict';

  var LAYERS = [
    ['background', 'Background'], ['frame', 'Frame'], ['emblem', 'Badge'], ['title', 'Title'],
    ['effect', 'Glow'], ['name', 'Name'], ['card', 'Card'], ['flourish', 'Flourish'],
    ['row', 'Row'], ['ring', 'Ring'], ['intro', 'Load-in'], ['pop', 'Score pop']
  ];
  var TIER_LABEL = { common: 'Common', rare: 'Rare', epic: 'Epic', legend: 'Legend' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function costOf(item) {
    var k = (item.unlock || {}).kind;
    return (k === 'level' || k === 'stars') ? (item.price || 0) : 0;
  }

  // Plain words for the requirement. Returns { ok, text }.
  function requirement(item, player) {
    var u = item.unlock || {};
    var p = player || {};
    if (u.kind === 'vip') return { ok: !!p.vip, text: 'VIP only' };
    if (u.kind === 'badge') {
      var badge = u.badge || item.name;
      var have = (p.badges || []).indexOf(item.id) >= 0 || (p.badges || []).indexOf(badge) >= 0;
      return { ok: have, text: 'Earn the ' + badge + ' badge' };
    }
    if (u.kind === 'stars') {
      return { ok: (p.stars || 0) >= (u.minStars || 0), text: 'Earn ' + (u.minStars || 0) + ' stars' };
    }
    var lvl = (p.level || 0) >= (u.minLevel || 0);
    var starsOk = (p.stars || 0) >= (u.minStars || 0);
    if (!lvl) return { ok: false, text: 'Reach level ' + u.minLevel };
    if (!starsOk) return { ok: false, text: 'Earn ' + u.minStars + ' stars' };
    return { ok: true, text: 'Unlocked' };
  }

  function layerLabel(key) {
    for (var i = 0; i < LAYERS.length; i++) if (LAYERS[i][0] === key) return LAYERS[i][1];
    return key;
  }

  function create(opts) {
    var mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) throw new Error('ShopBuilder: mount not found');
    var S = {
      items: [], owned: {}, worn: {}, player: {}, layer: 'background',
      previewId: null, status: '', pending: null, opts: opts
    };
    var reducedMotion = false;
    try { reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    function setData(patch) {
      if (patch.items) S.items = patch.items;
      if (patch.owned) { S.owned = {}; patch.owned.forEach(function (id) { S.owned[id] = true; }); }
      if (patch.worn) S.worn = Object.assign({}, patch.worn);
      if (patch.player) S.player = Object.assign({}, patch.player);
    }
    setData({ items: opts.items || [], owned: opts.owned || [], worn: opts.worn || {}, player: opts.player || {} });

    function byId(id) {
      for (var i = 0; i < S.items.length; i++) if (S.items[i].id === id) return S.items[i];
      return null;
    }
    function itemsIn(layer) {
      return S.items.filter(function (it) { return it.layer === layer; })
        .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    }
    function state(item) {
      var req = requirement(item, S.player);
      var owned = !!S.owned[item.id];
      var worn = S.worn[item.layer] === item.id;
      var cost = costOf(item);
      var coins = S.player.coins || 0;
      if (owned) return { key: worn ? 'worn' : 'owned', req: req, cost: cost };
      if (!req.ok) return { key: 'locked', req: req, cost: cost };
      if (cost > coins) return { key: 'short', req: req, cost: cost, need: cost - coins };
      return { key: 'open', req: req, cost: cost };
    }
    // What the card shows for one layer: the previewed item if it is on this layer, else the worn one.
    function shownOn(layer) {
      if (S.previewId) {
        var p = byId(S.previewId);
        if (p && p.layer === layer) return p;
      }
      var id = S.worn[layer];
      return id ? byId(id) : null;
    }

    function cardHtml() {
      var pl = S.player;
      var layers = LAYERS.map(function (l) {
        var it = shownOn(l[0]);
        return it ? '<div class="sb-layer pn-l-' + esc(it.layer) + '-' + esc(it.id) + '" aria-hidden="true"></div>' : '';
      }).join('');
      return '<div class="sb-card" data-action="replay" role="img" aria-label="Your player card, tap to replay effects">' +
        layers +
        '<div class="sb-card-body">' +
          '<div class="sb-card-top"><span class="sb-level">Level ' + esc(pl.level || 1) + '</span>' +
          '<span class="sb-coins">' + esc(pl.coins || 0) + ' coins</span></div>' +
          '<div class="sb-avatar">' + esc(pl.initials || '?') + '</div>' +
          '<div class="sb-name">' + esc(pl.name || 'Your name') + '</div>' +
        '</div></div>';
    }

    function tabsHtml() {
      return LAYERS.map(function (l) {
        var n = itemsIn(l[0]).length;
        if (!n) return '';
        var on = S.layer === l[0];
        return '<button type="button" class="sb-tab" role="tab" aria-selected="' + on + '" data-action="layer" data-layer="' + l[0] + '">' +
          esc(l[1]) + '</button>';
      }).join('');
    }

    function tileHtml(it) {
      var st = state(it);
      var label = { worn: 'Equipped', owned: 'Owned', locked: 'Locked', short: 'Need coins', open: 'Buy' }[st.key];
      var sub;
      if (st.key === 'locked') sub = st.req.text;
      else if (st.key === 'short') sub = st.need + ' more coins';
      else if (st.cost) sub = st.cost + ' coins';
      else sub = st.req.text === 'Unlocked' ? 'Free' : st.req.text;
      var sel = S.previewId === it.id ? ' is-preview' : '';
      return '<button type="button" class="sb-tile sb-' + st.key + sel + '" data-action="preview" data-id="' + esc(it.id) + '" aria-pressed="' + (S.previewId === it.id) + '">' +
        '<span class="sb-tile-name">' + esc(it.name) + '</span>' +
        '<span class="sb-tile-sub">' + esc(TIER_LABEL[it.tier] || it.tier) + ' · ' + esc(sub) + '</span>' +
        '<span class="sb-tile-state">' + esc(label) + '</span></button>';
    }

    function barHtml() {
      var it = S.previewId ? byId(S.previewId) : null;
      if (!it) {
        return '<div class="sb-bar-text"><b>Tap an item</b><span>Tap any item to try it on the card.</span></div>' +
          '<button type="button" class="sb-btn" disabled>Pick an item</button>';
      }
      var st = state(it);
      var text, btn;
      if (S.pending && S.pending.id === it.id) {
        return '<div class="sb-bar-text" aria-live="polite"><b>' + esc(it.name) + '</b><span>Saving…</span></div>' +
          '<button type="button" class="sb-btn" disabled>Saving…</button>';
      }
      if (st.key === 'worn') {
        text = '<b>' + esc(it.name) + '</b><span>On your card now.</span>';
        btn = '<button type="button" class="sb-btn" disabled>Equipped</button>';
      } else if (st.key === 'owned') {
        text = '<b>' + esc(it.name) + '</b><span>You own this.</span>';
        btn = '<button type="button" class="sb-btn" data-action="equip" data-id="' + esc(it.id) + '">Equip</button>';
      } else if (st.key === 'locked') {
        text = '<b>' + esc(it.name) + '</b><span>' + esc(st.req.text) + '</span>';
        btn = '<button type="button" class="sb-btn" disabled>Locked</button>';
      } else if (st.key === 'short') {
        text = '<b>' + esc(it.name) + '</b><span>You need ' + st.need + ' more coins.</span>';
        btn = '<button type="button" class="sb-btn" disabled>Buy ' + st.cost + '</button>';
      } else {
        text = '<b>' + esc(it.name) + '</b><span>' + (st.cost ? st.cost + ' coins' : 'Free unlock') + '</span>';
        btn = '<button type="button" class="sb-btn sb-btn-buy" data-action="buy" data-id="' + esc(it.id) + '">' +
          (st.cost ? 'Buy ' + st.cost : 'Claim') + '</button>';
      }
      return '<div class="sb-bar-text" aria-live="polite">' + text + '</div>' + btn;
    }

    // Runs onBuy/onEquip. The item only changes on success; a rejection leaves everything as it was.
    function runAction(kind, item, fn, applyLocally) {
      S.pending = { id: item.id, kind: kind };
      S.status = (kind === 'buy' ? 'Buying ' : 'Equipping ') + item.name + '…';
      render();
      var p;
      try { p = Promise.resolve(typeof fn === 'function' ? fn(item) : undefined); }
      catch (e) { p = Promise.reject(e); }
      p.then(function () {
        S.pending = null;
        applyLocally();
        S.status = kind === 'buy' ? 'Bought ' + item.name + '.' : item.name + ' is on your card.';
        render();
        if (kind === 'buy' && global.ShopFx && !reducedMotion) global.ShopFx.unlock(mount.querySelector('.sb-card'));
      }, function (err) {
        S.pending = null;
        var why = (err && typeof err.reason === 'string') ? err.reason
          : (typeof err === 'string') ? err
          : (err && err.message) ? err.message
          : (kind === 'buy' ? "Couldn't buy " : "Couldn't equip ") + item.name + '. Try again.';
        S.status = why;
        render();
      });
    }

    function render() {
      var list = itemsIn(S.layer);
      mount.innerHTML =
        '<section class="sb" data-theme="' + esc(S.opts.theme || '') + '">' +
          '<h2 class="sb-title">Card Builder</h2>' +
          cardHtml() +
          '<div class="sb-tabs" role="tablist" aria-label="Card parts">' + tabsHtml() + '</div>' +
          '<div class="sb-grid" role="tabpanel">' + (list.map(tileHtml).join('') || '<p class="sb-empty">Nothing here yet.</p>') + '</div>' +
          '<div class="sb-status" role="status">' + esc(S.status) + '</div>' +
          '<div class="sb-bar">' + barHtml() + '</div>' +
        '</section>';
    }

    mount.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-action]');
      if (!el || el.disabled) return;
      var a = el.getAttribute('data-action');
      if (a === 'layer') {
        S.layer = el.getAttribute('data-layer');
        render();
      } else if (a === 'preview') {
        var id = el.getAttribute('data-id');
        S.previewId = S.previewId === id ? null : id;
        render();
      } else if (a === 'replay') {
        render(); // re-creating the layer nodes restarts their animations
      } else if (a === 'buy') {
        if (S.pending) return;
        var bought = byId(el.getAttribute('data-id'));
        if (!bought) return;
        runAction('buy', bought, S.opts.onBuy, function () { S.owned[bought.id] = true; });
      } else if (a === 'equip') {
        if (S.pending) return;
        var eq = byId(el.getAttribute('data-id'));
        if (!eq) return;
        runAction('equip', eq, S.opts.onEquip, function () { S.worn[eq.layer] = eq.id; });
      }
    });

    render();

    return {
      // Call with any subset of { items, owned, worn, player } after real data changes.
      update: function (patch) { setData(patch || {}); render(); },
      setLayer: function (layer) { S.layer = layer; render(); },
      preview: function (id) { S.previewId = id; render(); },
      state: function (id) { var it = byId(id); return it ? state(it).key : null; }
    };
  }

  global.ShopBuilder = { init: create, requirement: requirement, costOf: costOf };
})(typeof window !== 'undefined' ? window : this);
