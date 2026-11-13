/* Shop rules: pure functions, no DOM, no storage. The server (supabase/shop-server.sql) is the truth.
   These mirror its checks so the mock backend and the preview behave the same.
   Node: require('./shop-rules.js'). Browser: window.ShopRules. Tests: node tests/shop-rules.test.js */
(function (root) {
  'use strict';

  var SLOTS = ['banner', 'name', 'calling', 'row', 'clan'];

  // Keep in step with _shop_blocked_tags() in supabase/shop-server.sql.
  // Tags are cut to 4 characters, so these are the 4-character forms.
  var BLOCKED_TAGS = ['ADMI', 'MOD', 'MODS', 'STAF', 'ORG', 'JORD', '1TO1', 'OWNE', 'SUPP',
    'NIGG', 'NIGA', 'FAGG', 'FAG', 'KKK', 'NAZI', 'HITL', 'FUCK', 'SHIT', 'CUNT',
    'BITC', 'SEX', 'PORN', 'RAPE'];

  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  // Coins ever earned. 10 x each new level in a run, 18,290 per full run (one per star), 1,000 per star.
  function levelCoins(level) {
    var l = Math.max(1, level | 0);
    return 10 * (l * (l + 1) / 2 - 1);
  }
  function earned(level, stars) {
    return (stars | 0) * (18290 + 1000) + levelCoins(level);
  }

  // Clan tags: letters and numbers only, capitals, up to 4.
  function clean(t) {
    return String(t == null ? '' : t).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4);
  }
  function validTag(t) { return t.length >= 2 && t.length <= 4; }
  function blockedTag(t) { return BLOCKED_TAGS.indexOf(t) >= 0; }

  function clamp(n, lo, hi) {
    var v = parseInt(n, 10);
    if (isNaN(v)) v = lo;
    return Math.min(hi, Math.max(lo, v));
  }

  // Takes the server's state (or a mock's) and makes it safe to read.
  function normalise(raw) {
    raw = raw || {};
    var equipped = {};
    SLOTS.forEach(function (s) { equipped[s] = (raw.equipped && raw.equipped[s]) || null; });
    var owned = [];
    (raw.owned || []).forEach(function (id) { if (owned.indexOf(id) < 0) owned.push(id); });
    var items = (raw.items || []).map(function (i) {
      return { id: i.id, slot: i.slot, value: i.value, name: i.name, price: i.price | 0,
        minLevel: i.minLevel | 0, minStars: i.minStars | 0 };
    });
    return {
      level: clamp(raw.level || 1, 1, 60),
      stars: clamp(raw.stars || 0, 0, 5),
      coins: Math.max(0, parseInt(raw.coins, 10) || 0),
      owned: owned,
      equipped: equipped,
      clanTag: clean(raw.clanTag),
      items: items
    };
  }

  function byId(st, id) {
    for (var i = 0; i < st.items.length; i++) if (st.items[i].id === id) return st.items[i];
    return null;
  }

  // 'locked' | 'short' (not enough coins) | 'buy' | 'use' (owned, not on) | 'on'
  function status(item, st) {
    if (st.stars < item.minStars || st.level < item.minLevel) return 'locked';
    if (st.owned.indexOf(item.id) >= 0) return st.equipped[item.slot] === item.id ? 'on' : 'use';
    return st.coins >= item.price ? 'buy' : 'short';
  }

  function lockText(item, st) {
    if (st.stars < item.minStars) {
      return 'Unlocks at ' + item.minStars + (item.minStars === 1 ? ' prestige star' : ' prestige stars');
    }
    return 'Unlocks at level ' + item.minLevel;
  }

  function fail(st, error) { return { ok: false, state: st, error: error }; }

  // Mirror of shop_act(): one tap does the next step.
  function act(st, id, tag) {
    var it = byId(st, id);
    if (!it) return fail(st, 'Unknown item');
    var s = status(it, st);
    if (s === 'locked') return fail(st, lockText(it, st));
    var next = copy(st);
    var message;
    if (s === 'on') {
      next.equipped[it.slot] = null;
      message = 'Taken off.';
      return { ok: true, state: next, message: message };
    }
    if (it.slot === 'clan') {
      var t = clean(tag);
      if (t.length < 2) return fail(st, 'Type a 2 to 4 letter or number tag first');
      if (blockedTag(t)) return fail(st, 'That tag is not allowed');
      next.clanTag = t;
    }
    if (s === 'short') return fail(st, 'You need ' + (it.price - st.coins) + ' more coins');
    if (s === 'buy') {
      next.coins -= it.price;
      next.owned.push(id);
      message = 'Bought. It is on your card.';
    } else {
      message = 'On your card.';
    }
    next.equipped[it.slot] = id;
    return { ok: true, state: next, message: message };
  }

  // Props for PlayerName. override = {slot, id, tag} previews one item on top of the equipped look.
  function look(st, override) {
    var eq = copy(st.equipped);
    var tag = st.clanTag;
    if (override) {
      eq[override.slot] = override.id;
      if (override.slot === 'clan') tag = clean(override.tag);
    }
    function val(slot) {
      var it = eq[slot] ? byId(st, eq[slot]) : null;
      return it ? it.value : '';
    }
    return {
      banner: val('banner'),
      nameStyle: val('name'),
      callingCard: val('calling'),
      rowEffect: val('row'),
      clanTag: eq.clan && validTag(tag) && !blockedTag(tag) ? tag : ''
    };
  }

  var api = {
    normalise: normalise,
    byId: byId,
    status: status,
    lockText: lockText,
    act: act,
    look: look,
    earned: earned,
    clean: clean,
    validTag: validTag,
    blockedTag: blockedTag,
    BLOCKED_TAGS: BLOCKED_TAGS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ShopRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
