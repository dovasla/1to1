/* 1TO1 player app: sign-up in three boxes (Fable R18, package D2).
   Browser: window.PlayerSignup3Box. Node tests: signup-3box/tests/signup-3box.test.js.

   - readRunCode(search): the 4-digit run code from a link or QR (?code=4821). '' when missing or not 4 digits.
   - runLink(base, code): the link the Door QR holds. base is the page address without a query.
   - validate(input, rules): the three boxes (first name, last initial, PIN). Returns { ok, errors, clean, pin }.
       The under-18 tick is never in clean (form-only, Fable R11). The level is a fixed placeholder; the real skill
       is asked after the first log in (see skillDue).
   - payloadFor(clean): what the sign-up call receives. No door code, no under-18 field.
   - stashRunCode / pendingRunCode / clearRunCode: a scanned code kept on this phone until it is used.
   - markSkillDue / skillDue / skipSkill / markSkillDone: the skill questions, asked once after the first log in.
     States in storage: '' (not asked yet), 'due' (show after log in), 'skipped', 'done'.

   Storage is passed in (localStorage in the browser). Every read and write is safe if storage throws.
   No network, no timers, no innerHTML from data.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerSignup3Box = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CODE_RE = /^[0-9]{4}$/;
  var RUN_KEY = '1to1-run-code';
  var SKILL_KEY = '1to1-skill-ask';
  // Placeholder level sent at sign-up. The real skill comes from the questions after the first log in.
  var DEFAULT_LEVEL = 15;

  function defaultStorage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }
  function store(s) { return s || defaultStorage(); }
  function getItem(s, k) { try { var st = store(s); return st ? (st.getItem(k) || '') : ''; } catch (e) { return ''; } }
  function setItem(s, k, v) { try { var st = store(s); if (st) st.setItem(k, v); return true; } catch (e) { return false; } }
  function removeItem(s, k) { try { var st = store(s); if (st) st.removeItem(k); return true; } catch (e) { return false; } }

  function readRunCode(search) {
    var v = '';
    try { v = new URLSearchParams(String(search || '')).get('code') || ''; } catch (e) { v = ''; }
    v = v.replace(/\s+/g, '');
    return CODE_RE.test(v) ? v : '';
  }

  function runLink(base, code) {
    var b = String(base || '').split('?')[0].split('#')[0];
    return b + '?code=' + encodeURIComponent(String(code || ''));
  }

  function rulesApi(rules) {
    var r = rules || (typeof window !== 'undefined' && window.PlayerRules) || null;
    if (!r) throw new Error('PlayerRules is not loaded');
    return r;
  }

  // The three boxes. first and lastInitial go through PlayerRules (same rules as the app). PIN: exactly 4 digits.
  function validate(input, rules) {
    input = input || {};
    var r = rulesApi(rules);
    var v = r.validateSignup({ first: input.first, lastInitial: input.lastInitial, level: DEFAULT_LEVEL });
    var errors = {};
    Object.keys(v.errors || {}).forEach(function (k) { if (k !== 'level') errors[k] = v.errors[k]; });
    var pin = r.validatePin(input.pin);
    if (!pin.ok) errors.pin = pin.error;
    var ok = Object.keys(errors).length === 0;
    var clean = null;
    if (ok) {
      clean = { first: v.clean.first, lastInitial: v.clean.lastInitial, level: DEFAULT_LEVEL };
      // Surname extra letters: only sent when the name is already taken (unique-name rule, Fable A2).
      var extra = String(input.extra || '').replace(/[^A-Za-z]/g, '').toLowerCase();
      if (extra) clean.extra = extra;
    }
    return { ok: ok, errors: errors, clean: clean, pin: ok ? pin.pin : '' };
  }

  // The payload for the sign-up call. Keeps only the fields the server needs.
  function payloadFor(clean) {
    var out = { first: clean.first, lastInitial: clean.lastInitial, level: clean.level };
    if (clean.extra) out.extra = clean.extra;
    return out;
  }

  function stashRunCode(s, code) {
    if (!CODE_RE.test(String(code || ''))) return false;
    return setItem(s, RUN_KEY, String(code));
  }
  function pendingRunCode(s) {
    var c = getItem(s, RUN_KEY);
    return CODE_RE.test(c) ? c : '';
  }
  function clearRunCode(s) { return removeItem(s, RUN_KEY); }

  // Called after the first log in. The skill questions show once, with Skip always on screen.
  function markSkillDue(s) { return getItem(s, SKILL_KEY) === '' ? setItem(s, SKILL_KEY, 'due') : false; }
  // serverDone: true when skillStatus says the questions were already answered.
  function skillDue(s, serverDone) {
    if (serverDone === true) { setItem(s, SKILL_KEY, 'done'); return false; }
    return getItem(s, SKILL_KEY) === 'due';
  }
  function skipSkill(s) { return setItem(s, SKILL_KEY, 'skipped'); }
  function markSkillDone(s) { return setItem(s, SKILL_KEY, 'done'); }

  return {
    DEFAULT_LEVEL: DEFAULT_LEVEL,
    RUN_KEY: RUN_KEY,
    SKILL_KEY: SKILL_KEY,
    readRunCode: readRunCode,
    runLink: runLink,
    validate: validate,
    payloadFor: payloadFor,
    stashRunCode: stashRunCode,
    pendingRunCode: pendingRunCode,
    clearRunCode: clearRunCode,
    markSkillDue: markSkillDue,
    skillDue: skillDue,
    skipSkill: skipSkill,
    markSkillDone: markSkillDone
  };
});
