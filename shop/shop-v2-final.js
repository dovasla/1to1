/* Card-builder shop. Runs inside the player app's shop frame: data and buys go through window.parent.PlayerShop (the app's own shop backend). */
(function () {
  'use strict';
  var host = null;
  try { host = window.parent !== window && window.parent.PlayerShop ? window.parent.PlayerShop : null; } catch (e) { host = null; }
  var backend = host ? host.get() : null;
  var ui = null;

  function toItem(i) {
    return {
      id: i.id, layer: i.layer, name: i.name, tier: i.tier || 'common', price: i.price || 0,
      sort: i.sort || 0, depth: i.depth || 0, effect: i.effect || 'none',
      unlock: { kind: i.unlockKind || 'level', minLevel: i.minLevel || 1, minStars: i.minStars || 0, badge: i.unlockName || null }
    };
  }
  function playerOf(st) {
    var name = '';
    try { name = host && typeof host.name === 'function' ? host.name() : ''; } catch (e) { name = ''; }
    return { name: name || 'You', initials: (name || 'You').split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase(),
      level: st.level, stars: st.stars, coins: st.coins, vip: !!st.vip, badges: [] };
  }
  function ownedOf(st) { return st.owned || []; }
  function wornOf(st) {
    var out = {};
    Object.keys(st.equipped || {}).forEach(function (k) { if (k.indexOf('l_') === 0 && st.equipped[k]) out[k.slice(2)] = st.equipped[k]; });
    return out;
  }
  function refresh(st) { ui.update({ owned: ownedOf(st), worn: wornOf(st), player: playerOf(st) }); }
  function failText(res, fallback) { return (res && res.error) || fallback; }

  function act(item) {
    return backend.act(item.id, '').then(function (res) {
      if (!res || !res.ok) throw new Error(failText(res, 'Could not save. Check the signal and try again.'));
      refresh(res.state);
      if (host && res.state && res.state.equipped) host.report(res.state.equipped);
      return res;
    });
  }

  function start() {
    if (!backend) {
      document.getElementById('builder').innerHTML = '<p style="padding:16px">Open the shop from the app.</p>';
      return;
    }
    backend.load().then(function (res) {
      if (!res || !res.ok) throw new Error(failText(res, 'Could not load the shop.'));
      var st = res.state;
      var items = (st.items || []).filter(function (i) { return i.layer && i.layer !== 'pose'; }).map(toItem);
      ui = ShopBuilder.init({
        mount: '#builder',
        items: items,
        owned: ownedOf(st),
        worn: wornOf(st),
        player: playerOf(st),
        onBuy: function (item) { return act(item); },
        onEquip: function (item) { return act(item); }
      });
      window.shopBuilder = ui;
      document.documentElement.setAttribute('data-shop-ready', '1');
    }).catch(function (e) {
      document.getElementById('builder').innerHTML = '<p style="padding:16px">' + String(e.message).replace(/[<>&]/g, '') + '</p>';
    });
  }
  start();
})();
