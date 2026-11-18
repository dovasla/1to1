'use strict';
// Node test: "Run tonight" hook fires once, only when the first game starts today. Run: node tests/run-alerts-hook.test.js
var assert = require('assert');
var path = require('path');
var H = require(path.join(__dirname, '..', 'lib', 'run-alerts-hook.js'));

var now = new Date(2026, 10, 18, 14, 0, 0);
var tonight = new Date(2026, 10, 18, 19, 30, 0).toISOString();
var tomorrow = new Date(2026, 10, 19, 19, 30, 0).toISOString();

function fakeDeliver(calls, result) {
  return {
    deliver: function (type, data, deps) { calls.push([type, data.time, !!deps.registration]); return Promise.resolve(result); }
  };
}

(async function () {
  var out = [];

  assert.strictEqual(H.firstStart({ games: [] }), null);
  assert.strictEqual(H.hhmm(new Date(2026, 10, 18, 19, 30)), '7:30 pm');
  out.push('ok  firstStart and time wording');

  var calls = [];
  global.PlayerAlerts = fakeDeliver(calls, true);
  Object.defineProperty(global, 'navigator', { value: { serviceWorker: { ready: Promise.resolve({ showNotification: function () {} }) } }, configurable: true });
  Object.defineProperty(global, 'localStorage', { value: (function () { var m = {}; return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); } }; })(), configurable: true });
  var ok1 = await H.onNight({ games: [{ startsAt: tonight }, { startsAt: tonight }] }, now);
  assert.strictEqual(ok1, true);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][1], '7:30 pm');
  out.push('ok  fires for a run tonight');

  var ok2 = await H.onNight({ games: [{ startsAt: tonight }] }, now);
  assert.strictEqual(ok2, false);
  assert.strictEqual(calls.length, 1, 'once per day');
  out.push('ok  does not fire twice the same day');

  global.localStorage.setItem('p1to1.alerts.runTonightDay', '');
  var ok3 = await H.onNight({ games: [{ startsAt: tomorrow }] }, now);
  assert.strictEqual(ok3, false);
  assert.strictEqual(calls.length, 1, 'tomorrow does not fire');
  out.push('ok  does not fire for tomorrow');

  console.log(out.join('\n'));
  console.log('all ' + out.length + ' tests passed');
})().catch(function (e) { console.error('FAILED', e); process.exit(1); });
