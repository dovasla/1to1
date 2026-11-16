/* Shop v2 screen (72n). Draws the layer tabs, tiles by tier, the preview sheet, buy and equip, and the loadout.
   Data: catalogue.js (items) and the backend (shop_state / shop_act via shop-backend.js). Rules: shop-rules-v2.js. */
(function () {
  'use strict';
  var C = window.ShopCatalogue;
  var R = window.ShopRulesV2;
  var B = window.ShopBackend;
  var host = null;
  try { host = window.parent !== window && window.parent.PlayerShop ? window.parent.PlayerShop : null; } catch (e) { host = null; }
  var backend = host ? host.get() : B.create(window.PLAYER_APP_CONFIG || { backend: 'mock', level: 12, stars: 3 },
    function () { return window.PLAYER_TOKEN || ''; });

  var SOON_LAYERS = ['flourish', 'ring', 'pose', 'intro', 'pop'];
  // Art layers first, then VIP, then the Coming soon layers last (desk ruling 72q).
  var TABS = ['background', 'frame', 'emblem', 'title', 'effect', 'name', 'card', 'row'].concat(['vip'], SOON_LAYERS);
  var TAB_LABEL = { vip: 'VIP' };
  var st = null;          // { items, player }
  var openTab = 'background';
  var openItem = null;
  var tryId = '';         // preview only, never saved
  var closeTimer = null;
  var takeArmed = false;  // Take all off asks once: first tap arms, second tap runs

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Read the server state (desk ruling 72n) with the catalogue as the fallback item list.
  function readPlayer(state) {
    var owned = {};
    if (Array.isArray(state.owned)) state.owned.forEach(function (id) { owned[id] = true; });
    else owned = state.owned || {};
    return {
      // Server items carry layer and tier (72n shape). Anything else (old 25-row mock) falls back to the catalogue.
      items: (function () {
        // The demo mock has no server list: it uses the catalogue. Live uses the server answer, old rows included.
        if (backend.kind === 'mock') return C.ITEMS;
        return (state.items || []).map(withLayer);
      })(),
      player: { name: state.name || '', level: state.level || 1, stars: state.stars || 0, coins: state.coins || 0,
        owned: owned, equipped: state.equipped || {}, vip: !!state.vip, badges: state.badges || {} }
    };
  }

  // Old rows get a tier from their price, or from stars when they have a prestige unlock (desk R344).
  function oldTier(raw) {
    var stars = raw.unlockKind === 'stars' ? (raw.unlockValue || raw.minStars || 0) : (raw.minStars || 0);
    if (stars > 0) return stars >= 4 ? 'legend' : 'epic';
    var p = raw.price || 0;
    return p >= 2000 ? 'epic' : (p >= 500 ? 'rare' : 'common');
  }

  // Old rows (no layer) keep working: each takes a layer from its slot, tier Common (desk: keep-list needs them).
  var SLOT_LAYER = { banner: 'background', name: 'name', calling: 'card', row: 'row', clan: 'title' };
  function withLayer(raw) {
    if (raw.layer && raw.tier) return raw;
    var out = Object.assign({}, raw);
    out.layer = raw.layer || SLOT_LAYER[raw.slot] || 'title';
    out.tier = raw.tier || oldTier(raw);
    out.name = raw.name || raw.label || raw.id;
    if (!raw.unlockKind) {
      if ((raw.minStars || 0) > 0) { out.unlockKind = 'stars'; out.unlockValue = raw.minStars; }
      else { out.unlockKind = 'level'; out.unlockValue = raw.minLevel || 1; }
    }
    return out;
  }

  function loadoutItem(id) { return id ? st.items.filter(function (i) { return i.id === id; })[0] : null; }

  // ---- 72p patch: real looks. Old rows draw through PlayerName, new layers through ShopFx. ----
  var PN = window.PlayerName;
  var FX = window.ShopFx;
  var ART_LAYERS = ['background', 'frame', 'emblem', 'title', 'effect', 'name', 'card', 'row'];
  var SLOT_PROP = { banner: 'banner', name: 'nameStyle', calling: 'callingCard', row: 'rowEffect', clan: 'clanTag' };

  // Old rows (slot + value) are drawn by PlayerName. New rows are drawn by shop-effects.js.
  // A tile with no art yet (layer not drawn, or an old row with no value) says Coming soon and cannot be bought.
  function hasArt(raw) {
    if (raw.slot) return !!raw.value;
    return ART_LAYERS.indexOf(raw.layer) !== -1;
  }
  function myName() {
    var fromHost = '';
    try { fromHost = host && host.name ? host.name() : ''; } catch (e) { fromHost = ''; }
    return (st && st.player && st.player.name) || fromHost || window.PLAYER_NAME || 'You';
  }
  function oldProps(slot, value) {
    var p = { name: PN.shortName(myName()), level: st ? st.player.level : 1, stars: st ? st.player.stars : 0 };
    if (SLOT_PROP[slot]) p[SLOT_PROP[slot]] = value;
    return p;
  }
  var NEW_GLYPH = { frame: '&#9645;', emblem: '&#9733;', title: 'Aa', effect: '&#8776;', name: 'Aa', card: '&#9646;', row: '&#9644;' };
  function artHtml(raw) {
    if (!hasArt(raw)) return '<span class="sample" aria-hidden="true"></span>';
    if (raw.slot && PN) return '<span class="sample" aria-hidden="true">' + PN.html(oldProps(raw.slot, raw.value)) + '</span>';
    if (raw.layer === 'background') return '<span class="sample fx-banner fx-sample" aria-hidden="true" data-fx-sample="' + esc(raw.id) + '">' +
      '<span class="fx-layer fx-bg"></span><span class="fx-layer fx-frame"></span></span>';
    // Frames, emblems, titles and the rest: a drawn sample (the effects module draws backgrounds only).
    return '<span class="sample s-' + esc(raw.layer) + '" aria-hidden="true"><span class="glyph">' + (NEW_GLYPH[raw.layer] || '') + '</span></span>';
  }
  function decorateArt(root) {
    if (!FX) return;
    (root || document).querySelectorAll('[data-fx-sample]').forEach(function (el) {
      var raw = st.items.filter(function (i) { return i.id === el.getAttribute('data-fx-sample'); })[0];
      if (raw) FX.apply(el, R.normalise(raw));
    });
  }

  // One banner painter for the shop top, the Try it view and the buy sheet. extra = an item to show on top (preview only).
  function paintBanner(el, extra) {
    if (!el || !st) return;
    var p = st.player;
    var worn = function (layer) {
      if (extra && extra.layer === layer) return extra;
      var it = loadoutItem(p.equipped[R.loadoutKey(layer)]);
      return it && hasArt(it) ? it : null;
    };
    var DEFAULT_BG = { id: 'default-bg', layer: 'background', tier: 'common', depth: 0, effect: 'none', name: 'Default banner' };
    var bg = worn('background') || DEFAULT_BG;
    var frame = worn('frame'), title = worn('title');
    el.setAttribute('data-tier', bg.tier || 'common');
    el.className = el.className.replace(/\bframe-\S+/g, '').trim() + (frame ? ' frame-' + (frame.tier || 'common') : '');
    el.innerHTML = '<div class="fx-banner fx-surface"><span class="fx-card">' +
      '<span class="fx-layer fx-bg"></span><span class="fx-layer fx-deep"></span><span class="fx-layer fx-deep2"></span>' +
      '<span class="fx-layer fx-sheen"></span><span class="fx-layer fx-frame"></span>' +
      '<span class="fx-layer fx-body"><span class="fx-emblem">&#9733;</span><span>' +
      '<span class="fx-title">' + esc(myName()) + '</span>' +
      '<span class="fx-word">' + esc(title ? title.name : (R.RARITY[bg.tier] || bg.tier)) + '</span>' +
      '</span></span></span></div>';
    if (FX && bg.layer === 'background') FX.apply(el.querySelector('.fx-surface'), R.normalise(bg));
  }

  function renderBanner() {
    var tryItem = tryId ? loadoutItem(tryId) : null;
    paintBanner($('banner'), tryItem);
    $('coins').textContent = String(st.player.coins);
  }

  function renderTabs() {
    $('tabs').innerHTML = TABS.map(function (t) {
      return '<button type="button" data-tab="' + t + '" aria-pressed="' + (t === openTab) + '">' + esc(TAB_LABEL[t] || R.LAYER_LABEL[t] || t) + '</button>';
    }).join('');
  }

  function renderCollection() {
    var c = R.collectionFor(openTab === 'vip' ? 'background' : openTab, st.items, st.player);
    var label = openTab === 'vip' ? 'VIP' : (R.LAYER_LABEL[openTab] || openTab);
    var soon = SOON_LAYERS.indexOf(openTab) !== -1;   // Coming-soon layers leave the count out (desk ruling 72q)
    $('collectLabel').textContent = soon ? 'Coming soon' : label;
    $('collectCount').textContent = soon ? '' : c.label;
    $('collectBar').style.width = (!soon && c.total) ? Math.round(100 * c.owned / c.total) + '%' : '0';
    var n = R.nextUnlock(st.items.filter(hasArt), st.player);   // only items that can be bought now
    $('nextLine').textContent = n ? 'Next unlock: ' + n.name + (n.cost ? ', ' + n.cost + ' coins' : '') + ' (' + n.need + ')' : '';
  }

  function tileHtml(raw) {
    var s = hasArt(raw) ? R.statusFor(raw, st.player) : { key: 'soon', text: 'Coming soon' };
    var it = R.normalise(raw);
    return '<button class="tile" type="button" data-id="' + esc(it.id) + '" data-tier="' + esc(it.tier) + '"' + (s.key === 'soon' ? ' data-soon="1" aria-disabled="true"' : '') + '>' +
      artHtml(raw) +
      '<span class="nm">' + esc(it.name) + '</span>' +
      '<span class="rw">' + esc(R.RARITY[it.tier] || it.tier) + '</span>' +
      '<span class="st">' + esc(s.text) + '</span></button>';
  }

  function renderGrid() {
    var items = st.items;
    var html;
    if (openTab === 'vip') {
      var vip = items.filter(function (i) { return R.normalise(i).unlockKind === 'vip'; });
      html = vip.length ? vip.map(tileHtml).join('') : '<p class="empty">No VIP items yet.</p>';
    } else {
      var list = items.filter(function (i) { return i.layer === openTab && R.normalise(i).unlockKind !== 'vip'; });
      list.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
      html = list.length ? list.map(tileHtml).join('') : '<p class="empty">Nothing in this section yet.</p>';
    }
    $('grid').innerHTML = '<div class="grid">' + html + '</div>';
    decorateArt($('grid'));
  }

  function renderLoadout() {
    var rows = R.loadoutRows(st.items, st.player, ['background', 'frame', 'emblem', 'title', 'effect', 'name', 'card', 'row']);
    $('loadout').innerHTML = rows.map(function (r) {
      return '<li><span>' + esc(r.label) + '</span><span class="muted">' + esc(r.itemName) + '</span>' +
        '<button type="button" data-change="' + esc(r.layer) + '">Change</button></li>';
    }).join('');
  }

  function renderAll() {
    try { if (host && host.report && st) host.report(st.player.equipped); } catch (e) { /* parent gone */ }
    renderBanner(); renderTabs(); renderCollection(); renderGrid(); renderLoadout();
  }

  function openSheet(id) {
    var raw = st.items.filter(function (i) { return i.id === id; })[0];
    if (!raw) return;
    openItem = raw;
    var it = R.normalise(raw);
    var s = hasArt(raw) ? R.statusFor(raw, st.player) : { key: 'soon', text: 'Coming soon' };
    $('sheetT').textContent = it.name;
    paintBanner($('sheetPreview'), raw);
    $('sheetRarity').textContent = R.RARITY[it.tier] || it.tier;
    $('sheetInfo').textContent = s.text;
    $('sheetErr').hidden = true;
    var buy = $('sheetBuy');
    buy.hidden = !(s.key === 'buyable' || s.key === 'free') || s.key === 'soon';
    buy.textContent = s.key === 'free' ? 'Equip for free' : 'Buy and equip';
    $('sheetEquip').hidden = s.key !== 'owned';
    $('sheetTry').hidden = s.key === 'soon' || s.key === 'equipped';
    $('sheetTry').hidden = s.key === 'equipped';
    $('sheet').hidden = false;
    $('scrim').hidden = false;
    requestAnimationFrame(function () { $('sheet').classList.add('open'); });
  }

  function closeSheet() {
    $('sheet').classList.remove('open');
    $('scrim').hidden = true;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () { $('sheet').hidden = true; }, 240);
    openItem = null;
  }

  function act() {
    if (!openItem || !hasArt(openItem)) return;
    var id = openItem.id;
    backend.act(id, '').then(function (res) {
      if (!res.ok) { $('sheetErr').textContent = res.error || 'Could not save. Try again.'; $('sheetErr').hidden = false; return; }
      st = readPlayer(res.state);
      tryId = '';
      closeSheet();
      renderAll();
    }, function () {
      $('sheetErr').textContent = 'Could not save. Check the signal and try again.';
      $('sheetErr').hidden = false;
    });
  }

  function showLoadError(msg) {
    $('loadErr').textContent = msg || 'Could not load the shop. Check the signal and try again.';
    $('loadErr').hidden = false;
    $('retry').hidden = false;
  }

  function load() {
    $('loadErr').hidden = true; $('retry').hidden = true;
    backend.load().then(function (res) {
      if (!res.ok) { showLoadError(res.error); return; }
      st = readPlayer(res.state);
      renderAll();
    }, function () { showLoadError(); });
  }

  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (!b) return;
    openTab = b.getAttribute('data-tab'); renderTabs(); renderCollection(); renderGrid();
  });
  $('grid').addEventListener('click', function (e) {
    var t = e.target.closest('.tile'); if (t) openSheet(t.getAttribute('data-id'));
  });
  $('loadout').addEventListener('click', function (e) {
    var b = e.target.closest('[data-change]'); if (!b) return;
    openTab = b.getAttribute('data-change'); renderTabs(); renderCollection(); renderGrid();
    window.scrollTo(0, 0);
  });
  $('sheetBuy').addEventListener('click', act);
  $('sheetEquip').addEventListener('click', act);
  $('sheetTry').addEventListener('click', function () {
    if (!openItem) return;
    tryId = openItem.id; closeSheet(); renderBanner();
  });
  $('sheetClose').addEventListener('click', closeSheet);
  $('scrim').addEventListener('click', closeSheet);
  $('retry').addEventListener('click', load);
  // Take all off: shop_act toggles an equipped item off, so one call per equipped item (the server has no clear-all call).
  $('takeAll').addEventListener('click', function () {
    if (!takeArmed) {
      takeArmed = true;
      $('takeAll').textContent = 'Tap again to take everything off';
      return;
    }
    takeArmed = false;
    $('takeAll').textContent = 'Take all off';
    var ids = Object.keys(st.player.equipped).map(function (k) { return st.player.equipped[k]; }).filter(Boolean);
    if (!ids.length) return;
    $('takeErr').hidden = true;
    ids.reduce(function (chain, id) {
      return chain.then(function (ok) {
        if (!ok) return false;
        return backend.act(id, '').then(function (res) {
          if (res.ok) st = readPlayer(res.state);
          return res.ok;
        }, function () { return false; });
      });
    }, Promise.resolve(true)).then(function (ok) {
      if (!ok) { $('takeErr').textContent = 'Could not take everything off. Check the signal and try again.'; $('takeErr').hidden = false; }
      renderAll();
    });
  });

  // Reduced motion: the OS setting only (the app has no Calm switch). Stops the Legend breathe and the sheet slide.
  try {
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    document.body.classList.toggle('calm', reduce);
  } catch (e) { /* no matchMedia: motion stays on */ }
  load();
})();
