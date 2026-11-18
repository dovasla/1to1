/* Sound setting: celebration sounds are OFF by default. Stored as 1to1.sound in localStorage (per phone).
   Every read and write is wrapped, so a blocked store just means "off". Also tells PlayerMoments.
   Browser: window.PlayerSound.get() / set(bool). Node test: tests/sound-setting.test.js. */
(function (root) {
  'use strict';
  var KEY = '1to1.sound';

  function store() { try { return root.localStorage || null; } catch (e) { return null; } }

  function get() {
    try { var s = store(); return !!s && s.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  function set(on) {
    var v = !!on;
    try { var s = store(); if (s) s.setItem(KEY, v ? '1' : '0'); } catch (e) { /* blocked: stays for this visit */ }
    return v;
  }

  var api = { KEY: KEY, get: get, set: set };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PlayerSound = api;
})(typeof window !== 'undefined' ? window : globalThis);
