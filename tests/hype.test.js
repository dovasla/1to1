'use strict';
// Node test: hype tap rate limits, lit tokens and the store. Run: node tests\hype.test.js
var assert = require('assert');
var path = require('path');
var H = require(path.join(__dirname, '..', 'lib', 'hype.js'));

var MIN = 60 * 1000;
var t0 = Date.parse('2026-11-18T19:00:00Z');
var out = [];

// 1. Empty ledger: can hype. Key needed.
assert.strictEqual(H.canHype(null, 'Blue|Sam K', t0).ok, true);
assert.strictEqual(H.canHype(null, '', t0).reason, 'bad');
out.push('1 first tap allowed, empty key refused');

// 2. Same player again within 30 s: wait. After 30 s: allowed.
var L = H.recordHype(null, 'Blue|Sam K', t0);
assert.strictEqual(H.canHype(L, 'Blue|Sam K', t0 + 10000).reason, 'wait');
assert.strictEqual(H.canHype(L, 'Blue|Sam K', t0 + H.EACH_MS).ok, true);
// A different player is fine straight away.
assert.strictEqual(H.canHype(L, 'Red|Joe P', t0 + 1000).ok, true);
out.push('2 same player waits 30 s, other players are not blocked');

// 3. Hourly cap: 20 taps in an hour block the 21st, across players. Taps older than an hour free space.
var led = null;
for (var i = 0; i < H.HOUR_MAX; i++) led = H.recordHype(led, 'Red|P' + i, t0 + i * 1000);
var capped = H.canHype(led, 'Blue|New', t0 + 25 * 1000);
assert.strictEqual(capped.ok, false);
assert.strictEqual(capped.reason, 'hourly');
assert.strictEqual(H.canHype(led, 'Blue|New', t0 + H.HOUR_MS + 30 * 1000).ok, true, 'cap resets after an hour');
out.push('3 hourly cap of ' + H.HOUR_MAX + ' taps, resets after an hour');

// 4. recordHype prunes old entries.
var pruned = H.recordHype(led, 'Blue|Later', t0 + H.HOUR_MS + 40 * 1000);
assert.ok(pruned.at.length < led.at.length + 1, 'old taps dropped');
out.push('4 record prunes taps older than an hour');

// 5. Lit tokens: only within 60 s, ISO or ms times, bad rows ignored.
var now = t0 + 30 * 1000;
var lit = H.litKeys([
  { key: 'Blue|Sam K', at: now - 10000 },
  { key: 'Red|Joe P', at: new Date(now - 90000).toISOString() },
  { key: 'Red|Ada L', at: new Date(now - 5000).toISOString() },
  { key: '', at: now },
  null
], now);
assert.deepStrictEqual(lit, { 'Blue|Sam K': true, 'Red|Ada L': true });
out.push('5 only hypes in the last 60 s light tokens');

// 6. apply() lights the token's li, and is safe on a fake DOM.
var toggled = {};
var tok = { getAttribute: function () { return 'Blue|Sam K'; }, closest: function () {
  return { classList: { toggle: function (c, on) { toggled[c] = on; } } };
} };
var doc = { querySelectorAll: function () { return [tok]; } };
H.apply(doc, { 'Blue|Sam K': true });
assert.strictEqual(toggled['is-hyped'], true);
H.apply(null, {}); H.apply({ querySelectorAll: function () { return []; } }, {});
out.push('6 apply lights tokens by key, safe on empty or missing DOM');

// 7. Storage: loads empty on bad data or throwing storage, saves and loads back.
var store = {}; var fake = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = v; } };
assert.deepStrictEqual(H.loadLedger(fake), { at: [], by: {} });
store['cb.hype.ledger'] = '{bad json';
assert.deepStrictEqual(H.loadLedger(fake), { at: [], by: {} });
var broken = { getItem: function () { throw new Error('denied'); }, setItem: function () { throw new Error('denied'); } };
assert.deepStrictEqual(H.loadLedger(broken), { at: [], by: {} });
assert.strictEqual(H.saveLedger(broken, {}), false);
var saved = H.recordHype(null, 'Blue|Sam K', t0);
H.saveLedger(fake, saved);
assert.deepStrictEqual(H.loadLedger(fake), saved);
out.push('7 ledger survives bad JSON and blocked storage');

// 8. Button markup is escaped and carries the key.
var b = H.buttonHtml('Blue|<x>');
assert.ok(b.indexOf('data-hype-btn="Blue|&lt;x&gt;"') !== -1);
assert.ok(b.indexOf('🔥') !== -1);
out.push('8 button carries the escaped key');

console.log(out.join('\n'));
console.log('hype tests passed');
