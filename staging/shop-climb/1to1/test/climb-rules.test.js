// Run: node test/climb-rules.test.js   (rules and view helpers only; SQL is checked in the database, not here)
var assert = require('assert');
var C = require('../shop/shop-climb.js');
var L = C.pickLevels();
assert.deepStrictEqual(L.slice(0, 3), [3, 6, 9]);
assert.strictEqual(L.length, 20, '20 picks per run');
assert.strictEqual(L[L.length - 1], 60);
var climb = { tree: 'gold', level: 9, respecCost: 0,
  picks: [{ level: 3, kind: 'perk', name: 'Gold Captain', desc: '', value: 0 }, { level: 6, kind: 'title', name: 'Captain', desc: '', value: 0 }],
  pending: [{ level: 9, offers: [] }] };
assert.strictEqual(C.nodeStatus(3, climb).status, 'done');
assert.strictEqual(C.nodeStatus(9, climb).status, 'ready');
assert.strictEqual(C.nodeStatus(12, climb).status, 'locked');
assert.strictEqual(C.perkCount(climb), 1, 'one perk picked');
assert.strictEqual(C.nextPickLevel(9), 12);
assert.strictEqual(C.nextPickLevel(60), null);
assert.strictEqual(C.respecCost({ respecCost: 200 }), 200);
assert.strictEqual(C.isBigPick({ kind: 'coins' }, 45), true, 'level 45+ is big');
assert.strictEqual(C.isBigPick({ kind: 'perk' }, 12), false, 'low picks stay quiet');
assert.strictEqual(C.isBigPick(null, 60), false);
assert.deepStrictEqual(Object.keys(C.TREES).sort(), ['fire', 'gold', 'ice', 'shadow', 'storm']);
console.log('climb rules: all checks passed');
