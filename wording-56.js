/* Patch W56 (next-67g, updated R140): player wording for the lock lines, sign-up cap, reserved name and name change.
   Pure functions, no DOM. Integrator loads this file once and calls the helpers where the old strings are.
   Rules (R140): 20 free wrong tries, then a 1-minute pause every 10 more, hard stop at 100 a day (code: 60 a run).
   Tries-left shows only when 3 or fewer are left before a pause. Reasons and fields come from migration-56 and migration-44. */
(function (root) {
  'use strict';

  // Sign-in pause (server reason 'pause'): one minute, no clock time.
  function signinPause() {
    return 'Too many wrong tries. Try again in 1 minute, or ask the organiser.';
  }

  // Sign-in hard stop (server reason 'hard-stop'): the player resets the PIN with the organiser's help.
  function signinHardStop() {
    return 'Too many wrong tries today. Ask the organiser to reset your PIN, it takes one tap.';
  }

  // Code entry pause (server reason 'pause' from player_check_in): one minute.
  function codePause() {
    return 'Too many tries. Try again in 1 minute, or ask the organiser.';
  }

  // Code entry hard stop (60 a run): the organiser lets the player in on the Door screen.
  function codeHardStop() {
    return 'Too many tries today. Ask the organiser to let you in.';
  }

  // Tries-left line. Shown only when 3 or fewer tries are left before a pause. Otherwise null (no counter).
  function triesLeft(n) {
    if (typeof n !== 'number' || !(n >= 1) || n > 3) return null;
    return n === 1 ? '1 try left before a short pause.' : n + ' tries left before a short pause.';
  }

  // Sign-up reasons: 'busy' is the daily cap (300). 'name-reserved' from migration-48.
  // 'bad-name' comes with a hint: 'first-name' or 'extra-letters' (migration 56).
  function signupMessage(reason, hint) {
    if (reason === 'busy') return 'Sign-up is full for today. Ask the organiser at the desk.';
    if (reason === 'name-reserved') return 'That first name is kept for the club. Try another first name.';
    if (reason === 'bad-name' && hint === 'first-name') return 'The first name has a wrong character or is too long. Use letters, up to 20.';
    if (reason === 'bad-name' && hint === 'extra-letters') return 'The letters after the initial are wrong. Use letters only, up to 10.';
    if (reason === 'bad-name') return 'The name has a wrong part. Check the first name and the letters after the initial.';
    return null;
  }

  // Name change too soon (migration 44 returns next_change_at). Date only when the field is live and passed in.
  function nameTooSoon(nextChangeAt) {
    var d = nextChangeAt ? new Date(nextChangeAt) : null;
    if (d && !isNaN(d.getTime())) {
      var s = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
      return 'You can change your name again on ' + s + '. Ask the organiser to reset it.';
    }
    return 'You can change your name again later. Ask the organiser to reset it.';
  }

  // One call for the lock reasons: kind is 'signin' or 'code', reason is 'pause' or 'hard-stop'.
  function lockMessage(kind, reason) {
    if (kind === 'signin') return reason === 'hard-stop' ? signinHardStop() : signinPause();
    if (kind === 'code') return reason === 'hard-stop' ? codeHardStop() : codePause();
    return null;
  }

  var api = {
    signinPause: signinPause, signinHardStop: signinHardStop, codePause: codePause, codeHardStop: codeHardStop,
    triesLeft: triesLeft, signupMessage: signupMessage, nameTooSoon: nameTooSoon, lockMessage: lockMessage
  };
  root.WORDING56 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
