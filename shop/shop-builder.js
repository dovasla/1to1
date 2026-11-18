// shop-builder.js (r13): the shop screen. Plain, one screen: a preview card on top, three tabs (Name, Banner, Frame),
// a swatch grid, and one action button. Same API as before: ShopBuilder.init({ mount, items, owned, worn, player, onBuy, onEquip })
// then update({ owned, worn, player, items }). Server item ids and coin logic are unchanged.
(function (global) {
  'use strict';

  // Three tabs. Each owns one item layer. Other layers still show when worn (see cardHtml).
  var GROUPS = [
    { key: 'name', label: 'Name', layer: 'name', hint: 'Your name, everywhere in the app.' },
    { key: 'banner', label: 'Banner', layer: 'background', hint: 'A band behind your card.' },
    { key: 'frame', label: 'Frame', layer: 'frame', hint: 'A ring around your card.' }
  ];
  var TIER_LABEL = { common: 'Common', rare: 'Rare', epic: 'Epic', legend: 'Legend' };
  var LAYER_LABEL = {
    background: 'Banner', card: 'Card face', name: 'Name effect', emblem: 'Badge', title: 'Title shine',
    frame: 'Frame', ring: 'Avatar ring', row: 'Board row', effect: 'Glow', flourish: 'Corner flourish',
    pop: 'Score pop', intro: 'Load-in'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function costOf(item) {
    var k = (item.unlock || {}).kind;
    return (k === 'level' || k === 'stars') ? (item.price || 0) : 0;
  }

  // Plain words for why an item is locked. Returns { ok, text }.
  function requirement(item, player) {
    var u = item.unlock || {};
    var p = player || {};
    if (u.kind === 'vip') return { ok: !!p.vip, text: 'VIP only' };
    if (u.kind === 'badge') {
      var badge = u.badge || item.name;
      var have = (p.badges || []).indexOf(item.id) >= 0 || (p.badges || []).indexOf(badge) >= 0;
      return { ok: have, text: 'Earn ' + badge };
    }
    if (u.kind === 'stars') {
      return { ok: (p.stars || 0) >= (u.minStars || 0), text: u.minStars + ' stars' };
    }
    if ((p.level || 0) < (u.minLevel || 0)) return { ok: false, text: 'Level ' + u.minLevel };
    if ((p.stars || 0) < (u.minStars || 0)) return { ok: false, text: u.minStars + ' stars' };
    return { ok: true, text: 'Open' };
  }

  function groupOfLayer(layer) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].layer === layer) return GROUPS[i].key;
    return GROUPS[0].key;
  }

  function create(opts) {
    var mount = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) throw new Error('ShopBuilder: mount not found');
    var S = { items: [], owned: {}, worn: {}, player: {}, group: 'name', previewId: null, pending: null, error: '', resetArmed: false, opts: opts };

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
      return S.items.filter(function (it) { return it.layer === g.layer; })
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

    // Reset all: the ids worn on the three tab looks (name, banner, frame). Owned items are never removed.
    function resettable() {
      return GROUPS.map(function (g) { return S.worn[g.layer]; }).filter(Boolean);
    }
    // Header button: first tap arms it, second tap resets. Greyed out when nothing is worn on those looks.
    function resetHtml() {
      var n = resettable().length;
      var armed = S.resetArmed && n > 0;
      var off = n === 0 || !!S.pending || !S.opts.onEquip;
      return '<button type="button" class="sb-reset' + (armed ? ' is-armed' : '') + '" data-action="reset-tap"' +
        (off ? ' disabled' : '') + '>' + (armed ? 'Tap again to reset' : 'Reset all') + '</button>';
    }
    function resetHintHtml() {
      return (S.resetArmed && resettable().length)
        ? '<p class="sb-hint" aria-live="polite">Name, banner and frame go back to default. Owned items stay yours.</p>'
        : '';
    }

    // Preview card: name look on the name text, banner and frame as overlays. Other worn layers still show.
    function cardHtml() {
      var pl = S.player;
      var pv = previewItem();
      var nameIt = shownOn('name');
      var layers = Object.keys(LAYER_LABEL).filter(function (layer) { return layer !== 'name'; }).map(function (layer) {
        var it = shownOn(layer);
        return it ? '<div class="sb-layer pn-l-' + esc(it.layer) + '-' + esc(it.id) + '" aria-hidden="true"></div>' : '';
      }).join('');
      return '<div class="sb-card">' + layers +
        '<div class="sb-card-body">' +
          '<div class="sb-avatar">' + esc(pl.initials || '?') + '</div>' +
          '<div class="sb-name' + (nameIt ? ' pn-l-name-' + esc(nameIt.id) : '') + '">' + esc(pl.name || 'You') + '</div>' +
          '<div class="sb-meta">Level ' + esc(pl.level || 1) + ' · ' + esc(pl.coins || 0) + ' coins</div>' +
          (pv ? '<div class="sb-try">Trying: ' + esc(pv.name) + '</div>' : '') +
        '</div></div>';
    }

    function tabsHtml() {
      return GROUPS.map(function (g) {
        var on = S.group === g.key;
        var all = groupItems(g.key);
        var have = all.filter(function (it) { return !!S.owned[it.id]; }).length;
        return '<button type="button" class="sb-tab' + (on ? ' is-on' : '') + '" role="tab" aria-selected="' + on + '" ' +
          'data-action="group" data-group="' + g.key + '">' + esc(g.label) +
          ' <span class="sb-tab-n">' + have + '/' + all.length + '</span></button>';
      }).join('');
    }

    // One tile: a visual swatch (the real look), a tier stripe, and a small price chip. No long text.
    function tileHtml(it) {
      var st = state(it);
      var g = GROUPS.filter(function (x) { return x.key === S.group; })[0];
      var sel = S.previewId === it.id ? ' is-preview' : '';
      var chip;
      if (st.key === 'worn') chip = '<span class="sb-chip sb-chip-on">On</span>';
      else if (st.key === 'owned') chip = '<span class="sb-chip">Owned</span>';
      else if (st.key === 'locked') chip = '<span class="sb-chip sb-chip-lock">' + esc(st.req.text) + '</span>';
      else chip = '<span class="sb-chip sb-chip-coin">' + (st.cost ? st.cost : 'Free') + '</span>';
      var label = g.key === 'name'
        ? '<span class="sb-name sb-swatch-name pn-l-name-' + esc(it.id) + '">Jordan</span>'
        : '<span class="sb-swatch-blank" aria-hidden="true"></span>';
      var look = g.key === 'name' ? '' : ' pn-l-' + esc(it.layer) + '-' + esc(it.id);
      return '<button type="button" class="sb-tile sb-tier-' + esc(it.tier || 'common') + ' sb-' + st.key + sel + look + '" ' +
        'data-action="preview" data-id="' + esc(it.id) + '" aria-pressed="' + (S.previewId === it.id) + '" ' +
        'aria-label="' + esc(it.name + ', ' + (TIER_LABEL[it.tier] || it.tier)) + '">' +
        '<span class="sb-tier-bar" aria-hidden="true"></span>' +
        label + chip + '<span class="sb-tile-name">' + esc(it.name) + '</span></button>';
    }

    // The one action button, always under the grid.
    function barHtml() {
      var it = previewItem();
      if (S.pending) {
        return '<button type="button" class="sb-btn" disabled>Saving…</button>';
      }
      if (!it) {
        var msg = S.error ? '<span class="sb-err" role="alert">' + esc(S.error) + '</span>' : 'Tap a swatch to try it on.';
        return '<p class="sb-bar-text" aria-live="polite">' + msg + '</p>';
      }
      var st = state(it);
      var line = '', btn = '';
      if (st.key === 'worn') {
        line = 'Wearing'; btn = '<button type="button" class="sb-btn" disabled>Wearing</button>';
      } else if (st.key === 'owned') {
        line = it.name; btn = '<button type="button" class="sb-btn sb-btn-go" data-action="equip" data-id="' + esc(it.id) + '">Equip</button>';
      } else if (st.key === 'locked') {
        line = 'Locked: ' + st.req.text; btn = '<button type="button" class="sb-btn" disabled>Locked</button>';
      } else if (st.key === 'short') {
        line = 'You need ' + st.need + ' more coins'; btn = '<button type="button" class="sb-btn" disabled>Buy ' + st.cost + '</button>';
      } else {
        line = it.name; btn = '<button type="button" class="sb-btn sb-btn-go" data-action="buy" data-id="' + esc(it.id) + '">' +
          (st.cost ? 'Buy · ' + st.cost : 'Claim') + '</button>';
      }
      var err = S.error ? '<span class="sb-err" role="alert">' + esc(S.error) + '</span>' : '';
      return '<p class="sb-bar-text" aria-live="polite">' + esc(line) + err + '</p>' + btn;
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
      }, function (err) {
        S.pending = null;
        S.error = (err && typeof err.reason === 'string') ? err.reason
          : (typeof err === 'string') ? err
          : (err && err.message) ? err.message
          : (kind === 'buy' ? "Couldn't buy " : "Couldn't equip ") + item.name + '. Try again.';
        render();
      });
    }

    // Takes each worn name, banner and frame off, one after another. onEquip on a worn item is the server's
    // toggle (same call as tapping Equip off). Each step checks the item is still worn before it runs.
    // Owned items are never removed.
    function runReset() {
      var items = resettable().map(byId).filter(Boolean);
      if (!items.length || !S.opts.onEquip) return;
      S.resetArmed = false;
      S.pending = { id: 'reset', name: 'reset' };
      S.error = '';
      render();
      var p = items.reduce(function (chain, it) {
        return chain.then(function () {
          if (S.worn[it.layer] !== it.id) return null;
          return Promise.resolve(S.opts.onEquip(it));
        });
      }, Promise.resolve());
      p.then(function () {
        S.pending = null;
        GROUPS.forEach(function (g) { delete S.worn[g.layer]; });
        render();
      }, function (err) {
        S.pending = null;
        S.error = (err && err.message) ? err.message : "Couldn't reset. Try again.";
        render();
      });
    }

    function render() {
      var list = groupItems(S.group);
      mount.innerHTML =
        '<section class="sb">' +
          '<header class="sb-head"><h2 class="sb-title">Shop</h2>' +
          '<div class="sb-head-r"><span class="sb-coins">' + esc(S.player.coins || 0) + ' coins</span>' + resetHtml() + '</div></header>' +
          '<div class="sb-stage">' + cardHtml() + '</div>' +
          '<div class="sb-tabs" role="tablist" aria-label="Shop categories">' + tabsHtml() + '</div>' +
          resetHintHtml() +
          '<div class="sb-grid" role="tabpanel">' + (list.map(tileHtml).join('') || '<p class="sb-empty">Nothing here yet.</p>') + '</div>' +
        '</section>' +
        '<div class="sb-bar">' + barHtml() + '</div>';
    }

    mount.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-action]');
      if (!el || el.disabled) return;
      var a = el.getAttribute('data-action');
      if (a !== 'reset-tap') S.resetArmed = false;
      if (a === 'reset-tap') {
        if (S.pending) return;
        if (!S.resetArmed) { S.resetArmed = true; render(); return; }
        runReset();
      } else if (a === 'group') {
        S.group = el.getAttribute('data-group');
        render();
      } else if (a === 'preview') {
        var id = el.getAttribute('data-id');
        S.previewId = S.previewId === id ? null : id;
        S.error = '';
        render();
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
      update: function (patch) { setData(patch || {}); render(); },
      setLayer: function (layer) { S.group = groupOfLayer(layer); render(); },
      preview: function (id) { S.previewId = id; render(); },
      state: function (id) { var it = byId(id); return it ? state(it).key : null; }
    };
  }

  global.ShopBuilder = { init: create, requirement: requirement, costOf: costOf, groups: GROUPS, types: LAYER_LABEL };
})(typeof window !== 'undefined' ? window : this);
