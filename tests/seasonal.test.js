'use strict';
// Node test: seasonal skin by date and the html attribute. Run: node tests/seasonal.test.js
var assert = require('assert');
var path = require('path');
var Se = require(path.join(__dirname, '..', 'lib', 'seasonal.js'));

assert.strictEqual(Se.seasonFor(new Date(2026, 11, 1)), 'winter');
assert.strictEqual(Se.seasonFor(new Date(2026, 11, 31)), 'winter');
assert.strictEqual(Se.seasonFor(new Date(2026, 9, 20)), 'halloween');
assert.strictEqual(Se.seasonFor(new Date(2026, 9, 19)), null);
assert.strictEqual(Se.seasonFor(new Date(2026, 5, 10)), null);
assert.strictEqual(Se.seasonFor('not a date'), null);

// apply() sets and clears the attribute on a fake <html>.
var html = { attrs: {}, setAttribute: function (k, v) { this.attrs[k] = v; }, removeAttribute: function (k) { delete this.attrs[k]; } };
var doc = { documentElement: html };
assert.strictEqual(Se.apply(doc, new Date(2026, 11, 5)), 'winter');
assert.strictEqual(html.attrs['data-season'], 'winter');
assert.strictEqual(Se.apply(doc, new Date(2026, 5, 5)), null);
assert.strictEqual(html.attrs['data-season'], undefined);

console.log('seasonal: all tests passed');
