/* Streaks and attendance badges (player app, package N5). Browser: window.PlayerStreaks. Node tests: streaks.test.js.
   Pure: no network, no storage. The server answers the numbers (supabase/migration-16-streaks.sql).
   Rules: revamp/build/player-app-plan/XP-SYSTEM.md (streak: +5 a week, up to +20; one missed week is free;
   two in a row reset to 1; the bonus is paid once a week). Engine numbers come from lib/xp.js (PlayerXp.RULES).
   This file gives no XP and no coins. Badges here are for display only.

   summarize(input)   input = { streakRun, lastWeek, nightsTotal, nextWeek }
                      streakRun   = weeks in a row (server: streak_run of the newest counted night)
                      lastWeek    = week number of the newest counted night (null if none)
                      nightsTotal = nights with at least one game played (attendance)
                      nextWeek    = week number of the next night, or 0 / null when unknown
   Returns a view with plain words ready to show (see the fields at the bottom of summarize).

   slotHtml(view)     Home slot "Streak" (card). Register it in Home with order 30 (see HOOKS.md).
   badgesHtml(view)   Profile row of attendance badges.
*/
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerStreaks = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  // Engine numbers. Read from lib/xp.js when it is loaded; these are the same values (checked in the tests).
  var XP = root.PlayerXp || null;
  if (!XP && typeof require === 'function') { try { XP = require('../../lib/xp.js'); } catch (e) { XP = null; } }
  var STEP = (XP && XP.RULES.streakStep) || 5;      // +5 XP per week in a row
  var CAP = (XP && XP.RULES.streakMax) || 4;        // up to 4 weeks of bonus, so +20
  var BADGES = [5, 10, 25, 50, 100];                // attendance badges, by nights played

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function int(n) { var v = Math.round(Number(n)); return isFinite(v) ? v : 0; }
  function bonus(weeks) { return Math.min(Math.max(0, weeks), CAP) * STEP; }
  function plural(n, one, many) { return n === 1 ? n + ' ' + one : n + ' ' + many; }

  // Everything the Streak card and the badge row show, worked out from the server numbers. Pure.
  function summarize(input) {
    input = input || {};
    var weeks = Math.max(0, int(input.streakRun));
    var nights = Math.max(0, int(input.nightsTotal));
    var nextWeek = int(input.nextWeek);
    var known = nextWeek > 0 && input.lastWeek != null;
    var gap = known ? nextWeek - int(input.lastWeek) : null;   // 1 = the next week follows on; 2 = one week missed already

    var state, title, line, shield, nextXp, thisXp = 0, played = false;

    if (weeks === 0) {
      state = 'none';
      title = 'No streak yet';
      line = 'Play one run to start a streak.';
      shield = false;
      nextXp = bonus(1);
    } else if (!known) {
      // Next week is not known yet: say what keeps it going, do not claim a result.
      state = 'unknown';
      title = plural(weeks, 'week running', 'weeks running');
      line = 'Play your next run to keep it going.';
      shield = true;
      nextXp = bonus(weeks + 1);
    } else if (gap <= 0) {
      // Already played this week. The bonus for this week is paid.
      state = 'safe';
      played = true;
      thisXp = bonus(weeks);
      title = plural(weeks, 'week running', 'weeks running');
      line = '+' + thisXp + ' XP streak bonus is in for this week.';
      shield = true;
      nextXp = bonus(weeks + 1);
    } else if (gap === 1) {
      state = 'safe';
      title = plural(weeks, 'week running', 'weeks running');
      line = 'Play next week for +' + bonus(weeks + 1) + ' XP.';
      shield = true;
      nextXp = bonus(weeks + 1);
    } else if (gap === 2) {
      // One week already missed (the free miss). Next week must be played or the streak resets.
      state = 'at-risk';
      title = plural(weeks, 'week running', 'weeks running');
      line = 'Play next week or the streak resets.';
      shield = false;
      nextXp = bonus(weeks + 1);
    } else {
      state = 'reset';
      title = 'Streak ended';
      line = 'Play next week to start again at 1 week.';
      shield = false;
      nextXp = bonus(1);
    }

    // Badges: unlock at the exact night count. The next one shows how many nights to go.
    var badges = BADGES.map(function (at) {
      var unlocked = nights >= at;
      return { at: at, label: at + ' runs', unlocked: unlocked, toGo: unlocked ? 0 : at - nights };
    });
    var nextBadge = null;
    for (var i = 0; i < badges.length; i++) { if (!badges[i].unlocked) { nextBadge = badges[i]; break; } }

    return {
      state: state,              // none | unknown | safe | at-risk | reset
      weeks: weeks,
      played: played,            // this week's bonus is already paid
      thisXp: thisXp,            // bonus paid this week (0 if not played yet)
      nextXp: nextXp,            // bonus the next counted night gives
      shield: shield,            // one missed week would still keep the streak
      title: title,
      line: line,
      nights: nights,
      badges: badges,
      nextBadge: nextBadge,
      badgeLine: nextBadge
        ? plural(nextBadge.toGo, 'run', 'runs') + ' to ' + nextBadge.at + ' runs.'
        : 'All attendance badges earned.'
    };
  }

  var SHIELD_SVG = '<svg class="st-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 19 6v5.6c0 4.2-2.9 7.6-7 9.2-4.1-1.6-7-5-7-9.2V6z"/><path d="M9 12.2l2.1 2.1L15.2 10"/></svg>';

  // Home card. Fixed size, big number first. No chevrons, no emoji.
  function slotHtml(v) {
    v = v || summarize({});
    var shown = v.state === 'reset' ? 0 : v.weeks;
    var big = shown > 0 ? '<span class="st-big">' + shown + '</span>' : '<span class="st-big st-big-off">0</span>';
    var shield = v.shield && shown > 0
      ? '<p class="st-shield">' + SHIELD_SVG + '<span>One missed week is covered</span></p>' : '';
    return '' +
      '<section class="st-card st-' + esc(v.state) + '" data-slot="streak" aria-label="Streak">' +
        '<div class="st-top">' +
          '<div class="st-num">' + big + '<span class="st-unit">' + (v.weeks === 1 ? 'Week' : 'Weeks') + '</span></div>' +
          '<div class="st-words">' +
            '<h2 class="st-head">Streak</h2>' +
            '<p class="st-title">' + esc(v.title) + '</p>' +
          '</div>' +
        '</div>' +
        '<p class="st-line">' + esc(v.line) + '</p>' +
        shield +
      '</section>';
  }

  // Profile row. Unlocked badges are yellow; locked ones show the goal in plain words.
  function badgesHtml(v) {
    v = v || summarize({});
    var chips = v.badges.map(function (b) {
      if (b.unlocked) {
        return '<li class="st-badge st-badge-on" aria-label="' + esc(b.label) + ' unlocked">' +
          '<span class="st-badge-n">' + b.at + '</span><span class="st-badge-t">runs</span></li>';
      }
      return '<li class="st-badge st-badge-off" aria-label="' + esc(b.label) + ', locked, ' + b.toGo + ' to go">' +
        '<span class="st-badge-n">' + b.at + '</span><span class="st-badge-t">' + esc(plural(b.toGo, 'to go', 'to go')) + '</span></li>';
    }).join('');
    return '' +
      '<section class="st-badges" data-slot="attendance" aria-label="Attendance badges">' +
        '<h2 class="st-head">Attendance</h2>' +
        '<p class="st-line">' + esc(v.badgeLine) + '</p>' +
        '<ul class="st-badge-row">' + chips + '</ul>' +
      '</section>';
  }

  return {
    BADGES: BADGES,
    STEP: STEP,
    CAP: CAP,
    summarize: summarize,
    bonus: bonus,
    slotHtml: slotHtml,
    badgesHtml: badgesHtml
  };
});
