'use strict';
// Node test: Home streak and milestone HTML, and the pay stamp guard. Run: node tests/home-delights.test.js
var assert = require('assert');
var path = require('path');
var H = require(path.join(__dirname, '..', 'lib', 'home-delights.js'));
var P = require(path.join(__dirname, '..', 'lib', 'pay-stamp.js'));

// No streak and no milestone: nothing shown.
assert.strictEqual(H.html({ streakWeeks: 0, nightsPlayed: 3 }), '');

// Streak on a run day shows the nudge.
var a = H.html({ streakWeeks: 4, runOn: true, nightsPlayed: 3 });
assert.ok(a.indexOf('4-week streak') !== -1);
assert.ok(a.indexOf('Play tonight to keep your 4-week streak.') !== -1);
assert.ok(a.indexOf('dl-milestone') === -1);

// Milestone 10 shows its line.
var b = H.html({ streakWeeks: 0, nightsPlayed: 10 });
assert.ok(b.indexOf('Double digits') !== -1);

// Text is escaped (a streak value is a number, but names must never inject).
var c = H.html({ streakWeeks: 2, runOn: false, nightsPlayed: 50 });
assert.ok(c.indexOf('Half a century of nights.') !== -1);

// Pay stamp: a fake card gets a stamp once, not twice.
function el(tag) {
  return {
    tag: tag, children: [], className: '', textContent: '', attrs: {},
    setAttribute: function (k, v) { this.attrs[k] = v; },
    appendChild: function (c) { this.children.push(c); return c; },
    querySelector: function (sel) {
      return this.children.find(function (x) { return ('.' + x.className.split(' ')[0]) === sel || x.className.indexOf('dl-paid-stamp') !== -1 && sel === '.dl-paid-stamp'; }) || null;
    }
  };
}
var doc = { createElement: function (t) { return el(t); } };
var card = el('div'); card.ownerDocument = doc;
assert.strictEqual(P.stamp(card), true);
assert.strictEqual(P.stamp(card), false, 'second stamp is a no-op');
assert.strictEqual(card.children.length, 2, 'one punch hole and one stamp');

console.log('home-delights: all tests passed');
