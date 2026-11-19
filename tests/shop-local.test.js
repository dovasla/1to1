// Run: node tests/shop-local.test.js   (pure rules; no network, no SQL)
var assert = require('assert');
var S = require('../lib/shop-local.js');

var start = { coins: 100, owned: {}, queue: [] };
var item = { id: 'hat-gold', price: 40 };

assert.strictEqual(S.canBuy(start, item), '', 'enough coins');
assert.strictEqual(S.canBuy(start, { id: 'x', price: 500 }), 'no-coins', 'not enough coins');
assert.strictEqual(S.canBuy(start, {}), 'bad-item', 'bad item');

var r = S.buy(start, item, 1000);
assert.strictEqual(r.state.coins, 60, 'coins taken');
assert.strictEqual(r.state.owned['hat-gold'], true, 'owned locally');
assert.strictEqual(r.state.queue.length, 1, 'queued for the server');
assert.strictEqual(start.coins, 100, 'input not changed');

assert.strictEqual(S.buy(r.state, item, 2000).error, 'owned', 'no double buy');

var sent = [];
S.flush(r.state, function (e) { sent.push(e.id); return Promise.resolve(true); }).then(function (next) {
  assert.deepStrictEqual(sent, ['hat-gold'], 'sent once');
  assert.strictEqual(next.queue.length, 0, 'queue cleared on success');
  return S.flush(r.state, function () { return Promise.resolve(false); });
}).then(function (kept) {
  assert.strictEqual(kept.queue.length, 1, 'failed send stays queued');
  return S.flush(r.state, function () { throw new Error('offline'); });
}).then(function (kept2) {
  assert.strictEqual(kept2.queue.length, 1, 'thrown send stays queued');
  var merged = S.reconcile(r.state, { coins: 75, owned: { 'hat-gold': true, 'shoe': true } });
  assert.strictEqual(merged.coins, 75, 'server coins win');
  assert.strictEqual(merged.queue.length, 0, 'server already knows it: queue cleared');
  var keep = S.reconcile(r.state, { coins: 75, owned: {} });
  assert.strictEqual(keep.queue.length, 1, 'server does not know it: stays queued');
  console.log('shop local: all checks passed');
}).catch(function (e) { console.error('FAIL', e.message); process.exit(1); });
