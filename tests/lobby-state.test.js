// Node test for lib/lobby-state.js. Run: node tests/lobby-state.test.js
'use strict';
var assert = require('assert');
var L = require('../lib/lobby-state.js');
var NOW = Date.parse('2026-11-20T20:00:00Z');
var teams = [{ name: 'Yellow', colour: '#FFD400', members: ['p1', 'p2'] },
             { name: 'Blue', colour: '#0A5CFF', members: ['p3'] }];
var base = { joined: true, nowMs: NOW, updatedMs: NOW, myId: 'p1', seenTeamsVersion: 0 };
function st(over) { var o = {}; Object.keys(base).forEach(function (k) { o[k] = base[k]; }); Object.keys(over).forEach(function (k) { o[k] = over[k]; }); return L.lobbyState(o); }
var published = { state: 'started', teamsVersion: 1, teams: teams };

assert.strictEqual(st({ joined: false, feed: null }), 'lobby', 'not joined stays on the code');
assert.strictEqual(st({ feed: null }), 'lobby', 'no run row: lobby');
assert.strictEqual(st({ feed: { state: 'idle' } }), 'lobby', 'idle run: lobby');
assert.strictEqual(st({ feed: published }), 'reveal', 'published, not seen: reveal for a team member');
assert.strictEqual(st({ feed: published, seenTeamsVersion: 1 }), 'live', 'already seen this version: straight to live');
assert.strictEqual(st({ feed: { state: 'started', teamsVersion: 2, teams: teams }, seenTeamsVersion: 1 }), 'reveal', 'republish (new version): reveal again');
assert.strictEqual(st({ myId: 'p9', feed: published }), 'live', 'not in any team: live, no reveal');
assert.strictEqual(st({ feed: { state: 'started' } }), 'live', 'started with no teams: live');
assert.strictEqual(st({ feed: { state: 'live' } }), 'live', 'game on: live');
assert.strictEqual(st({ feed: { state: 'started' }, updatedMs: NOW - 6 * 60000 }), 'reconnecting', 'silent 5 min while live: reconnecting');
assert.strictEqual(st({ feed: { state: 'started' }, updatedMs: NOW - 11 * 60000 }), 'reconnecting', 'silent 10+ min: still reconnecting, no auto-end');
assert.strictEqual(st({ feed: { state: 'started' }, updatedMs: NOW - 60 * 60000 }), 'reconnecting', 'silent 1 hour: still not over, only the organiser ends a run');
assert.strictEqual(st({ feed: { state: 'finished' } }), 'over', 'finished: over');
console.log('lobby-state: all checks passed');
