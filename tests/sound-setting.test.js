'use strict';
// Node test: sound is off by default, toggles, and survives a blocked store. Run: node tests/sound-setting.test.js
var assert = require('assert');
var path = require('path');

var mem = {};
globalThis.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); }
};
var S = require(path.join(__dirname, '..', 'lib', 'sound-setting.js'));

assert.strictEqual(S.get(), false, 'off by default');
S.set(true);
assert.strictEqual(S.get(), true);
S.set(false);
assert.strictEqual(S.get(), false);

// Blocked store: reads say off, writes do not throw.
globalThis.localStorage = {
  getItem: function () { throw new Error('blocked'); },
  setItem: function () { throw new Error('blocked'); }
};
assert.strictEqual(S.get(), false);
assert.doesNotThrow(function () { S.set(true); });

console.log('sound-setting: all tests passed');
