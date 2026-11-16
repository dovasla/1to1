/* Shop v2 screen (72s). Tap any item: the banner on top shows it at once. One Buy bar underneath.
   Eligibility (level, stars, badge, VIP, coins) is checked only when the player taps Buy.
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
  var st = null;        // { items, player }
  var openTab = 'background';
  var picked = '';      // item id the player tapped last (preview + Buy bar)
  var busy = false;     // a save is running
  var takeArmed = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Read the server state (desk ruling 72n) with the catalogue as the fallback item list.
  function readPlayer(state) {
    var owned = {};
    if (Array.isArray(state.owned)) state.owned.forEach(function (id) { owned[id] = true; });
    else owned = state.owned || {};
    return {
      items: (function () {
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
  function findItem(id) { return id ? st.items.filter(function (i) { return i.id === id; })[0] : null; }

  // ---- Art. Old rows draw through PlayerName, new layers through ShopFx. ----
  var PN = window.PlayerName;
  var FX = window.ShopFx;
  var ART_LAYERS = ['background', 'frame', 'emblem', 'title', 'effect', 'name', 'card', 'row'];
  var SLOT_PROP = { banner: 'banner', name: 'nameStyle', calling: 'callingCard', row: 'rowEffect', clan: 'clanTag' };

  // A tile with no art yet says Coming soon and has no price or Buy.
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
    return '<span class="sample s-' + esc(raw.layer) + '" aria-hidden="true"><span class="glyph">' + (NEW_GLYPH[raw.layer] || '') + '</span></span>';
  }
  function decorateArt(root) {
    if (!FX) return;
    (root || document).querySelectorAll('[data-fx-sample]').forEach(function (el) {
      var raw = findItem(el.getAttribute('data-fx-sample'));
      if (raw) FX.apply(el, R.normalise(raw));
    });
  }

  // One banner painter for the top preview. extra = the tapped item, shown in its layer (preview only, never saved).
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
    // 72t: every art layer shows on the top banner. Each worn item adds a pv-<layer> class, tinted by its tier.
    var emblem = worn('emblem'), name = worn('name'), card = worn('card'), effect = worn('effect'), row = worn('row');
    var pv = [['emblem', emblem], ['name', name], ['card', card], ['effect', effect], ['row', row]];
    el.className = el.className.replace(/\bframe-\S+/g, '').replace(/\bpv-\S+/g, '').trim() + (frame ? ' frame-' + (frame.tier || 'common') : '');
    pv.forEach(function (pair) { if (pair[1]) el.classList.add('pv-' + pair[0], 'pv-tier-' + (pair[1].tier || 'common')); });
    if (extra && extra.id) el.setAttribute('data-preview', extra.id);
    var glyph = emblem ? esc(String(emblem.name || '').charAt(0) || '\u2605') : '&#9733;';
    el.innerHTML = '<div class="fx-banner fx-surface"><span class="fx-card">' +
      '<span class="fx-layer fx-bg"></span><span class="fx-layer fx-deep"></span><span class="fx-layer fx-deep2"></span>' +
      '<span class="fx-layer fx-sheen"></span><span class="fx-layer fx-frame"></span>' +
      '<span class="fx-layer fx-body"><span class="fx-emblem">' + glyph + '</span><span>' +
      '<span class="fx-title">' + esc(myName()) + '</span>' +
      '<span class="fx-word">' + esc(title ? title.name : (R.RARITY[bg.tier] || bg.tier)) + '</span>' +
      (extra && extra.layer !== 'background' ? '<span class="pv-tag">' + esc(R.LAYER_LABEL[extra.layer] || extra.layer) + ': ' + esc(extra.name || '') + '</span>' : '') +
      '</span></span></span></div>';
    if (FX && bg.layer === 'background') FX.apply(el.querySelector('.fx-surface'), R.normalise(bg));
  }

  // Tile status: short and calm. No eligibility here; that is checked only on Buy.
  function tileStatus(raw) {
    if (!hasArt(raw)) return { key: 'soon', text: 'Coming soon' };
    var it = R.normalise(raw);
    var p = st.player;
    if (p.equipped[R.loadoutKey(it.layer)] === it.id) return { key: 'equipped', text: 'On your look' };
    if (p.owned[it.id]) return { key: 'owned', text: 'Owned' };
    if (p.vip) return { key: 'free', text: 'Free for VIP' };
    if (it.unlockKind === 'vip') return { key: 'vip', text: 'VIP only' };
    return { key: 'price', text: it.price ? it.price + ' coins' : 'Free' };
  }

  function renderBanner() {
    var pickedItem = picked ? findItem(picked) : null;
    paintBanner($('banner'), pickedItem && hasArt(pickedItem) ? pickedItem : null);
    $('coins').textContent = String(st.player.coins);
    var line = '';
    if (pickedItem && tileStatus(pickedItem).key === 'equipped') {
      line = 'On your look: ' + R.normalise(pickedItem).name;
    } else if (pickedItem) {
      line = hasArt(pickedItem)
        ? 'Preview: ' + R.normalise(pickedItem).name + ' (' + (R.RARITY[pickedItem.tier] || pickedItem.tier) + ')'
        : 'No look yet for ' + R.normalise(pickedItem).name + '.';
    } else {
      line = 'Your look now. Tap any item to preview it.';
    }
    $('previewLine').textContent = line;
  }

  // The Buy bar: one button, one line of info. Coming soon items get no button.
  function renderBuyBar() {
    var bar = $('buybar');
    var raw = picked ? findItem(picked) : null;
    $('buyErr').hidden = true;
    if (!raw) {
      $('buyName').textContent = 'Pick an item';
      $('buyInfo').textContent = 'Tap any item above to see it here.';
      $('buyBtn').hidden = true;
      $('buyBack').hidden = true;
      return;
    }
    var it = R.normalise(raw);
    var s = tileStatus(raw);
    $('buyName').textContent = hasArt(raw) ? it.name : it.name + ' (coming soon)';
    $('buyInfo').textContent = (R.RARITY[it.tier] || it.tier) + ' · ' + s.text;
    var btn = $('buyBtn');
    var show = hasArt(raw) && s.key !== 'equipped';
    btn.hidden = !show;
    if (show) {
      if (s.key === 'owned') btn.textContent = 'Wear it';
      else if (s.key === 'free') btn.textContent = 'Get it free';
      else if (s.key === 'vip') btn.textContent = 'Unlock with VIP';
      else btn.textContent = 'Buy, ' + it.price + ' coins';
    }
    $('buyBack').hidden = !picked || (findItem(picked) && tileStatus(findItem(picked)).key === 'equipped');
    btn.disabled = busy;
    bar.setAttribute('data-state', s.key);
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
    var n = R.nextUnlock(st.items.filter(hasArt), st.player);
    $('nextLine').textContent = n ? 'Next unlock: ' + n.name + (n.cost ? ', ' + n.cost + ' coins' : '') + ' (' + n.need + ')' : '';
  }

  function tileHtml(raw) {
    var s = tileStatus(raw);
    var it = R.normalise(raw);
    var on = raw.id === picked;
    return '<button class="tile" type="button" data-id="' + esc(it.id) + '" data-tier="' + esc(it.tier) + '"' +
      (s.key === 'soon' ? ' data-soon="1"' : '') + (on ? ' aria-pressed="true" data-on="1"' : ' aria-pressed="false"') + '>' +
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
    renderBanner(); renderTabs(); renderCollection(); renderGrid(); renderLoadout(); renderBuyBar();
  }

  function showBuyError(msg) {
    $('buyErr').textContent = msg;
    $('buyErr').hidden = false;
  }

  // Buy / Wear: eligibility is checked here, on the tap, and the server checks again.
  function buy() {
    var raw = picked ? findItem(picked) : null;
    if (!raw || !hasArt(raw) || busy) return;
    var s = tileStatus(raw);
    if (s.key === 'equipped') return;
    if (s.key !== 'owned') {
      var why = R.buyCheck(raw, st.player);
      if (why) { showBuyError(why); return; }
    }
    busy = true;
    $('buyBtn').disabled = true;
    backend.act(raw.id, '').then(function (res) {
      busy = false;
      if (!res.ok) { showBuyError(res.error || 'Could not save. Try again.'); $('buyBtn').disabled = false; return; }
      st = readPlayer(res.state);
      renderAll();
    }, function () {
      busy = false;
      showBuyError('Could not save. Check the signal and try again.');
      $('buyBtn').disabled = false;
    });
  }

  function pick(id) {
    picked = id;
    renderAll();
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
    var t = e.target.closest('.tile'); if (t) pick(t.getAttribute('data-id'));
  });
  $('loadout').addEventListener('click', function (e) {
    var b = e.target.closest('[data-change]'); if (!b) return;
    openTab = b.getAttribute('data-change'); renderTabs(); renderCollection(); renderGrid();
    window.scrollTo(0, 0);
  });
  $('buyBtn').addEventListener('click', buy);
  $('buyBack').addEventListener('click', function () { picked = ''; renderAll(); });
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

  // Reduced motion: the OS setting only (the app has no Calm switch). Stops the Legend breathe.
  try {
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    document.body.classList.toggle('calm', reduce);
  } catch (e) { /* no matchMedia: motion stays on */ }
  load();
})();
