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
      sort: i.sort || 0, depth: i.depth || 0, effect: i.effect || 'none', endsAt: i.availableUntil || null,
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

  // 3.1: the climb lives in this same shop screen, under the looks. Coins from picks update the shop balance.
  function mountClimb(st) {
    var el = document.getElementById('climb');
    if (!el || !window.ShopClimb || !window.PlayerName || !backend.climbState) return;
    var climb = ShopClimb.mount(el, {
      name: playerOf(st).name,
      onAction: function (a) {
        return backend.climbAct(a).then(function (r) {
          if (r.state) backend.load().then(function (s) { if (s && s.ok) refresh(s.state); });
          return r;
        });
      }
    });
    backend.climbState().then(function (r) {
      if (!r.ok) { el.parentNode.hidden = true; return; }
      climb.setState({ level: r.climb.level, climb: r.climb });
    });
  }

  // Crew panel: join or make a crew, members, weekly board. Hidden if the crew RPCs are not on the server yet.
  function mountCrew() {
    var el = document.getElementById('crew');
    if (!el || !window.ShopCrew || !backend.crewState) return;
    var wrap = document.getElementById('crew-wrap');
    var panel = ShopCrew.mount(el, {
      onAct: function (a) { return backend.crewAct(a); },
      onChanged: function () { backend.crewBoard().then(function (b) { if (b.ok) panel.setState({ board: b.board }); }); }
    });
    backend.crewState().then(function (r) {
      if (!r.ok) { if (wrap) wrap.hidden = true; return; }
      if (wrap) wrap.hidden = false;
      panel.setState({ crew: r.crew });
      return backend.crewBoard();
    }).then(function (b) {
      if (b && b.ok) panel.setState({ board: b.board });
      else if (b && !b.ok && wrap) wrap.hidden = true;
    });
  }

  // Events, bounty and trophies above the crew panel. Hidden if the extras RPC is not on the server yet.
  function mountExtras() {
    var el = document.getElementById('extras');
    if (!el || !window.ShopExtras || !backend.extrasState) return;
    var panel = ShopExtras.mount(el);
    backend.extrasState().then(function (r) {
      if (r.ok) panel.setState(r.data); else el.hidden = true;
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
      mountClimb(st);
      mountCrew();
      mountExtras();
    }).catch(function (e) {
      document.getElementById('builder').innerHTML = '<p style="padding:16px">' + String(e.message).replace(/[<>&]/g, '') + '</p>';
    });
  }
  start();
})();
