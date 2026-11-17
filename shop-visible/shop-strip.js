/* Shop visibility (R149). Pure helpers for the Home Shop strip. No network, no storage.
   ShopStrip.line(state) picks ONE true line; ShopStrip.html(state) draws the strip. Hidden while a game is live. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // state: { coins, level, items: [{ id, slot, value, price, owned, minLevel | unlockLevel }], newLooks (bool), live (bool), name, stars }
  // Affordable = not owned and price within the coins. Locked = not owned and above the player's level.
  function counts(state) {
    var coins = Number(state.coins) || 0;
    var level = Number(state.level) || 0;
    var items = Array.isArray(state.items) ? state.items : [];
    var affordable = 0, nextLevel = null;
    items.forEach(function (it) {
      if (!it || it.owned) return;
      var price = Number(it.price) || 0;
      var unlock = Number(it.unlockLevel != null ? it.unlockLevel : it.minLevel) || 0;
      if (unlock > level) {
        if (nextLevel === null || unlock < nextLevel) nextLevel = unlock;
      } else if (price <= coins) {
        affordable += 1;
      }
    });
    return { affordable: affordable, nextLevel: nextLevel };
  }

  // The one line, in this order: can afford, next unlock, new looks. Nothing else. Returns '' when none is true.
  function line(state) {
    var c = counts(state || {});
    if (c.affordable > 0) return 'You can afford ' + c.affordable + (c.affordable === 1 ? ' look' : ' looks');
    if (c.nextLevel !== null) return 'Next look unlocks at Level ' + c.nextLevel;
    if (state && state.newLooks) return 'New looks added';
    return '';
  }

  // The next look the player can get: the cheapest unlocked look they can pay for; else the next one to unlock.
  // items carry { id, slot, value, name, price, owned, minLevel or unlockLevel }.
  function nextLook(state) {
    var coins = Number(state.coins) || 0, level = Number(state.level) || 0;
    var items = (Array.isArray(state.items) ? state.items : []).filter(function (it) { return it && !it.owned; });
    function unlockOf(it) { return Number(it.unlockLevel != null ? it.unlockLevel : it.minLevel) || 0; }
    var can = items.filter(function (it) { return unlockOf(it) <= level && (Number(it.price) || 0) <= coins; });
    can.sort(function (a, b) { return (Number(a.price) || 0) - (Number(b.price) || 0); });
    if (can.length) return can[0];
    var later = items.filter(function (it) { return unlockOf(it) > level; });
    later.sort(function (a, b) { return unlockOf(a) - unlockOf(b); });
    return later[0] || null;
  }

  // A real look drawn by PlayerName (the same lib the player card uses). Returns '' if PlayerName is missing.
  var SLOT_PROP = { banner: 'banner', name: 'nameStyle', calling: 'callingCard', row: 'rowEffect', clan: 'clanTag' };
  function lookHtml(item, state) {
    var PN = window.PlayerName;
    if (!PN || !item || !SLOT_PROP[item.slot]) return '';
    var props = { name: state.name || 'You', level: Number(state.level) || 1, stars: Number(state.stars) || 0, size: 'compact' };
    props[SLOT_PROP[item.slot]] = item.value;
    try { return PN.html(props); } catch (e) { return ''; }
  }

  // The worn card: the player's own look (banner, name, row, and every worn layer), drawn by PlayerName.
  function wornHtml(state) {
    var PN = window.PlayerName, w = state && state.worn;
    if (!PN || !w || (!w.banner && !w.nameStyle && !w.rowEffect && !(w.layers && Object.keys(w.layers).length))) return '';
    var props = { name: state.name || 'You', level: Number(state.level) || 1, stars: Number(state.stars) || 0, size: 'compact',
      banner: '', nameStyle: w.nameStyle || '', rowEffect: w.rowEffect || '', layers: w.layers || {} };
    try { return PN.html(props); } catch (e) { return ''; }
  }

  // The strip. Hidden (returns '') while a game is live. One tap opens the Shop (#shop).
  // The picture is the next look (lookHtml). If there is no real look to draw, there is no picture box at all.
  function html(state) {
    if (!state || state.live) return '';
    var coins = Number(state.coins) || 0;
    var ln = line(state);
    var pic = wornHtml(state) || lookHtml(nextLook(state), state);
    return '<a class="sv-strip" href="#shop" data-go="shop" aria-label="Shop, ' + esc(coins) + ' coins">' +
      (pic ? '<span class="sv-pic" aria-hidden="true">' + pic + '</span>' : '') +
      '<span class="sv-body"><b class="sv-title">Shop</b>' +
      (ln ? '<span class="sv-line">' + esc(ln) + '</span>' : '') + '</span>' +
      '</a>';
  }

  // After a run, where earned coins are shown: the line ends with this link (R149).
  function spendLink() {
    return ' <a class="sv-spend" href="#shop" data-go="shop">Spend them in the Shop</a>';
  }

  window.ShopStrip = { counts: counts, line: line, nextLook: nextLook, lookHtml: lookHtml, html: html, spendLink: spendLink };
})();
