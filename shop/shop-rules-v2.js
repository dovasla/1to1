/* Shop v2 rules (72n): pure functions for the tile status, unlock line and collection counts.
   Spec: revamp/review/shop-handoff/UI-SPEC.md sections 2, 6 and 8. No DOM here, so the node tests cover it.
   player: { level, stars, coins, owned: { id: true }, equipped: { layer: id }, vip: bool } */
(function (root) {
  'use strict';
  var RARITY = { common: 'Common', rare: 'Rare', epic: 'Epic', legend: 'Legend' };
  var LAYER_LABEL = {
    background: 'Background', frame: 'Frame', emblem: 'Emblem', title: 'Title', effect: 'Effect', name: 'Name',
    card: 'Card', flourish: 'Flourish', row: 'Row', ring: 'Ring', pose: 'Pose', intro: 'Intro', pop: 'Pop'
  };

  // Items come from shop_state (desk ruling 72n): unlockKind, unlockValue, unlockName, sort, tier, layer, depth, effect.
  // The catalogue file uses an unlock object; both shapes are read here.
  function normalise(raw) {
    var u = raw.unlock || {};
    var kind = raw.unlockKind || u.kind || 'level';
    var value = raw.unlockValue != null ? raw.unlockValue : (kind === 'level' ? u.minLevel : kind === 'stars' ? u.minStars : u.badge);
    return {
      id: raw.id, layer: raw.layer, name: raw.name, tier: raw.tier, price: raw.price || 0, sort: raw.sort || 0,
      depth: raw.depth || 0, effect: raw.effect || 'none',
      unlockKind: kind, unlockValue: value, unlockName: badgeTitle(kind, value, raw.unlockName || u.badgeLabel || '')
    };
  }

  // Badge names are the real achievement titles (player achievements list), keyed by achievement id.
  var BADGE_TITLES = { 'iron-10': 'Iron 10', 'wins-50': 'Fifty wins', 'mvp': 'MVP', 'points-200': 'Two hundred' };
  function badgeTitle(kind, value, fallback) {
    if (kind !== 'badge') return fallback;
    return BADGE_TITLES[value] || fallback;
  }

  // Loadout keys on the server are l_<layer> (desk ruling 72n).
  function loadoutKey(layer) { return 'l_' + layer; }

  function isVipItem(item) { return item.unlockKind === 'vip'; }

  // Why an item is locked for this player, or '' when it is open.
  function lockReason(raw, player) {
    var item = normalise(raw);
    if (item.unlockKind === 'level' && (player.level || 1) < (item.unlockValue || 1)) return 'Level ' + item.unlockValue;
    if (item.unlockKind === 'stars' && (player.stars || 0) < (item.unlockValue || 0)) return item.unlockValue + ' prestige stars';
    if (item.unlockKind === 'badge' && !(player.badges || {})[item.unlockName]) return 'Earn ' + (item.unlockName || 'a badge');
    if (item.unlockKind === 'vip' && !player.vip) return 'VIP only';
    return '';
  }

  // One status line per tile (UI-SPEC section 2). Order: owned and equipped first.
  function statusFor(raw, player) {
    var item = normalise(raw);
    var owned = !!(player.owned || {})[item.id];
    var eq = (player.equipped || {})[loadoutKey(item.layer)] === item.id;
    if (eq) return { key: 'equipped', text: 'On your card', buyable: false };
    if (owned) return { key: 'owned', text: 'Owned, tap to use', buyable: false };
    // A VIP sees every item as owned or free (desk ruling 72n).
    if (player.vip && !isVipItem(item)) return { key: 'free', text: 'Free for VIP', buyable: true };
    if (player.vip && isVipItem(item)) return { key: 'free', text: 'Free for VIP', buyable: true };
    var lock = lockReason(raw, player);
    if (isVipItem(item)) return { key: 'vip', text: 'VIP only', buyable: false };
    if (lock) return { key: 'locked', text: lock, buyable: false };
    var price = item.price || 0;
    if ((player.coins || 0) < price) return { key: 'short', text: 'Short by ' + (price - (player.coins || 0)), buyable: false };
    return { key: 'buyable', text: 'Buy, ' + price + ' coins', buyable: true };
  }

  // Collection line for one layer: owned over all items in that layer. VIP items count only for a VIP player.
  function collectionFor(layer, items, player) {
    var all = items.filter(function (i) {
      if (i.layer !== layer) return false;
      if (normalise(i).unlockKind === 'vip') return !!player.vip;
      return true;
    });
    var got = all.filter(function (i) { return !!(player.owned || {})[i.id]; }).length;
    return { owned: got, total: all.length, label: got + ' of ' + all.length + ' unlocked' };
  }

  // The cheapest item the player can work toward (UI-SPEC section 1, item 4). Null when nothing is left.
  function nextUnlock(items, player) {
    var best = null;
    items.forEach(function (raw) {
      var i = normalise(raw);
      if (i.unlockKind === 'vip' || i.unlockKind === 'badge') return;
      if (player.owned && player.owned[i.id]) return;
      if (lockReason(raw, player) === '' ) return;
      var cost = i.price || 0;
      if (!best || cost < best.cost) best = { id: i.id, name: i.name, cost: cost, need: lockReason(raw, player) };
    });
    return best;
  }

  // Loadout rows, one per layer in tab order (UI-SPEC section 5).
  function loadoutRows(items, player, layers) {
    return layers.map(function (layer) {
      var key = loadoutKey(layer);
      var id = (player.equipped || {})[key];
      var found = id ? items.filter(function (i) { return i.id === id; })[0] : null;
      return { layer: layer, label: LAYER_LABEL[layer] || layer, itemId: id || '', itemName: found ? found.name : 'Default' };
    });
  }

  var api = { RARITY: RARITY, LAYER_LABEL: LAYER_LABEL, normalise: normalise, loadoutKey: loadoutKey, lockReason: lockReason, statusFor: statusFor, collectionFor: collectionFor, nextUnlock: nextUnlock, loadoutRows: loadoutRows };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShopRulesV2 = api;
})(typeof window !== 'undefined' ? window : globalThis);
