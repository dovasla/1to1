'use strict';
// Node test: night recap model, card markup and share text. Run: node tests\night-recap.test.js
var assert = require('assert');
var path = require('path');
require(path.join(__dirname, '..', 'lib', 'player-name.js'));
var R = require(path.join(__dirname, '..', 'lib', 'night-recap.js'));

var out = [];

// 1. No played night: no model, no card.
assert.strictEqual(R.model({ name: 'Sam Kowalski', level: 12, lastNight: null }), null);
assert.strictEqual(R.model({ name: 'Sam Kowalski', level: 12, lastNight: { xp: 0, games: 0, wins: 0 } }), null);
assert.strictEqual(R.buildCard(null), '');
out.push('1 no played night: no card');

// 2. Model: first name + initial, numbers, losses, capped percent.
var m = R.model({ name: 'Sam Kowalski', level: 12, levelPct: 140, toNext: '40 XP to Level 13', look: 'gold-crown',
  lastNight: { xp: 143, games: 3, wins: 2 } });
assert.strictEqual(m.name, 'Sam K');
assert.strictEqual(m.xp, 143);
assert.strictEqual(m.games, 3);
assert.strictEqual(m.wins, 2);
assert.strictEqual(m.losses, 1);
assert.strictEqual(m.levelPct, 100, 'percent capped at 100');
out.push('2 model: first name + initial, numbers, losses, percent capped');

// 3. Wins never above games.
assert.strictEqual(R.model({ name: 'A B', level: 1, lastNight: { xp: 5, games: 1, wins: 4 } }).wins, 1);
out.push('3 wins never above games');

// 4. Share text: plain words, singular/plural.
assert.strictEqual(R.shareText(m), '1TO1 Basketball: 3 games, 2 wins, +143 XP. Level 12.');
var one = R.model({ name: 'A B', level: 2, lastNight: { xp: 20, games: 1, wins: 1 } });
assert.strictEqual(R.shareText(one), '1TO1 Basketball: 1 game, 1 win, +20 XP. Level 2.');
out.push('4 share text: plural and singular');

// 5. Card: escaping, share button present, progress label.
var html = R.buildCard(R.model({ name: 'Eve <img src=x>', level: 3, toNext: 'Next', lastNight: { xp: 1, games: 1, wins: 0 } }));
assert.ok(html.indexOf('<img') === -1, 'escaped');
assert.ok(html.indexOf('data-act="share-recap"') !== -1, 'share button');
assert.ok(html.indexOf('Next') !== -1);
out.push('5 card: escaped, share button, progress note');

// 6. drawCard on a fake canvas: sets size and draws the numbers.
var calls = [];
var fakeCanvas = { getContext: function () { return {
  fillRect: function () {}, fillText: function (t) { calls.push(t); }, set fillStyle(v) {}, set font(v) {}, set textAlign(v) {} }; } };
R.drawCard(m, fakeCanvas);
assert.strictEqual(fakeCanvas.width, 1080);
assert.strictEqual(fakeCanvas.height, 1350);
assert.ok(calls.indexOf('143') !== -1 && calls.indexOf('2') !== -1 && calls.indexOf('3') !== -1, 'numbers drawn');
out.push('6 picture is 1080 x 1350 and draws the numbers');

console.log(out.join('\n'));
console.log('night-recap tests passed');
