/* Player app rules (pure, no DOM, no storage). Works in the browser (window.PlayerRules) and in Node (tests).
   - SKILL_LEVELS: the 30 named levels, 1 (Noob) to 30 (HIM). Stage 1 sign-up uses one slider with these.
   - validateSignup(input): checks a sign-up: first name + last initial, one level 1 to 30. Returns { ok, errors, clean }.
   - levelLabel(level): the name for a level.
   - ratingFromLevel(level): the rating the organiser balances on, 1.0 (level 1) to 10.0 (level 30). Linear placeholder.
   - keyFor(first, lastInitial): the key the organiser uses to spot a duplicate (first|initial, lower case).
   - toRegular(clean, id): the organiser regulars record for an approved sign-up.
   - toRegularsCsv(list): CSV in the organiser's regulars column order, so the existing Import (add by id) takes it.
   - mergeApproved(list, approved): add-only. Never removes or changes a record already in the list.
   - isRunTime(date, windows): true inside a run window (local time). Standings refresh only then.
   - newCode(random): a 6 letter/number code for a player. No 0, O, 1, I, L.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerRules = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Named skill levels from the organiser (13 Nov). Index 0 is level 1.
  var SKILL_LEVELS = [
    'Noob', 'Fresh Out the Box', 'Still Learning', 'Brick Layer', 'Airball Artist',
    'Bench Warmer', 'Warming Up', 'Not Bad', 'Decent Hands', 'Has a Jump Shot',
    'Knows the Plays', 'Steady Starter', 'Solid Role Player', 'Park Regular', 'Handles Pressure',
    'Dependable', 'Good Hooper', 'Bucket Getter', 'Problem for Defenders', 'Sharp Shooter',
    'Ankle Breaker', 'Court General', 'Run Leader', 'Local Legend', 'Walking Bucket',
    'Cold Blooded', 'Menace', 'All-Star', 'Cheat Code', 'HIM'
  ];

  // Default run windows (local time). day: index 0 to 6 from the start of the week. Hours are 24h.
  var RUN_WINDOWS = [
    { day: 0, startHour: 11, endHour: 13 },
    { day: 4, startHour: 20, endHour: 22 }
  ];

  var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  var REG_COLS = ['id', 'name', 'first', 'lastInitial', 'phoneLast4', 'rating', 'payHistoryCount', 'noShows'];

  function cleanName(s) {
    return String(s == null ? '' : s)
      .replace(/[​-‏‪-‮⁠-⁯﻿]/g, '')   // hidden marks
      .trim().replace(/\s+/g, ' ');
  }

  function titleCase(s) {
    return s.toLowerCase().replace(/(^|[ '-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }

  function levelLabel(level) {
    var n = Math.round(Number(level));
    return n >= 1 && n <= SKILL_LEVELS.length ? SKILL_LEVELS[n - 1] : '';
  }

  function validateSignup(input) {
    input = input || {};
    var errors = {};
    var first = cleanName(input.first);
    var li = cleanName(input.lastInitial).replace(/\.$/, '').toUpperCase();

    if (!first) errors.first = 'Add your first name.';
    else if (first.length > 20) errors.first = 'Keep it under 20 letters.';
    else if (!/^[A-Za-z][A-Za-z'\- ]*$/.test(first)) errors.first = 'Use letters only.';

    if (!li) errors.lastInitial = 'Add the first letter of your last name.';
    else if (!/^[A-Z]$/.test(li)) errors.lastInitial = 'Just one letter, no full name.';

    var lv = Number(input.level);
    var level = null;
    if (Number.isInteger(lv) && lv >= 1 && lv <= SKILL_LEVELS.length) level = lv;
    else errors.level = 'Slide to pick your level.';

    var ok = Object.keys(errors).length === 0;
    return {
      ok: ok,
      errors: errors,
      clean: ok ? { first: titleCase(first), lastInitial: li, level: level, under18: input.under18 === true } : null
    };
  }

  // The PIN is exactly 4 digits. It is checked and hashed on the server. This only checks the shape.
  function validatePin(pin) {
    var p = String(pin == null ? '' : pin).trim();
    return /^[0-9]{4}$/.test(p) ? { ok: true, pin: p } : { ok: false, error: 'Use 4 digits.' };
  }

  function keyFor(first, lastInitial) {
    return (cleanName(first) + '|' + cleanName(lastInitial).charAt(0)).toLowerCase();
  }

  function ratingFromLevel(level) {
    var n = Math.min(SKILL_LEVELS.length, Math.max(1, Math.round(Number(level)) || 1));
    // Level 1 maps to 1.0, level 30 maps to 10.0.
    return Math.round((1 + (n - 1) * 9 / (SKILL_LEVELS.length - 1)) * 10) / 10;
  }

  // Skill on the organiser's 1 to 1000 scale (the number teams are built on). Placeholder from the 1 to 30 pick:
  // level 1 = 100, level 30 = 1000, linear. Same as signups_set_placeholder() in supabase/migration-6-skill.sql.
  function skillScoreFromLevel(level) {
    var n = Math.min(SKILL_LEVELS.length, Math.max(1, Math.round(Number(level)) || 1));
    return Math.round(100 + (n - 1) * 900 / (SKILL_LEVELS.length - 1));
  }

  // Score from the skill questions, 100 to 1000. Answers: exp, shoot, dribble, run (each 1 to 10, the hidden
  // value of the card picked) and height (inches, 53 to 84). Weights 40/20/15/15/10 (Fable 23:14), as in
  // off-rating.js. Same maths as skill_score_from_answers() in supabase/migration-6-skill.sql (the server copy wins).
  var SKILL_WEIGHTS = { exp: 0.40, shoot: 0.20, dribble: 0.15, run: 0.15, height: 0.10 };
  function skillScoreFromAnswers(a) {
    if (!a) return null;
    var keys = ['exp', 'shoot', 'dribble', 'run', 'height'];
    for (var i = 0; i < keys.length; i++) if (!isFinite(Number(a[keys[i]]))) return null;
    var h = Math.min(84, Math.max(53, Number(a.height)));
    var heightValue = 1 + (h - 53) * 9 / 31;
    var raw = SKILL_WEIGHTS.exp * Number(a.exp) + SKILL_WEIGHTS.shoot * Number(a.shoot) +
              SKILL_WEIGHTS.dribble * Number(a.dribble) + SKILL_WEIGHTS.run * Number(a.run) +
              SKILL_WEIGHTS.height * heightValue;
    return Math.min(1000, Math.max(100, Math.round(raw * 100)));
  }

  // XP level is separate from skill. Everyone starts at 1. Sign-up never sets it; games and attendance will.
  var XP_START_LEVEL = 1;

  function toRegular(clean, id) {
    return {
      id: id,
      name: clean.first + ' ' + clean.lastInitial,
      first: clean.first,
      lastInitial: clean.lastInitial,
      phoneLast4: '',
      rating: skillScoreFromLevel(clean.level),   // placeholder, 100 to 1000 (organiser scale)
      level: clean.level,                     // skill pick (1 to 30)
      xpLevel: XP_START_LEVEL,                // XP level, separate from skill
      payHistory: [],
      noShows: 0,
      under18: clean.under18 === true,
      source: 'sign-up'
    };
  }

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toRegularsCsv(list) {
    var rows = [REG_COLS.join(',')];
    (list || []).forEach(function (r) {
      rows.push([r.id, r.name, r.first, r.lastInitial, r.phoneLast4, r.rating,
        Array.isArray(r.payHistory) ? r.payHistory.length : 0, r.noShows || 0].map(csvCell).join(','));
    });
    return rows.join('\r\n') + '\r\n';
  }

  // Add only. A record is skipped when its id or its first|initial key is already on the list.
  function mergeApproved(list, approved) {
    var out = (list || []).slice();
    var ids = {}, keys = {};
    out.forEach(function (r) { ids[String(r.id)] = true; keys[keyFor(r.first, r.lastInitial)] = true; });
    var added = 0, skipped = 0;
    (approved || []).forEach(function (a) {
      var k = keyFor(a.first, a.lastInitial);
      if (ids[String(a.id)] || keys[k]) { skipped++; return; }
      out.push(a);
      ids[String(a.id)] = true;
      keys[k] = true;
      added++;
    });
    return { list: out, added: added, skipped: skipped };
  }

  function isRunTime(date, windows) {
    var d = date || new Date();
    var w = windows || RUN_WINDOWS;
    var day = d.getDay(), h = d.getHours() + d.getMinutes() / 60;
    return w.some(function (x) { return x.day === day && h >= x.startHour && h < x.endHour; });
  }

  function newCode(random) {
    var r = random || Math.random;
    var s = '';
    for (var i = 0; i < 6; i++) s += CODE_CHARS.charAt(Math.floor(r() * CODE_CHARS.length));
    return s;
  }

  // Username: the name other players see (migration-44). 3 to 14 letters, digits or underscore.
  var USERNAME_RE = /^[A-Za-z0-9_]{3,14}$/;
  var USERNAME_HELP = '3 to 14 letters, numbers or _. No spaces.';

  function validateUsername(raw) {
    var v = String(raw == null ? '' : raw).trim();
    return USERNAME_RE.test(v) ? { ok: true, value: v } : { ok: false, error: USERNAME_HELP };
  }

  // The name the box starts with: first name, last initial and any extra letters (e.g. RobC). Same base as the server.
  function defaultUsername(first, li, extra) {
    var s = titleCase(cleanName(first).toLowerCase()) + cleanName(li).toUpperCase() + cleanName(extra).toLowerCase();
    return s.replace(/[^A-Za-z0-9]/g, '').slice(0, 14);
  }

  return {
    USERNAME_HELP: USERNAME_HELP,
    validateUsername: validateUsername,
    defaultUsername: defaultUsername,
    SKILL_LEVELS: SKILL_LEVELS,
    XP_START_LEVEL: XP_START_LEVEL,
    RUN_WINDOWS: RUN_WINDOWS,
    cleanName: cleanName,
    levelLabel: levelLabel,
    validateSignup: validateSignup,
    validatePin: validatePin,
    keyFor: keyFor,
    ratingFromLevel: ratingFromLevel,
    skillScoreFromLevel: skillScoreFromLevel,
    skillScoreFromAnswers: skillScoreFromAnswers,
    toRegular: toRegular,
    toRegularsCsv: toRegularsCsv,
    mergeApproved: mergeApproved,
    isRunTime: isRunTime,
    newCode: newCode
  };
});
