// Live shop path: a new purchase never stays worn (one extra shop_act takes it off). Wear taps on owned items are left alone.
const assert = require('assert');
const calls = [];
let script = [];
global.fetch = function (url, opts) {
  const name = url.split('/rpc/')[1];
  const body = JSON.parse(opts.body);
  calls.push({ name, body });
  const next = script.shift() || { ok: true };
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(next) });
};
const ShopBackend = require('../shop/shop-backend.js');
const cfg = { backend: 'supabase', supabaseUrl: 'https://example.test', supabaseAnonKey: 'k' };
const be = ShopBackend.create(cfg, () => 'tok');
const base = { coins: 500, level: 10, stars: 0, owned: ['hat-1'], equipped: {}, items: [] };
(async () => {
  // 1. Before the first read, ownership is unknown: a tap is sent once and never toggled back.
  script = [Object.assign({}, base, { owned: ['hat-1', 'hat-2'], equipped: { l_hat: 'hat-2' } })];
  calls.length = 0;
  let r = await be.act('hat-2');
  assert.strictEqual(calls.length, 1, 'unknown ownership: one call only');
  assert.strictEqual(r.state.equipped.l_hat, 'hat-2');

  // 2. After a read, a new purchase that the server wears is taken off again.
  script = [Object.assign({}, base)];
  await be.load();
  calls.length = 0;
  script = [Object.assign({}, base, { owned: ['hat-1', 'hat-2'], equipped: { l_hat: 'hat-2' } }), Object.assign({}, base, { owned: ['hat-1', 'hat-2'], equipped: { l_hat: null } })];
  r = await be.act('hat-2');
  assert.strictEqual(calls.length, 2, 'new purchase: second call takes it off');
  assert.strictEqual(r.state.equipped.l_hat, null, 'bought item is not worn');
  assert.ok(/Wear it/.test(r.message));

  // 3. Wearing an item already owned is one call and stays on.
  script = [Object.assign({}, base)];
  await be.load();
  calls.length = 0;
  script = [Object.assign({}, base, { owned: ['hat-1'], equipped: { l_hat: 'hat-1' } })];
  r = await be.act('hat-1');
  assert.strictEqual(calls.length, 1, 'owned item: one call');
  assert.strictEqual(r.state.equipped.l_hat, 'hat-1', 'wear tap keeps it on');
  console.log('shop owned-only (live path): 3 checks passed');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
