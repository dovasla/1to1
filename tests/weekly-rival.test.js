'use strict';
// Node test: weekly rival pairing (symmetric), win bonus gate, bonus wording and card. Run: node tests/weekly-rival.test.js
var assert = require('assert');
var path = require('path');
require(path.join(__dirname, '..', 'lib', 'player-name.js'));
var R = require(path.join(__dirname, '..', 'lib', 'weekly-rival.js'));

var out = [];
var WEEKS = ['2026-W46', '2026-W47', '2026-W48', '2026-W49', '2026-W50', '2026-W51', '2026-W52'];

var board = [
  { id: 'a1', name: 'Sam Kowalski', level: 12, points: 1200, look: 'gold-crown', visible: true },
  { id: 'b2', name: 'Joe Patel', level: 13, points: 1300, visible: true },
  { id: 'c3', name: 'Ada Lovelace', level: 11, points: 1100, visible: true },
  { id: 'd4', name: 'Tom Reed', level: 3, points: 200, visible: true },
  { id: 'e5', name: 'Max Ng', level: 14, points: 1500, visible: true },
  { id: 'f6', name: 'Hidden One', level: 12, points: 900, visible: false },
  { id: 'g7', name: 'Player', level: 12, points: 0, visible: true },
  { id: 'h8', name: 'Zed Yu', level: 40, points: 9000, visible: true },
  { id: 'me', name: 'Jord Test', level: 12, points: 1210, visible: true }
];

// 1. Same inputs give the same rival (no re-roll).
var r1 = R.pickRival({ id: 'me' }, board, '2026-W47');
var r2 = R.pickRival({ id: 'me' }, board, '2026-W47');
assert.deepStrictEqual(r1, r2);
out.push('1 same week, same rival: ' + r1.name);

// 2. Never hidden, placeholder, or myself; the rival is close in level.
WEEKS.forEach(function (w) {
  var r = R.pickRival({ id: 'me' }, board, w);
  if (!r) return; // a bye is allowed
  assert.ok(['f6', 'g7', 'me'].indexOf(r.id) === -1, 'unfair pick ' + r.id + ' in ' + w);
  assert.ok(Math.abs(r.level - 12) <= R.MAX_PAIR_GAP, 'rival too far in level: ' + r.id);
});
// Tom (level 3) is never paired with anyone more than MAX_PAIR_GAP levels away, on any week.
WEEKS.forEach(function (w) {
  var t = R.pickRival({ id: 'd4' }, board, w);
  if (t) assert.ok(Math.abs(t.level - 3) <= R.MAX_PAIR_GAP, 'Tom paired too far in ' + w);
});
out.push('2 no hidden, placeholder or self as rival; no pair more than ' + R.MAX_PAIR_GAP + ' levels apart');

// 3. Symmetric: if A's rival is B, then B's rival is A. Every week, every player.
// Board of 21 players with levels 1..21 (plus a few hidden) so byes and cut offsets both happen.
var big = [];
for (var i = 1; i <= 21; i++) big.push({ id: 'p' + i, name: 'Player' + i + ' Test', level: i, points: i * 100, visible: true });
big.push({ id: 'hid', name: 'Hidden', level: 5, points: 5, visible: false });
WEEKS.concat(['2026-W01', '2026-W10', '2026-W23', '2026-W36', '2026-W41']).forEach(function (w) {
  var map = R.pairRivals(big, w);
  Object.keys(map).forEach(function (id) {
    var rival = map[id];
    assert.notStrictEqual(rival.id, id, 'no one is their own rival');
    assert.strictEqual(map[rival.id].id, id, 'mutual pair in ' + w + ': ' + id + ' <-> ' + rival.id);
  });
});
out.push('3 pairs are mutual in every week tested');

// 4. Close in level: blocks of 4 neighbours on a 1..21 board, so no pair is more than 3 levels apart.
WEEKS.forEach(function (w) {
  var map = R.pairRivals(big, w);
  Object.keys(map).forEach(function (id) {
    var a = big.filter(function (p) { return p.id === id; })[0];
    assert.ok(Math.abs(a.level - map[id].level) <= 3, 'pair too far apart in ' + w + ': ' + a.level + ' vs ' + map[id].level);
  });
});
out.push('4 rivals are within 3 levels on a dense board');

// 5. Byes: each week, the number of players with no rival is small and the rest pair up evenly.
WEEKS.forEach(function (w) {
  var map = R.pairRivals(big, w);
  var paired = Object.keys(map).length;
  assert.strictEqual(paired % 2, 0, 'paired players come in twos');
  assert.ok(21 - paired <= 21 / R.BLOCK + 1, 'too many byes in ' + w + ': ' + (21 - paired));
});
out.push('5 byes are few and paired players come in twos');

