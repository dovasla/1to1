'use strict';
// Node test: weekly rival pairing, win bonus and card. Run: node tests\weekly-rival.test.js
var assert = require('assert');
var path = require('path');
require(path.join(__dirname, '..', 'lib', 'player-name.js'));
var R = require(path.join(__dirname, '..', 'lib', 'weekly-rival.js'));

var out = [];
var board = [
  { id: 'a1', name: 'Sam Kowalski', level: 12, points: 1200, look: 'gold-crown', visible: true },
  { id: 'b2', name: 'Joe Patel', level: 13, points: 1300, visible: true },
  { id: 'c3', name: 'Ada Lovelace', level: 11, points: 1100, visible: true },
  { id: 'd4', name: 'Tom Reed', level: 3, points: 200, visible: true },
  { id: 'e5', name: 'Max Ng', level: 14, points: 1500, visible: true },
  { id: 'f6', name: 'Hidden One', level: 12, points: 900, visible: false },
  { id: 'g7', name: 'Player', level: 12, points: 0, visible: true },
  { id: 'h8', name: 'Zed Yu', level: 40, points: 9000, visible: true }
];
var me = { id: 'me', level: 12, xp: 1210 };

// 1. Same inputs give the same rival (no re-roll).
var r1 = R.pickRival(me, board, '2026-W47');
var r2 = R.pickRival(me, board, '2026-W47');
assert.deepStrictEqual(r1, r2);
out.push('1 same week, same rival: ' + r1.name);

// 2. Never a weak or far-off player when near ones exist; never hidden, placeholder or myself.
var seen = {};
['2026-W46', '2026-W47', '2026-W48', '2026-W49', '2026-W50', '2026-W51', '2026-W52'].forEach(function (w) {
  var r = R.pickRival(me, board, w);
  seen[r.id] = true;
  assert.ok(R.POOL >= 1);
  assert.ok(['d4', 'h8', 'f6', 'g7', 'me'].indexOf(r.id) === -1, 'unfair pick ' + r.id);
  assert.ok(Math.abs(r.level - me.level) <= 2, 'rival too far in level: ' + r.id);
});
assert.ok(Object.keys(seen).length > 1, 'rival rotates week to week');
out.push('2 rival near level, never hidden/placeholder/far-off, rotates: ' + Object.keys(seen).join(' '));

// 3. Empty or only-self board gives no rival.
assert.strictEqual(R.pickRival(me, [], '2026-W47'), null);
assert.strictEqual(R.pickRival(me, [{ id: 'me', level: 12, points: 1 }], '2026-W47'), null);
out.push('3 nobody to pair with: no rival');

// 4. Duel: points decide; bonus only for a win against a rival within 3 levels below.
var win = R.duel(120, 80, 12, 11);
assert.strictEqual(win.result, 'win');
assert.strictEqual(win.bonusXp, R.WIN_BONUS_XP);
assert.strictEqual(win.gap, 40);
var farm = R.duel(120, 80, 12, 5);
assert.strictEqual(farm.result, 'win');
assert.strictEqual(farm.bonusXp, 0, 'no bonus for beating a weak rival');
assert.strictEqual(R.duel(50, 80, 12, 12).result, 'lose');
assert.strictEqual(R.duel(50, 80, 12, 12).bonusXp, 0);
assert.strictEqual(R.duel(60, 60, 12, 12).result, 'draw');
out.push('4 duel: win bonus only near level, loss and draw get none');

// 5. Week key: ISO week, Monday start.
assert.strictEqual(R.weekKey(new Date(2026, 10, 18)), '2026-W47'); // Wed 18 Nov 2026
assert.strictEqual(R.weekKey(new Date(2026, 10, 16)), '2026-W47'); // Mon 16 Nov
assert.strictEqual(R.weekKey(new Date(2026, 10, 15)), '2026-W46'); // Sun 15 Nov
assert.strictEqual(R.weekKey(new Date(2027, 0, 1)), '2026-W53');   // Fri 1 Jan 2027 is in ISO week 53 of 2026
out.push('5 week key: ISO week, Monday start, year edge');

// 6. Card: names as first name + initial, escaped text, hidden without a rival or duel.
assert.strictEqual(R.buildCard({ me: { name: 'x' }, rival: null, duel: win }), '');
assert.strictEqual(R.buildCard({ me: { name: 'x' }, rival: { name: 'y' }, duel: null }), '');
var html = R.buildCard({ week: '2026-W47', me: { name: 'Sam Kowalski', level: 12, look: 'gold-crown' },
  rival: { name: 'Joe Patel', level: 13, look: '' }, duel: R.duel(120, 80, 12, 13) });
assert.ok(html.indexOf('Sam K') !== -1, 'first name + initial');
assert.ok(html.indexOf('Joe P') !== -1, 'rival first name + initial');
var evil = R.buildCard({ me: { name: 'Sam Kowalski', level: 12 }, rival: { name: 'Eve <img src=x>', level: 12 }, duel: win });
assert.ok(evil.indexOf('<img') === -1, 'escaped');
assert.ok(html.indexOf('+10 bonus XP') !== -1, 'bonus line');
assert.ok(html.indexOf('120') !== -1 && html.indexOf('80') !== -1, 'scores shown');
out.push('6 card: names, escaping, bonus line, hides without data');

console.log(out.join('\n'));
console.log('weekly-rival tests passed');
