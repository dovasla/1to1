'use strict';
// Node test: moments queue. One moment per screen per 30s, reduced motion and low fx off, haptics, sound off by default.
// Run: node tests/moments.test.js
var assert = require('assert');
var path = require('path');
var M = require(path.join(__dirname, '..', 'lib', 'moments.js'));

var t = 0;
var buzzes = [];
var visuals = 0;
var sounds = 0;
function make(env) {
  return M.create({ now: function () { return t; }, vibrate: function (ms) { buzzes.push(ms); }, env: env || {} });
}
function visual() { visuals++; }
function sound() { sounds++; }

// 1. First moment on a screen shows now; second within 30s queues.
var m = make({ soundOn: false });
assert.strictEqual(m.fire('live', { kind: 'bounce', visual: visual }), 'shown');
assert.strictEqual(visuals, 1);
t = 5000;
assert.strictEqual(m.fire('live', { kind: 'toast', visual: visual }), 'queued');
assert.strictEqual(visuals, 1);
assert.strictEqual(m.pending(), 1);

// 2. Flush after 30s plays the queued one.
t = 31000;
assert.strictEqual(m.flush(), 1);
assert.strictEqual(visuals, 2);
assert.strictEqual(m.pending(), 0);

// 3. Other screens are not blocked by this one.
assert.strictEqual(m.fire('home', { kind: 'toast', visual: visual }), 'shown');
assert.strictEqual(visuals, 3);

// 4. Reduced motion: visual off, haptic still fires.
t = 0; buzzes = []; visuals = 0;
var r = make({ reducedMotion: true });
r.fire('live', { kind: 'bounce', visual: visual, haptic: 20 });
assert.strictEqual(visuals, 0);
assert.deepStrictEqual(buzzes, [20]);

// 5. html[data-fx=low] also turns visuals off.
var lo = make({ fxLow: true });
lo.fire('live', { kind: 'bounce', visual: visual });
assert.strictEqual(visuals, 0);

// 6. Sound only when on in Settings.
var s1 = make({ soundOn: false });
s1.fire('live', { kind: 'toast', sound: sound });
assert.strictEqual(sounds, 0);
var s2 = make({ soundOn: true });
s2.fire('live', { kind: 'toast', sound: sound });
assert.strictEqual(sounds, 1);

// 7. Unknown kind is dropped, not shown.
assert.strictEqual(make().fire('x', { kind: 'nonsense', visual: visual }), 'dropped');

// 8. Stale queued moments are dropped on flush.
t = 0;
var st = make();
st.fire('live', { kind: 'toast', visual: visual });
st.fire('live', { kind: 'toast', visual: visual });
t = 200000;
assert.strictEqual(st.flush(), 0);
assert.strictEqual(st.pending(), 0);

// 9. No vibrate function throws: buzz is a no-op.
var quiet = M.create({ now: function () { return 0; }, env: {} });
assert.strictEqual(quiet.fire('a', { kind: 'toast', haptic: true }), 'shown');

console.log('moments: all tests passed');
