'use strict';
// Node test: the closed pop-up and the run-ended sequence. Run: node tests\live-closed.test.js
var assert = require('assert');
var path = require('path');
var F = require(path.join(__dirname, '..', 'screens', 'live', 'live-feed.js'));
var L = require(path.join(__dirname, '..', 'screens', 'live', 'live.js'));

var out = [];
var MIN = 60 * 1000;

// Old run (19:00 on 11 Nov) left open by a crashed organiser, last beat at 19:29:50 on 18 Nov.
var oldRun = { schedule: { date: '2026-11-11', start: '19:00' }, state: 'live', live: true,
  teamA: 'Red', teamB: 'Blue', scoreA: 3, scoreB: 1, clock: { running: true, remainingMs: 300000 },
  updatedAt: '2026-11-18T19:29:50Z' };

// Step 1: old run open and fresh -> on court, not ended.
var t1 = Date.parse('2026-11-18T19:30:00Z');
var f1 = F.fromFeed(oldRun, t1);
assert.strictEqual(f1.live, true, 'old run fresh -> live');
assert.strictEqual(F.endedNow(f1), false, 'old run fresh -> not ended');
out.push('1 old run left open, fresh: live, not ended');

// Step 2: no beat for 10 min -> over. Player who was watching gets the pop-up once.
var t2 = t1 + 11 * MIN;
var f2 = F.fromFeed(oldRun, t2);
assert.strictEqual(f2.connection, 'over');
assert.strictEqual(F.endedNow(f2), true, 'silent 10 min -> ended');
var prev = { runOver: false, runKey: F.runKey(oldRun) };
var next = { runOver: F.endedNow(f2), runKey: F.runKey(oldRun) };
assert.strictEqual(L.closedPopupKey(prev, next, []), '2026-11-11 19:00', 'pop-up due once');
assert.strictEqual(L.closedPopupKey(prev, next, ['2026-11-11 19:00']), null, 'not again for the same run');
out.push('2 old run silent 10 min: ended, pop-up due once');

// Step 3: new organiser starts a new run -> "Run is on", not ended, new run key.
var newStart = { schedule: { date: '2026-11-18', start: '19:00' }, state: 'started',
  updatedAt: '2026-11-18T20:00:00Z' };
var t3 = Date.parse('2026-11-18T20:00:20Z');
var f3 = F.fromFeed(newStart, t3);
assert.strictEqual(f3.state, 'started');
assert.strictEqual(F.endedNow(f3), false, 'new run started -> not ended');
assert.strictEqual(F.runKey(newStart), '2026-11-18 19:00');
var html3 = L.html({ runOn: true, runStarting: true, runOver: false, runKey: F.runKey(newStart), now: null, upcoming: [] });
assert.ok(html3.indexOf('Run is on') >= 0, 'Live shows Run is on');
out.push('3 new run started: Run is on, not ended');

// Step 4: new organiser ends the run -> ended, pop-up due once for the new run, default view after.
var newEnd = { schedule: { date: '2026-11-18', start: '19:00' }, state: 'finished',
  updatedAt: '2026-11-18T21:00:00Z', recap: null };
var t4 = Date.parse('2026-11-18T21:00:10Z');
var f4 = F.fromFeed(newEnd, t4);
assert.strictEqual(F.endedNow(f4), true, 'run ended -> ended');
assert.strictEqual(f4.now, null, 'no court after the run ends');
var prev4 = { runOver: false, runKey: F.runKey(newStart) };
var next4 = { runOver: true, runKey: F.runKey(newEnd) };
assert.strictEqual(L.closedPopupKey(prev4, next4, ['2026-11-11 19:00']), '2026-11-18 19:00', 'pop-up for the new run');
var html4 = L.html({ runOver: true, runKey: F.runKey(newEnd), now: null, upcoming: [], results: null });
assert.ok(html4.indexOf('No game') >= 0, 'default view after the run is closed');
assert.ok(html4.indexOf('Run is over') < 0 && html4.indexOf('Run&#39;s over') < 0, 'no stale over card');
assert.ok(html4.indexOf('The run has been closed') < 0, 'pop-up is not in the page itself');
out.push('4 new run ended: ended, pop-up due, default "No game" view');

// Player who opened Live after the run already ended: no pop-up.
assert.strictEqual(L.closedPopupKey({ runOver: true, runKey: '2026-11-18 19:00' }, { runOver: true, runKey: '2026-11-18 19:00' }, []), null);
out.push('5 opened after the run ended: no pop-up');

console.log(out.join('\n'));
console.log('ALL CHECKS PASSED');
