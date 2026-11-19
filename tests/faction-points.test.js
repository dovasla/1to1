'use strict';
// Node test: faction points formula, Thu/Sun + month rule, standings order. Run: node tests/faction-points.test.js
var assert = require('assert');
var path = require('path');
var F = require(path.join(__dirname, '..', 'lib', 'faction-points.js'));

var out = [];

// 1. No games = 0 points, no matter the stats.
assert.strictEqual(F.nightPoints({ games: [] }).points, 0);
assert.strictEqual(F.nightPoints(null).points, 0);
out.push('1 no games = 0');

// 2. Low scorer still gets the turn-up floor: 1 game, 0 pts, lost = 10 + 2 = 12.
assert.strictEqual(F.nightPoints({ games: [{ pts: 0, won: false }] }).points, 12);
out.push('2 low scorer floor: 12');

// 3. Full example: 2 games, 14 and 6 pts, won one = 10 + 4 + (10 + 6) + 5 = 35.
var full = F.nightPoints({ games: [{ pts: 14, won: true }, { pts: 6, won: false }] });
assert.strictEqual(full.points, 35);
assert.deepStrictEqual(full.parts, { turnUp: 10, games: 4, scoring: 16, wins: 5 });
out.push('3 two games, 14 and 6 pts, one win: 35');

// 4. Points are capped at 10 per game (a 30 pt game counts as 10).
assert.strictEqual(F.nightPoints({ games: [{ pts: 30, won: false }] }).points, 10 + 2 + 10);
out.push('4 per-game cap: 30 pts counts 10');

// 5. Bad or negative points count as 0.
assert.strictEqual(F.nightPoints({ games: [{ pts: -5, won: false }, { pts: 'x', won: false }] }).points, 10 + 4);
out.push('5 bad points count as 0');

// 6. Thursday and Sunday count; other days and other months do not.
// 2026-11-19 is a Thursday, 2026-11-22 a Sunday, 2026-11-24 a Tuesday.
assert.strictEqual(F.countsForSeason({ date: '2026-11-19' }, '2026-11'), true);
assert.strictEqual(F.countsForSeason({ date: '2026-11-22' }, '2026-11'), true);
assert.strictEqual(F.countsForSeason({ date: '2026-11-24' }, '2026-11'), false);
assert.strictEqual(F.countsForSeason({ date: '2026-11-19' }, '2026-12'), false);
assert.strictEqual(F.countsForSeason({ date: 'not a date' }, '2026-11'), false);
assert.strictEqual(F.countsForSeason({}, '2026-11'), false);
out.push('6 Thu and Sun count, Tue and other months do not');

// 7. Standings: all five factions always listed, sorted by points then name.
var rows = F.seasonStandings([
  { faction: 'ember', date: '2026-11-19', games: [{ pts: 10, won: true }] },   // 10+2+10+5 = 27
  { faction: 'frost', date: '2026-11-19', games: [{ pts: 2, won: false }] },   // 10+2+2 = 14
  { faction: 'frost', date: '2026-11-22', games: [{ pts: 2, won: false }] },   // 14 more = 28
  { faction: 'frost', date: '2026-11-24', games: [{ pts: 50, won: true }] },   // Tuesday, ignored
  { faction: 'frost', date: '2026-10-22', games: [{ pts: 50, won: true }] },   // October, ignored
  { faction: 'slate', date: '2026-11-22', games: [] }                         // no games, ignored
], '2026-11');
assert.strictEqual(rows.length, 5);
assert.deepStrictEqual(rows.map(function (r) { return r.faction; }), ['frost', 'ember', 'brass', 'indigo', 'slate']);
assert.strictEqual(rows[0].points, 28);
assert.strictEqual(rows[0].playerNights, 2);
assert.strictEqual(rows[1].points, 27);
assert.strictEqual(rows[1].wins, 1);
assert.strictEqual(rows[4].points, 0);
out.push('7 standings: frost 28, ember 27, then zeros by name');

// 8. Ties sort by name (A to Z).
var tie = F.seasonStandings([
  { faction: 'slate', date: '2026-11-19', games: [{ pts: 0, won: false }] },
  { faction: 'brass', date: '2026-11-19', games: [{ pts: 0, won: false }] }
], '2026-11');
assert.strictEqual(tie[0].faction, 'brass');
assert.strictEqual(tie[1].faction, 'slate');
out.push('8 ties sorted by name');

out.forEach(function (line) { console.log('ok ' + line); });
console.log('faction-points: ' + out.length + ' checks passed');
