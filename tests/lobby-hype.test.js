// Run: node tests/lobby-hype.test.js   (pure rules and the no-server fallback; no network, no SQL)
var assert = require('assert');
var H = require('../lobby/lobby-hype.js');

// Teams out: only when there are teams and a newer version than the one seen.
assert.strictEqual(H.teamsOut(null, 0), false, 'no feed, no banner');
assert.strictEqual(H.teamsOut({ teamsVersion: 1, teams: [] }, 0), false, 'no teams, no banner');
assert.strictEqual(H.teamsOut({ teamsVersion: 1, teams: [{ id: 'A' }] }, 0), true, 'new teams version shows');
assert.strictEqual(H.teamsOut({ teamsVersion: 1, teams: [{ id: 'A' }] }, 1), false, 'already seen');
assert.strictEqual(H.teamsOut({ teamsVersion: 2, teams: [{ id: 'A' }] }, 1), true, 'republish shows again');

// "N in" line: plain words, zero when missing.
assert.strictEqual(H.inLine(undefined), '0 players in');
assert.strictEqual(H.inLine(1), '1 player in');
assert.strictEqual(H.inLine(7), '7 players in');
assert.strictEqual(H.inLine(-3), '0 players in');

// Local hype counts are immutable per tap.
var a = {};
var b = H.bumpLocal(a, 'fire');
assert.deepStrictEqual(a, {}, 'input not changed');
assert.strictEqual(b.fire, 1);
assert.strictEqual(H.bumpLocal(b, 'fire').fire, 2);

// Hype with no RPC (table or function missing): still ok, server false, never throws.
var out = null;
H.hype({}, 'tok', 'tonight', 'fire').then(function (r) { out = r; });
// Hype where the RPC throws: still resolves ok, server false.
var out2 = null;
H.hype({ rpc: function () { throw new Error('missing'); } }, 'tok', 'tonight', 'fire').then(function (r) { out2 = r; });
// Hype where the RPC answers ok: server true.
var out3 = null;
H.hype({ rpc: function () { return Promise.resolve({ ok: true }); } }, 'tok', 'tonight', 'fire').then(function (r) { out3 = r; });

setTimeout(function () {
  assert.deepStrictEqual(out, { ok: true, server: false }, 'no rpc: local only');
  assert.deepStrictEqual(out2, { ok: true, server: false }, 'rpc throws: local only');
  assert.deepStrictEqual(out3, { ok: true, server: true }, 'rpc ok: server');
  console.log('lobby hype: all checks passed');
}, 20);
