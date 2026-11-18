/* Moments: one queue for celebrations (bounce, buzz, toast). Rules:
     - one moment per screen at most every 30 seconds (later ones wait in the queue, or are dropped if stale);
     - prefers-reduced-motion or html[data-fx="low"] turns visual motion off (sound and haptics still follow their own rules);
     - haptics via navigator.vibrate, a silent no-op where missing;
     - sounds are OFF by default, toggled in Me > Settings (stored key: 1to1.sound).
   Pure core: MomentsCore.create(opts) takes injected clock, vibrate and env, so Node tests run without a DOM.
   Browser: window.PlayerMoments. Node tests: tests/moments.test.js.
*/
(function (root) {
  'use strict';

  var MIN_GAP_MS = 30000;   // one moment per screen per this many ms
  var STALE_MS = 120000;    // a queued moment older than this is dropped

  function create(opts) {
    opts = opts || {};
    var now = opts.now || function () { return Date.now(); };
    var vibrate = opts.vibrate || function () {};
    var env = opts.env || {};          // { reducedMotion: bool, fxLow: bool, soundOn: bool }
    var lastByScreen = {};
    var queue = [];

    function motionOff() { return !!(env.reducedMotion || env.fxLow); }

    function buzz(ms) {
      try { vibrate(ms || 20); } catch (e) { /* no vibration here */ }
    }

    // Returns 'shown' | 'queued' | 'dropped'. kind: 'bounce' | 'toast' | 'wave' | 'stamp' | 'badge'.
    function fire(screen, moment) {
      var t = now();
      moment = Object.assign({ kind: 'toast', at: t }, moment || {});
      if (moment.haptic) buzz(moment.haptic === true ? 20 : moment.haptic);
      if (moment.kind !== 'bounce' && moment.kind !== 'wave' && moment.kind !== 'stamp' && moment.kind !== 'badge' && moment.kind !== 'toast') {
        return 'dropped';
      }
      var last = lastByScreen[screen];
      if (last !== undefined && t - last < MIN_GAP_MS) {
        queue.push({ screen: screen, moment: moment, at: t });
        return 'queued';
      }
      lastByScreen[screen] = t;
      return play(moment);
    }

    function play(moment) {
      if (moment.visual && !motionOff() && typeof moment.visual === 'function') moment.visual();
      if (moment.sound && env.soundOn && typeof moment.sound === 'function') moment.sound();
      return 'shown';
    }

    // Call on a timer or after a screen change. Plays the next queued moment for a screen whose gap has passed.
    function flush() {
      var t = now();
      var played = 0;
      queue = queue.filter(function (q) { return t - q.at < STALE_MS; });
      for (var i = 0; i < queue.length; i++) {
        var q = queue[i];
        var last = lastByScreen[q.screen];
        if (last === undefined || t - last >= MIN_GAP_MS) {
          lastByScreen[q.screen] = t;
          play(q.moment);
          queue.splice(i, 1);
          i--;
          played++;
        }
      }
      return played;
    }

    return {
      fire: fire,
      flush: flush,
      pending: function () { return queue.length; },
      setEnv: function (e) { env = Object.assign({}, env, e || {}); }
    };
  }

  var api = { create: create, MIN_GAP_MS: MIN_GAP_MS, STALE_MS: STALE_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerMoments = api;
})(typeof window !== 'undefined' ? window : globalThis);
