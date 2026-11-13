/* XP, level and prestige engine for the player app (pure, no DOM, no storage).
   Works in the browser (window.PlayerXp) and in Node (tests).
   Rules: revamp/build/player-app-plan/XP-SYSTEM.md (sections 1 to 4). Numbers match xp-sim.js.
   Fable review (DECISIONS-AND-BRAND.md section 2, 13 Nov) is applied: curve 30 + 3L per level, 1 XP a point
   (cap 10 a game), win 20, streak counts weeks with one free missed week, XP above level 60 is banked.
   Skill (1 to 30, rules.js) is NOT used here. XP never changes skill, team places, points or wins.
   - RULES: every number in one place.
   - totalForLevel(L), levelOf(xp), tierOf(level), multiplierOf(stars), bankedXp(run)
   - xpForNight(night, streakWeeks, stars): XP for one player's night, with the caps. Returns the breakdown.
     streakWeeks is paid only on the first night of a week (pass 0 for a second night in the same week).
   - newRun(): a fresh run (level 1, 0 XP, 0 stars).
   - applyNight(run, night): returns { run, levelUps } as a NEW run object. The old run is never edited.
   - canPrestige(run) / prestige(run): level 60 makes a player eligible. Prestige is chosen, never automatic.
     XP above level 60 is banked and carries into the next run on prestige.
   - progress(run): level, XP into the level, XP to the next level, banked XP, for the bar.
   - replay(nights, opts): sums one player's nights in order and returns { run, levelUps, nights }.
   A night is { nightNo, week, games: [{ pts, won }], mvp }. nightNo orders and de-duplicates nights.
   week is the weekly index (1, 2, 3...). The streak counts weeks that have at least one night.
   Fouls are not part of a night and can never change XP. A night with no games gives no XP.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlayerXp = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RULES = {
    attendance: 20,        // per night with at least one game played (turn-up)
    perGamePlayed: 10,     // per game on court (fill-ins count)
    perPoint: 1,           // per point: free throw 1, two 2, three 3
    pointCapPerGame: 10,   // points beyond 10 in one game earn nothing
    perWin: 20,            // per game the player's team won
    mvp: 25,               // once a night, the organiser's MVP pick
    streakStep: 5,         // +5 per week in a row, paid once a week
    streakMax: 4,          // up to +20
    missedWeeksAllowed: 1, // one free missed week; two missed weeks in a row reset the streak to 1
    nightCap: 250,         // most XP one night can give, before the prestige multiplier
    levelCap: 60,          // at 60 the player can prestige
    prestigeStep: 0.1,     // +10% XP per star
    prestigeMaxStars: 5    // +50% is the most
  };

  // What each star unlocks (cosmetic or XP speed only). Shop ids come later in cosmetics.json.
  var STAR_UNLOCKS = {
    1: 'Bronze banner, star beside the name, first calling card',
    2: 'Silver banner, clan tag slot, silver name style',
    3: 'Gold banner, animated emblem, gold name style',
    4: 'Black banner, second and third calling cards, prestige tag',
    5: 'Legend banner, animated row effect, legend name style, top calling card'
  };

  // Curve (Fable X1): XP to go from level L to L+1 = 30 + 3 × L.
  // Total XP to reach level L = (L − 1) × (30 + 1.5 × L). Level 60 = 7,080 XP (about one star a year).
  function totalForLevel(L) { return Math.round((L - 1) * (30 + 1.5 * L)); }

  // Level inside the current prestige run (1 to 60), from the XP earned in that run.
  function levelOf(xp) {
    var L = 1;
    while (L < RULES.levelCap && xp >= totalForLevel(L + 1)) L++;
    return L;
  }

  // Badge for a level (shown beside the name).
  function tierOf(L) {
    if (L >= 60) return 'Max';
    if (L >= 50) return 'Legend';
    if (L >= 40) return 'Elite';
    if (L >= 30) return 'Pro';
    if (L >= 20) return 'Veteran';
    if (L >= 10) return 'Regular';
    return 'Rookie';
  }

  // XP multiplier from prestige stars: 1.0 with no star, 1.1 with one, 1.5 at five (and above).
  function multiplierOf(stars) {
    var s = Math.max(0, Math.min(stars | 0, RULES.prestigeMaxStars));
    return Math.round((1 + RULES.prestigeStep * s) * 100) / 100;
  }

  // XP for one player's night. streakWeeks = the streak length paid on this night (0 when it is not the first
  // night of the week). Caps first (points per game, then the night cap), then the prestige multiplier.
  function xpForNight(night, streakWeeks, stars) {
    var games = (night && night.games) || [];
    if (games.length === 0) return { xp: 0, played: 0, parts: {}, raw: 0, capped: 0, multiplier: multiplierOf(stars) };

    var wins = 0;
    var scoring = 0;
    games.forEach(function (g) {
      if (g.won) wins += 1;
      var pts = Math.max(0, Math.floor(Number(g.pts) || 0));
      scoring += Math.min(pts, RULES.pointCapPerGame);
    });

    var parts = {
      turnUp: RULES.attendance,
      games: games.length * RULES.perGamePlayed,
      points: scoring * RULES.perPoint,
      wins: wins * RULES.perWin,
      mvp: night.mvp ? RULES.mvp : 0,
      streak: Math.min(Math.max(0, streakWeeks | 0), RULES.streakMax) * RULES.streakStep
    };
    var raw = parts.turnUp + parts.games + parts.points + parts.wins + parts.mvp + parts.streak;
    var capped = Math.min(raw, RULES.nightCap);
    var multiplier = multiplierOf(stars);
    return { xp: Math.round(capped * multiplier), played: games.length, parts: parts, raw: raw, capped: capped, multiplier: multiplier };
  }

  function newRun() {
    return { xp: 0, lifetimeXp: 0, stars: 0, prestiges: 0, streak: 0, lastWeek: null, lastNight: null, maxLevel: 1 };
  }

  // Adds one night to a run. Duplicates and older nights are ignored. Nights with no games give nothing.
  // Streak (Fable X4): a week counts when it has at least one night. One missed week is free; two in a row reset to 1.
  function applyNight(run, night) {
    if (!night || !night.games || night.games.length === 0) return { run: run, levelUps: [], skipped: true };
    if (run.lastNight !== null && night.nightNo <= run.lastNight) return { run: run, levelUps: [], skipped: true };

    var week = Number(night.week) || night.nightNo;
    var newWeek = run.lastWeek === null || week !== run.lastWeek;
    var streak = run.streak;
    if (run.lastWeek === null) {
      streak = 1;
    } else if (newWeek) {
      var missed = week - run.lastWeek - 1;   // weeks with no night in between
      streak = missed <= RULES.missedWeeksAllowed ? run.streak + 1 : 1;
    }

    var r = xpForNight(night, newWeek ? streak : 0, run.stars);
    var xp = run.xp + r.xp;
    var newMax = Math.max(run.maxLevel, levelOf(xp));

    var levelUps = [];
    for (var L = run.maxLevel + 1; L <= newMax; L++) levelUps.push(L);

    var next = {
      xp: xp,
      lifetimeXp: run.lifetimeXp + r.xp,
      stars: run.stars,
      prestiges: run.prestiges,
      streak: streak,
      lastWeek: newWeek ? week : run.lastWeek,
      lastNight: night.nightNo,
      maxLevel: newMax
    };
    return { run: next, levelUps: levelUps, xp: r.xp, skipped: false };
  }

  function canPrestige(run) { return run.maxLevel >= RULES.levelCap; }

  // XP earned above level 60 in this run. It is banked and carries into the next run on prestige.
  function bankedXp(run) { return Math.max(0, run.xp - totalForLevel(RULES.levelCap)); }

  // Prestige: level back to 1, one more star (top 5). The banked XP becomes the new run's starting XP.
  // Lifetime XP, the streak and the last night and week are kept.
  function prestige(run) {
    if (!canPrestige(run)) return run;
    var carry = bankedXp(run);
    return {
      xp: carry,
      lifetimeXp: run.lifetimeXp,
      stars: Math.min(run.stars + 1, RULES.prestigeMaxStars),
      prestiges: run.prestiges + 1,
      streak: run.streak,
      lastWeek: run.lastWeek,
      lastNight: run.lastNight,
      maxLevel: levelOf(carry)
    };
  }

  // Numbers for the XP bar. Level never goes down inside a run, so it reads maxLevel.
  function progress(run) {
    var L = run.maxLevel;
    var bonusPct = Math.round((multiplierOf(run.stars) - 1) * 100);
    if (L >= RULES.levelCap) {
      return { level: L, tier: tierOf(L), stars: run.stars, bonusPct: bonusPct, isMax: true, canPrestige: true,
        xpInLevel: 0, xpForLevel: null, xpToNext: 0, banked: bankedXp(run), lifetimeXp: run.lifetimeXp };
    }
    var base = totalForLevel(L);
    var need = totalForLevel(L + 1) - base;
    var into = Math.min(need, Math.max(0, run.xp - base));
    return { level: L, tier: tierOf(L), stars: run.stars, bonusPct: bonusPct, isMax: false, canPrestige: false,
      xpInLevel: into, xpForLevel: need, xpToNext: need - into, banked: 0, lifetimeXp: run.lifetimeXp };
  }

  // Sums one player's ledger nights in order. opts.floorLevel keeps the level the player already reached
  // (a corrected night can lower XP, but the shown level never drops).
  function replay(nights, opts) {
    var list = (nights || []).slice().sort(function (a, b) { return a.nightNo - b.nightNo; });
    var run = newRun();
    if (opts && opts.floorLevel) run.maxLevel = Math.min(opts.floorLevel, RULES.levelCap);
    var levelUps = [];
    var perNight = [];
    list.forEach(function (night) {
      var res = applyNight(run, night);
      run = res.run;
      levelUps = levelUps.concat(res.levelUps);
      if (!res.skipped) perNight.push({ nightNo: night.nightNo, xp: res.xp });
    });
    return { run: run, levelUps: levelUps, nights: perNight };
  }

  return {
    RULES: RULES,
    STAR_UNLOCKS: STAR_UNLOCKS,
    totalForLevel: totalForLevel,
    levelOf: levelOf,
    tierOf: tierOf,
    multiplierOf: multiplierOf,
    xpForNight: xpForNight,
    newRun: newRun,
    applyNight: applyNight,
    bankedXp: bankedXp,
    canPrestige: canPrestige,
    prestige: prestige,
    progress: progress,
    replay: replay
  };
});
