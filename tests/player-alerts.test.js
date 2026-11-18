'use strict';
// Node test: player phone alert rules (types, defaults, quiet hours, wording, delivery gate).
// Run: node tests/player-alerts.test.js
var assert = require('assert');
var path = require('path');
var A = require(path.join(__dirname, '..', 'lib', 'player-alerts.js'));

function at(hour) { return new Date(2026, 10, 18, hour, 0, 0); }
function memStore(seed) {
  var mem = seed ? Object.assign({}, seed) : {};
  return {
    getItem: function (k) { return k in mem ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); }
  };
}
var queue = [];
function test(name, fn) { queue.push([name, fn]); }

test('defaults: run-tonight, game-up, level-up on; rival and recap off; quiet hours on', function () {
  assert.strictEqual(JSON.stringify(A.DEFAULTS), JSON.stringify({ 'run-tonight': true, 'game-up': true, 'level-up': true, rival: false, recap: false, quiet: true }));
  assert.strictEqual(JSON.stringify(A.TYPES), JSON.stringify(['run-tonight', 'game-up', 'level-up', 'rival', 'recap']));
});

test('getPrefs: blocked or broken storage gives the defaults, never throws', function () {
  var broken = { getItem: function () { throw new Error('blocked'); } };
  assert.strictEqual(A.getPrefs(broken).rival, false);
  assert.strictEqual(A.getPrefs(null)['run-tonight'], true);
  assert.strictEqual(A.getPrefs(memStore({ 'p1to1.alerts': '{not json' }))['game-up'], true);
});

test('setPref saves one switch, keeps the others, and ignores unknown types', function () {
  var s = memStore();
  assert.strictEqual(A.setPref(s, 'rival', true), true);
  assert.strictEqual(A.getPrefs(s).rival, true);
  assert.strictEqual(A.getPrefs(s)['level-up'], true);
  assert.strictEqual(A.setPref(s, 'bogus', true), false);
});

test('a switched-off type never sends; rival is off by default', function () {
  var p = A.getPrefs(null);
  p['level-up'] = false;
  assert.strictEqual(A.shouldSend('level-up', p, at(14)), false);
  assert.strictEqual(A.shouldSend('rival', A.getPrefs(null), at(14)), false);
});

test('quiet hours silence all but game-up (23:00 and 06:00), not at 07:00', function () {
  var p = A.getPrefs(null);
  assert.strictEqual(A.shouldSend('run-tonight', p, at(23)), false);
  assert.strictEqual(A.shouldSend('level-up', p, at(6)), false);
  assert.strictEqual(A.shouldSend('game-up', p, at(23)), true);
  assert.strictEqual(A.shouldSend('run-tonight', p, at(7)), true);
  assert.strictEqual(A.shouldSend('run-tonight', p, at(21)), true);
});

test('quiet hours can be switched off', function () {
  var p = A.getPrefs(null);
  p.quiet = false;
  assert.strictEqual(A.shouldSend('level-up', p, at(23)), true);
});

test('wording: run, game, level, rival, recap', function () {
  assert.strictEqual(JSON.stringify(A.message('run-tonight', { place: 'Court 2', time: '7:30 pm' })), JSON.stringify({ title: 'Run tonight', body: 'Court 2 at 7:30 pm', tag: 'run-tonight', url: './' }));
  assert.strictEqual(A.message('game-up', { court: '3' }).body, 'Court 3. Tap to see it.');
  assert.strictEqual(A.message('level-up', { level: 12.9 }).body, 'You are now level 12.');
  assert.strictEqual(A.message('rival', { name: 'Sam K' }).body, 'Sam K is your rival this week.');
  assert.strictEqual(A.message('recap', { points: 340 }).body, '340 points this week. Tap to see your recap.');
});

test('wording: bad or missing data gives null, not a broken message', function () {
  assert.strictEqual(A.message('level-up', { level: 'x' }), null);
  assert.strictEqual(A.message('rival', {}), null);
  assert.strictEqual(A.message('recap', { points: -4 }), null);
  assert.strictEqual(A.message('nope', {}), null);
});

test('deliver: no permission, nothing shows (resolves false)', function () {
  return A.deliver('level-up', { level: 3 }, { storage: null, now: at(14), notification: { permission: 'default' } }).then(function (r) {
    assert.strictEqual(r, false);
  });
});

test('deliver: shows through the service worker when allowed', function () {
  var shown = [];
  var reg = { showNotification: function (title, opts) { shown.push([title, opts.tag]); return Promise.resolve(); } };
  return A.deliver('level-up', { level: 3 }, { storage: null, now: at(14), notification: { permission: 'granted' }, registration: reg }).then(function (r) {
    assert.strictEqual(r, true);
    assert.strictEqual(JSON.stringify(shown), JSON.stringify([['Level up', 'level-up']]));
  });
});

test('deliver: quiet hours block it, and a rejected showNotification gives false', function () {
  var reg = { showNotification: function () { return Promise.reject(new Error('no')); } };
  return A.deliver('run-tonight', { place: 'x' }, { storage: null, now: at(23), notification: { permission: 'granted' }, registration: reg }).then(function (r) {
    assert.strictEqual(r, false);
    return A.deliver('level-up', { level: 2 }, { storage: null, now: at(14), notification: { permission: 'granted' }, registration: reg });
  }).then(function (r) {
    assert.strictEqual(r, false);
  });
});

(async function () {
  var out = [];
  for (var i = 0; i < queue.length; i++) { await queue[i][1](); out.push('ok  ' + queue[i][0]); }
  console.log(out.join('\n'));
  console.log('all ' + out.length + ' tests passed');
})().catch(function (e) { console.error('FAILED', e); process.exit(1); });
