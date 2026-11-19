/* Shop, local first (coins only). Pure rules, no DOM, no network except the injected send().
   Browser: window.PlayerShopLocal. Node tests: tests/shop-local.test.js.
   - Buy checks coins on this phone, takes the price, marks the item owned, and queues it for the server.
   - flush(send) sends queued buys when the server answers. A failed send stays in the queue.
   - reconcile(local, server): the server wins on conflict (coins and owned come from the server).
   Shape: { coins: number, owned: { [id]: true }, queue: [{ id, price, at }] }
*/
(function (root) {
  'use strict';

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function copy(s) {
    return { coins: num(s && s.coins), owned: Object.assign({}, (s && s.owned) || {}), queue: ((s && s.queue) || []).slice() };
  }

  // '' when the item can be bought, otherwise a plain reason.
  function canBuy(state, item) {
    if (!item || !item.id) return 'bad-item';
    if (state && state.owned && state.owned[item.id]) return 'owned';
    if (num(state && state.coins) < num(item.price)) return 'no-coins';
    return '';
  }

  // Immutable: returns the new state, or { error } when the buy is not allowed.
  function buy(state, item, now) {
    var why = canBuy(state, item);
    if (why) return { error: why };
    var next = copy(state);
    next.coins -= num(item.price);
    next.owned[item.id] = true;
    next.queue.push({ id: item.id, price: num(item.price), at: num(now) });
    return { state: next };
  }

  // Sends queued buys one by one. send(entry) -> Promise<boolean>. Failed ones stay queued.
  function flush(state, send) {
    var next = copy(state);
    var keep = [];
    var chain = Promise.resolve();
    next.queue.forEach(function (entry) {
      chain = chain.then(function () {
        return Promise.resolve().then(function () { return send(entry); }).then(function (ok) {
          if (ok !== true) keep.push(entry);
        }, function () { keep.push(entry); });
      });
    });
    return chain.then(function () { next.queue = keep; return next; });
  }

  // The server wins: its coins and owned list replace ours. Queued items the server does not know stay queued.
  function reconcile(local, server) {
    var l = copy(local);
    if (!server || typeof server !== 'object') return l;
    var owned = Object.assign({}, server.owned || {});
    return {
      coins: num(server.coins),
      owned: owned,
      queue: l.queue.filter(function (e) { return !owned[e.id]; })
    };
  }

  var api = { canBuy: canBuy, buy: buy, flush: flush, reconcile: reconcile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerShopLocal = api;
})(typeof window !== 'undefined' ? window : globalThis);
