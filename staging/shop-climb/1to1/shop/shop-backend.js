/* Shop backend. Two versions with the same two methods:
   load() -> Promise({ok, state}) and act(itemId, tag) -> Promise({ok, state, message|error}).
   'supabase': calls shop_state and shop_act on the server. Balance and purchases live only there.
   'mock': one device, in memory, for testing. Nothing is saved to the phone. Uses the same rules as the server.
   Use: ShopBackend.create(window.PLAYER_APP_CONFIG, getToken). */
(function (root) {
  'use strict';

  var R = root.ShopRules || (typeof require === 'function' ? require('./shop-rules.js') : null);
  var CAT = root.ShopCosmetics || (typeof require === 'function' ? require('./cosmetics.js') : null);

  function mock(opts) {
    var o = opts || {};
    // 72s: the demo uses the same catalogue as the shop screen, so every tile id is known.
    var ITEMS = (root.ShopCatalogue && root.ShopCatalogue.ITEMS) || CAT.ITEMS;
    // The mock starts as a player with these numbers. Coins follow the same formula as the server.
    var st = {
      level: o.level || 12,
      stars: o.stars || 0,
      coins: R.earned(o.level || 12, o.stars || 0),
      owned: [],
      equipped: {},
      clanTag: '',
      vip: !!o.vip,
      badges: {}
    };
    function view() {
      // 72s: plain copy, same keys as shop_state (the old normaliser would drop the layer keys).
      return { level: st.level, stars: st.stars, coins: st.coins, owned: st.owned.slice(),
        equipped: Object.assign({}, st.equipped), clanTag: st.clanTag, vip: st.vip, badges: st.badges, items: ITEMS };
    }
    return {
      kind: 'mock',
      load: function () { return Promise.resolve({ ok: true, state: view() }); },
      act: function (id) {
        // 72s demo: same rules as the screen (buyCheck). Buy also wears the item; a second tap takes it off.
        var it = ITEMS.filter(function (i) { return i.id === id; })[0];
        if (!it) return Promise.resolve({ ok: false, error: 'Unknown item', state: view() });
        var key = 'l_' + it.layer;
        var owned = st.owned.indexOf(id) !== -1;
        if (st.equipped[key] === id) { st.equipped[key] = null; return Promise.resolve({ ok: true, state: view(), message: 'Taken off.' }); }
        if (!owned) {
          var why = root.ShopRulesV2 ? root.ShopRulesV2.buyCheck(it, { level: st.level, stars: st.stars, coins: st.coins, owned: {}, vip: st.vip, badges: st.badges }) : '';
          if (why) return Promise.resolve({ ok: false, error: why, state: view() });
          if (!st.vip) st.coins -= (it.price || 0);
          st.owned.push(id);
        }
        st.equipped[key] = id;
        return Promise.resolve({ ok: true, state: view(), message: owned ? 'On your card.' : 'Bought. It is on your card.' });
      }
    };
  }

  function supabase(cfg, getToken) {
    var base = String(cfg.supabaseUrl || '').replace(/\/$/, '');
    var key = cfg.supabaseAnonKey || '';
    function rpc(name, body) {
      return fetch(base + '/rest/v1/rpc/' + name, {
        method: 'POST',
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (!res.ok) throw new Error('http-' + res.status);
        return res.json();
      });
    }
    return {
      kind: 'supabase',
      load: function () {
        return rpc('shop_state', { p_token: getToken() }).then(function (j) {
          if (!j || j.ok === false) return { ok: false, error: (j && j.error) || 'Could not load the shop' };
          return { ok: true, state: R.normalise(j) };
        });
      },
      act: function (id, tag) {
        return rpc('shop_act', { p_token: getToken(), p_item: id, p_tag: tag || '' }).then(function (j) {
          if (!j || j.ok === false) return { ok: false, error: (j && j.error) || 'Could not save. Try again.' };
          return { ok: true, state: R.normalise(j), message: j.message };
        });
      },
      // Shop climb (tree picks). Server rules: shop_climb_state / shop_climb_choose_tree / shop_climb_pick / shop_climb_respec.
      climbState: function () {
        return rpc('shop_climb_state', { p_token: getToken() }).then(function (j) {
          if (!j || j.ok === false) return { ok: false, error: (j && j.error) || 'Could not load the climb' };
          return { ok: true, climb: j };
        });
      },
      climbAct: function (a) {
        var call = a.type === 'tree' ? ['shop_climb_choose_tree', { p_tree: a.tree }]
          : a.type === 'pick' ? ['shop_climb_pick', { p_level: a.level, p_reward: a.reward }]
          : ['shop_climb_respec', {}];
        var body = Object.assign({ p_token: getToken() }, call[1]);
        return rpc(call[0], body).then(function (j) {
          if (!j || j.ok === false) return { error: (j && j.error) || 'Could not save. Try again.' };
          return { state: { level: j.level, climb: j }, pick: j.pick, message: j.message };
        });
      },
      // Crew panel (SQL v3). A missing RPC (404) comes back as ok:false, so the panel hides itself.
      crewState: function () {
        return rpc('shop_crew_state', { p_token: getToken() }).then(function (j) {
          if (!j || j.ok === false) return { ok: false, error: (j && j.error) || 'Could not load the crew' };
          return { ok: true, crew: j.crew || null };
        }).catch(function () { return { ok: false, error: 'crew-unavailable' }; });
      },
      crewBoard: function () {
        return rpc('shop_crew_board', { p_token: getToken() }).then(function (j) {
          if (!j || j.ok === false) return { ok: false, error: (j && j.error) || 'Could not load the board' };
          return { ok: true, board: j.board || [] };
        }).catch(function () { return { ok: false, error: 'board-unavailable' }; });
      },
      // Extras (SQL v4): events, bounty, trophies. Missing RPC comes back ok:false, so the panel hides.
      extrasState: function () {
        return rpc('shop_extras_state', { p_token: getToken() }).then(function (j) {
          if (!j || j.ok === false) return { ok: false, error: (j && j.error) || 'extras-unavailable' };
          return { ok: true, data: j };
        }).catch(function () { return { ok: false, error: 'extras-unavailable' }; });
      },
      crewAct: function (a) {
        var call = a.type === 'create' ? ['shop_crew_create', { p_name: a.name, p_tag: a.tag }]
          : a.type === 'join' ? ['shop_crew_join', { p_tag: a.tag }]
          : ['shop_crew_leave', {}];
        var body = Object.assign({ p_token: getToken() }, call[1]);
        return rpc(call[0], body).then(function (j) {
          if (!j || j.ok === false) return { ok: false, error: (j && j.error) || 'Could not save. Try again.' };
          return { ok: true, crew: j.crew === undefined ? null : j.crew, message: j.message || '' };
        }).catch(function () { return { ok: false, error: 'Could not save. Try again.' }; });
      }
    };
  }

  var api = {
    create: function (config, getToken) {
      var cfg = config || { backend: 'mock' };
      var tok = typeof getToken === 'function' ? getToken : function () { return ''; };
      if (cfg.backend === 'supabase' && cfg.supabaseUrl && cfg.supabaseAnonKey) return supabase(cfg, tok);
      return mock(cfg);
    },
    mock: mock
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ShopBackend = api;
})(typeof window !== 'undefined' ? window : globalThis);
