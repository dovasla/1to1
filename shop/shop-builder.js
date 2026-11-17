// shop-builder.js: the card-builder screen (r5). Data model unchanged; only the groups on screen changed.
// Usage: var b = ShopBuilder.init({ mount, items, owned, worn, player, onBuy(item), onEquip(item) });
// Then b.update({ owned, worn, player, items }) after real data changes.
(function (global) {
  'use strict';

  // Five groups on screen. Every one of the 12 item layers belongs to exactly one group.
  var GROUPS = [
    { key: 'card', label: 'Card', layers: ['background', 'card'] },
    { key: 'name', label: 'Name', layers: ['name', 'emblem', 'title'] },
    { key: 'frame', label: 'Frame', layers: ['frame', 'ring', 'row'] },
    { key: 'effects', label: 'Effects', layers: ['effect', 'flourish', 'pop'] },
    { key: 'intro', label: 'Intro', layers: ['intro'] }
  ];
  var LAYER_LABEL = {
    background: 'Background', card: 'Card face', name: 'Name style', emblem: 'Badge', title: 'Title shine',
    frame: 'Frame', ring: 'Avatar ring', row: 'Board row',
    effect: 'Glow', flourish: 'Corner flourish', pop: 'Score pop', intro: 'Load-in'
  };
  var WHAT = {
    background: 'The backdrop behind your avatar.',
    card: 'Lines or texture across the whole card.',
    name: 'How your name is written.',
    emblem: 'A glow behind your avatar.',
    title: 'A light sweep over your name.',
    frame: 'A border around your card.',
    ring: 'A ring around your avatar.',
    row: 'How your row looks on the leaderboard.',
    effect: 'A light effect over the whole card.',
    flourish: 'Small marks in the card corners.',
    pop: 'The animation when your score changes in a run.',
    intro: 'The animation when you join a game.'
  };
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

  function groupOfLayer(layer) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].layers.indexOf(layer) >= 0) return GROUPS[i].key;
    return GROUPS[0].key;
  }

  function create(opts) {
    var mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) throw new Error('ShopBuilder: mount not found');
    var S = { items: [], owned: {}, worn: {}, player: {}, group: 'card', previewId: null, pending: null, error: '', opts: opts };
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
    function groupItems(groupKey) {
      var g = GROUPS.filter(function (x) { return x.key === groupKey; })[0];
      if (!g) return [];
      return S.items.filter(function (it) { return g.layers.indexOf(it.layer) >= 0; })
        .sort(function (a, b) {
          return (g.layers.indexOf(a.layer) - g.layers.indexOf(b.layer)) || ((a.sort || 0) - (b.sort || 0));
        });
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
    // The card shows the previewed item on its layer, else the worn one.
    function shownOn(layer) {
      if (S.previewId) {
        var p = byId(S.previewId);
        if (p && p.layer === layer) return p;
      }
      var id = S.worn[layer];
      return id ? byId(id) : null;
    }
    function previewItem() { return S.previewId ? byId(S.previewId) : null; }

    function cardHtml() {
      var pl = S.player;
      var pv = previewItem();
      var layers = Object.keys(LAYER_LABEL).map(function (layer) {
        var it = shownOn(layer);
        return it ? '<div class="sb-layer pn-l-' + esc(it.layer) + '-' + esc(it.id) + '" aria-hidden="true"></div>' : '';
      }).join('');
      var flag = pv
        ? '<div class="sb-flag sb-flag-try">Previewing: ' + esc(pv.name) + '</div>'
        : '<div class="sb-flag">Your card</div>';
      return '<div class="sb-card" data-action="replay" role="img" aria-label="Your player card. Tap to replay the effects.">' +
        layers +
        '<div class="sb-card-body">' +
          '<div class="sb-card-top"><span class="sb-level">Level ' + esc(pl.level || 1) + '</span>' +
          '<span class="sb-coins">' + esc(pl.coins || 0) + ' coins</span></div>' +
          '<div class="sb-avatar">' + esc(pl.initials || '?') + '</div>' +
          '<div class="sb-name">' + esc(pl.name || 'Your name') + '</div>' +
          flag +
        '</div></div>';
    }

    // The five groups double as "On your card": each shows what is worn in it, or Nothing yet.
    function slotsHtml() {
      return GROUPS.map(function (g) {
        if (!groupItems(g.key).length) return '';
        var worn = [];
        g.layers.forEach(function (layer) {
          var id = S.worn[layer];
          var it = id ? byId(id) : null;
          if (it) worn.push(it.name);
        });
        var on = S.group === g.key;
        // r8: an empty part shows no "Nothing yet" text. It stays a tab (so the parts can still be opened) but reads as blank.
        var value = worn.length ? esc(worn.join(' + ')) : '';
        return '<button type="button" class="sb-slot' + (worn.length ? '' : ' is-empty') + '" role="tab" aria-selected="' + on + '" ' +
          'data-action="group" data-group="' + g.key + '">' +
          '<span class="sb-slot-k">' + esc(g.label) + '</span>' +
          '<span class="sb-slot-v">' + value + '</span></button>';
      }).join('');
    }

    function typesHtml() {
      var g = GROUPS.filter(function (x) { return x.key === S.group; })[0];
      if (!g) return '';
      return '<div class="sb-types">' + g.layers.filter(function (l) {
        return S.items.some(function (it) { return it.layer === l; });
      }).map(function (l) {
        return '<p><b>' + esc(LAYER_LABEL[l]) + '</b> ' + esc(WHAT[l]) + '</p>';
      }).join('') + '</div>';
    }

    function tileHtml(it) {
      var st = state(it);
      var label = { worn: 'Wearing', owned: 'Owned', locked: 'Locked', short: 'Need coins', open: 'Buy' }[st.key];
      var sub;
      if (st.key === 'locked') sub = st.req.text;
      else if (st.key === 'short') sub = st.need + ' more coins';
      else if (st.cost) sub = st.cost + ' coins';
      else sub = 'Free';
      var sel = S.previewId === it.id ? ' is-preview' : '';
      return '<button type="button" class="sb-tile sb-' + st.key + sel + '" data-action="preview" data-id="' + esc(it.id) + '" aria-pressed="' + (S.previewId === it.id) + '">' +
        '<span class="sb-tile-layer">' + esc(LAYER_LABEL[it.layer] || it.layer) + '</span>' +
        '<span class="sb-tile-name">' + esc(it.name) + '</span>' +
        '<span class="sb-tile-sub">' + esc(TIER_LABEL[it.tier] || it.tier) + ' · ' + esc(sub) + '</span>' +
        '<span class="sb-tile-state">' + esc(label) + '</span></button>';
    }

    function barHtml() {
      var it = previewItem();
      if (S.pending) {
        return '<div class="sb-bar-text" aria-live="polite"><b>' + esc(S.pending.name) + '</b><span>Saving…</span></div>' +
          '<button type="button" class="sb-btn" disabled>Saving…</button>';
      }
      if (!it) {
        return '<div class="sb-bar-text"><b>Tap an item</b><span>Tap any item to try it on your card.</span></div>' +
          '<button type="button" class="sb-btn" disabled>Pick one</button>';
      }
      var st = state(it);
      var line, btn;
      if (st.key === 'worn') {
        line = 'Wearing now';
        btn = '<button type="button" class="sb-btn" disabled>Wearing</button>';
      } else if (st.key === 'owned') {
        line = 'Owned. Not on your card yet.';
        btn = '<button type="button" class="sb-btn sb-btn-go" data-action="equip" data-id="' + esc(it.id) + '">Equip</button>';
      } else if (st.key === 'locked') {
        line = 'Locked: ' + st.req.text;
        btn = '<button type="button" class="sb-btn" disabled>Locked</button>';
      } else if (st.key === 'short') {
        line = 'You need ' + st.need + ' more coins';
        btn = '<button type="button" class="sb-btn" disabled>Buy ' + st.cost + '</button>';
      } else {
        line = 'Previewing. Not yours yet.';
        btn = '<button type="button" class="sb-btn sb-btn-go" data-action="buy" data-id="' + esc(it.id) + '">' +
          (st.cost ? 'Buy ' + st.cost : 'Claim') + '</button>';
      }
      var err = S.error ? '<span class="sb-err" role="alert">' + esc(S.error) + '</span>' : '';
      return '<div class="sb-bar-text" aria-live="polite"><b>' + esc(it.name) + '</b><span>' + esc(line) + '</span>' + err + '</div>' + btn;
    }

    // Runs onBuy/onEquip. The item only changes on success; a rejection leaves everything as it was.
    function runAction(kind, item, fn, applyLocally) {
      S.pending = { id: item.id, name: item.name };
      S.error = '';
      render();
      var p;
      try { p = Promise.resolve(typeof fn === 'function' ? fn(item) : undefined); }
      catch (e) { p = Promise.reject(e); }
      p.then(function () {
        S.pending = null;
        applyLocally();
        render();
        if (kind === 'buy' && global.ShopFx && !reducedMotion) global.ShopFx.unlock(mount.querySelector('.sb-card'));
      }, function (err) {
        S.pending = null;
        S.error = (err && typeof err.reason === 'string') ? err.reason
          : (typeof err === 'string') ? err
          : (err && err.message) ? err.message
          : (kind === 'buy' ? "Couldn't buy " : "Couldn't equip ") + item.name + '. Try again.';
        render();
      });
    }

    function render() {
      var list = groupItems(S.group);
      mount.innerHTML =
        '<section class="sb">' +
          '<h2 class="sb-title">Shop</h2>' +
          '<p class="sb-sub">Tap an item to try it on.</p>' +
          '<div class="sb-stick">' + cardHtml() + '</div>' +
          '<div class="sb-on-label">On your card</div>' +
          '<div class="sb-slots" role="tablist" aria-label="Card parts">' + slotsHtml() + '</div>' +
          typesHtml() +
          '<div class="sb-grid" role="tabpanel">' + (list.map(tileHtml).join('') || '<p class="sb-empty">Nothing here yet.</p>') + '</div>' +
          '<div class="sb-bar">' + barHtml() + '</div>' +
        '</section>';
    }

    mount.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-action]');
      if (!el || el.disabled) return;
      var a = el.getAttribute('data-action');
      if (a === 'group') {
        S.group = el.getAttribute('data-group');
        render();
      } else if (a === 'preview') {
        var id = el.getAttribute('data-id');
        S.previewId = S.previewId === id ? null : id;
        S.error = '';
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
      setLayer: function (layer) { S.group = groupOfLayer(layer); render(); },
      preview: function (id) { S.previewId = id; render(); },
      state: function (id) { var it = byId(id); return it ? state(it).key : null; }
    };
  }

  global.ShopBuilder = { init: create, requirement: requirement, costOf: costOf, groups: GROUPS, types: LAYER_LABEL };
})(typeof window !== 'undefined' ? window : this);
