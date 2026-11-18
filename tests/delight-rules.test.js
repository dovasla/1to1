'use strict';
// Node test: milestones, streak nudge, game-end banner, bib reveal, ball taps, Blackjack, cart icon.
// Run: node tests/delight-rules.test.js
var assert = require('assert');
var path = require('path');
var D = require(path.join(__dirname, '..', 'lib', 'delight-rules.js'));
var CART = require(path.join(__dirname, '..', 'lib', 'cart-icon.js'));

// D6 milestones
assert.strictEqual(D.milestoneLine(1), 'Welcome to the run.');
assert.strictEqual(D.milestoneLine(10), 'Double digits. You’re a regular.');
assert.strictEqual(D.milestoneLine(25), 'Part of the furniture.');
assert.strictEqual(D.milestoneLine(50), 'Half a century of nights.');
assert.strictEqual(D.milestoneLine(7), null);

// D5 streak
var s = D.streakNudge(4, true);
assert.strictEqual(s.text, '4-week streak');
assert.strictEqual(s.nudge, 'Play tonight to keep your 4-week streak.');
assert.strictEqual(D.streakNudge(4, false).nudge, '');
assert.strictEqual(D.streakNudge(0, true).show, false);

// D3 game-end banner: only with a game_end event
assert.strictEqual(D.gameEndBanner([{ type: 'score' }], { blue: 'Blue' }), null);
var b = D.gameEndBanner([{ type: 'score' }, { type: 'game_end', winner: 'blue', scoreA: 21, scoreB: 17 }], { blue: 'Blue' });
assert.strictEqual(b.text, 'BLUE WIN 21-17');

// D7 bib reveal: only on first check-in
assert.strictEqual(D.shouldRevealBib(null, { checkedIn: true }), true);
assert.strictEqual(D.shouldRevealBib({ checkedIn: true }, { checkedIn: true }), false);

// D12a ball taps: three within 1.2s spins, slow taps reset
var st = D.ballTap(null, 0);
st = D.ballTap(st, 500);
var third = D.ballTap(st, 900);
assert.strictEqual(third.spin, true);
var slow = D.ballTap(D.ballTap(null, 0), 5000);
assert.strictEqual(slow.count, 1);
assert.strictEqual(slow.spin, false);

// D12b Blackjack on exactly 21
assert.deepStrictEqual(D.blackjackBadge(21), { id: 'blackjack', label: 'Blackjack' });
assert.strictEqual(D.blackjackBadge(20), null);

// Cart icon: an inline svg with two wheels and currentColor stroke
var svg = CART.svg(44);
assert.ok(svg.indexOf('<svg') === 0);
assert.ok(svg.indexOf('currentColor') !== -1);
assert.strictEqual((svg.match(/<circle/g) || []).length, 2);
assert.ok(svg.indexOf('width="44"') !== -1);

console.log('delight-rules: all tests passed');
