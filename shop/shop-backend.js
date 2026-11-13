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
    // The mock starts as a player with these numbers. Coins follow the same formula as the server.
    var st = {
      level: o.level || 12,
      stars: o.stars || 0,
      coins: R.earned(o.level || 12, o.stars || 0),
      owned: [],
      equipped: {},
      clanTag: ''
    };
    function view() {
      return R.normalise({ level: st.level, stars: st.stars, coins: st.coins, owned: st.owned,
        equipped: st.equipped, clanTag: st.clanTag, items: CAT.ITEMS });
    }
    return {
      kind: 'mock',
      load: function () { return Promise.resolve({ ok: true, state: view() }); },
      act: function (id, tag) {
        var r = R.act(view(), id, tag);
        if (!r.ok) return Promise.resolve({ ok: false, error: r.error, state: view() });
        st.coins = r.state.coins;
        st.owned = r.state.owned;
        st.equipped = r.state.equipped;
        st.clanTag = r.state.clanTag;
        return Promise.resolve({ ok: true, state: view(), message: r.message });
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