// 6. Rotation: the same player meets different rivals across weeks.
var rivals = {};
WEEKS.forEach(function (w) {
  var r = R.pickRival({ id: 'p10' }, big, w);
  if (r) rivals[r.id] = true;
});
assert.ok(Object.keys(rivals).length > 1, 'rival rotates week to week');
out.push('6 rivals rotate: ' + Object.keys(rivals).join(' '));

// 7. Empty, only-self, or not-on-the-board gives no rival.
assert.strictEqual(R.pickRival({ id: 'me' }, [], '2026-W47'), null);
assert.strictEqual(R.pickRival({ id: 'me' }, [{ id: 'me', level: 12, points: 1, visible: true, name: 'Me' }], '2026-W47'), null);
assert.strictEqual(R.pickRival({ id: 'nobody' }, board, '2026-W47'), null);
assert.strictEqual(R.pickRival({ id: 'f6' }, board, '2026-W47'), null, 'hidden player has no card');
out.push('7 nobody to pair with: no rival');

// 8. Duel: points decide; bonus only for a win against a rival at most 3 levels below.
var win = R.duel(120, 80, 12, 11);
assert.strictEqual(win.result, 'win');
assert.strictEqual(win.bonusXp, R.WIN_BONUS_XP);
assert.strictEqual(R.WIN_BONUS_XP, 10);
assert.strictEqual(win.gap, 40);
var farm = R.duel(120, 80, 12, 5);
assert.strictEqual(farm.result, 'win');
assert.strictEqual(farm.bonusXp, 0, 'no bonus for beating a weak rival');
assert.strictEqual(R.duel(120, 80, 12, 9).bonusXp, R.WIN_BONUS_XP, 'exactly 3 below still pays');
assert.strictEqual(R.duel(120, 80, 12, 8).bonusXp, 0, '4 below does not pay');
assert.strictEqual(R.duel(50, 80, 12, 12).result, 'lose');
assert.strictEqual(R.duel(50, 80, 12, 12).bonusXp, 0);
assert.strictEqual(R.duel(60, 60, 12, 12).result, 'draw');
assert.strictEqual(R.duel(60, 60, 12, 12).bonusXp, 0);
out.push('8 duel: bonus gate at 3 levels, loss and draw get none');

// 9. Week key: ISO week, Monday start.
assert.strictEqual(R.weekKey(new Date(2026, 10, 18)), '2026-W47'); // Wed 18 Nov 2026
assert.strictEqual(R.weekKey(new Date(2026, 10, 16)), '2026-W47'); // Mon 16 Nov
assert.strictEqual(R.weekKey(new Date(2026, 10, 15)), '2026-W46'); // Sun 15 Nov
assert.strictEqual(R.weekKey(new Date(2027, 0, 1)), '2026-W53');   // Fri 1 Jan 2027 is in ISO week 53 of 2026
out.push('9 week key: ISO week, Monday start, year edge');

// 10. Bonus wording: pending until the server confirms, then added. No bonus line when not a win.
assert.ok(R.noteText(win, 'pending').indexOf('on its way') !== -1);
assert.ok(R.noteText(win, 'added').indexOf('added') !== -1);
assert.ok(R.noteText(win, 'added').indexOf('on its way') === -1);
assert.strictEqual(R.noteText(farm, 'pending').indexOf('bonus XP') === -1, true, 'no bonus wording for a weak rival');
assert.ok(R.noteText(R.duel(50, 80, 12, 12), 'pending').indexOf('still time') !== -1);
out.push('10 bonus wording: pending, added, none');

// 11. Card: names as first name + initial, escaped text, hidden without a rival or duel.
assert.strictEqual(R.buildCard({ me: { name: 'x' }, rival: null, duel: win }), '');
assert.strictEqual(R.buildCard({ me: { name: 'x' }, rival: { name: 'y' }, duel: null }), '');
var html = R.buildCard({ week: '2026-W47', me: { name: 'Sam Kowalski', level: 12, look: 'gold-crown' },
  rival: { name: 'Joe Patel', level: 13, look: '' }, duel: R.duel(120, 80, 12, 13), bonus: 'pending' });
assert.ok(html.indexOf('Sam K') !== -1, 'first name + initial');
assert.ok(html.indexOf('Joe P') !== -1, 'rival first name + initial');
assert.ok(html.indexOf('on its way') !== -1, 'pending bonus line');
assert.ok(html.indexOf('120') !== -1 && html.indexOf('80') !== -1, 'scores shown');
var evil = R.buildCard({ me: { name: 'Sam Kowalski', level: 12 }, rival: { name: 'Eve <img src=x>', level: 12 }, duel: win });
assert.ok(evil.indexOf('<img') === -1, 'escaped');
out.push('11 card: names, escaping, bonus line, hides without data');

console.log(out.join('\n'));
console.log('weekly-rival tests passed');
