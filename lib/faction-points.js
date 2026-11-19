/* Faction points for the player app (pure, no DOM, no storage).
   Works in the browser (window.FactionPoints) and in Node (tests).

   THE FORMULA (one line):
   Each night a player plays = 10 for turning up + 2 per game + 1 per point (max 10 counted per game) + 5 per win.

   Notes:
   - A night with no games earns 0. Fouls and MVP picks never count.
   - Your points add to your faction's total. Your faction is the tree you picked.
   - Season = one calendar month. Only Thursday and Sunday runs count.
   - Everything is in RULES below, so a number can change in one place.

   - nightPoints(night): points for one player's night. night = { games: [{ pts, won }] }.
   - countsForSeason(night, month): true when the night is in that month ('YYYY-MM') and is a Thu or Sun run.
   - seasonStandings(nights, month): one row per faction, sorted by points (high first), then name.
     nights = [{ faction, date: 'YYYY-MM-DD', games: [{ pts, won }] }], one entry per player per night.
     Each row: { faction, name, points, playerNights, wins }.
     Ties are sorted by name for now (the tie rule is an open question for Jord).
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FactionPoints = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RULES = {
    turnUp: 10,          // per night with at least one game (floor, so low scorers still earn)
    perGame: 2,          // per game played
    perPoint: 1,         // per point scored
    pointCapPerGame: 10, // points beyond 10 in one game earn nothing
    perWin: 5,           // per game the player's team won
    countedWeekdays: [4, 0] // Thursday (4) and Sunday (0), as Date.getUTCDay() numbers
  };

  // The five factions. Ids match the tree ids (Fire, Ice, Gold, Storm, Shadow were the old names).
  var FACTIONS = {
    ember:  { name: 'Ember',  wasTree: 'Fire' },
    frost:  { name: 'Frost',  wasTree: 'Ice' },
    brass:  { name: 'Brass',  wasTree: 'Gold' },
    indigo: { name: 'Indigo', wasTree: 'Storm' },
    slate:  { name: 'Slate',  wasTree: 'Shadow' }
  };
  var FACTION_IDS = Object.keys(FACTIONS);

  function nightPoints(night) {
    var games = (night && night.games) || [];
    var parts = { turnUp: 0, games: 0, scoring: 0, wins: 0 };
    if (games.length === 0) return { points: 0, parts: parts };

    var scoring = 0;
    var wins = 0;
    games.forEach(function (g) {
      var pts = Math.max(0, Math.floor(Number(g.pts) || 0));
      scoring += Math.min(pts, RULES.pointCapPerGame);
      if (g.won) wins += 1;
    });

    parts.turnUp = RULES.turnUp;
    parts.games = games.length * RULES.perGame;
    parts.scoring = scoring * RULES.perPoint;
    parts.wins = wins * RULES.perWin;
    var points = parts.turnUp + parts.games + parts.scoring + parts.wins;
    return { points: points, parts: parts };
  }

  function countsForSeason(night, month) {
    if (!night || typeof night.date !== 'string') return false;
    if (night.date.slice(0, 7) !== month) return false;
    var d = new Date(night.date + 'T00:00:00Z');
    if (isNaN(d.getTime())) return false;
    return RULES.countedWeekdays.indexOf(d.getUTCDay()) !== -1;
  }

  function seasonStandings(nights, month) {
    var rows = {};
    FACTION_IDS.forEach(function (id) {
      rows[id] = { faction: id, name: FACTIONS[id].name, points: 0, playerNights: 0, wins: 0 };
    });

    (nights || []).forEach(function (night) {
      if (!night || !rows[night.faction]) return;
      if (!countsForSeason(night, month)) return;
      var games = night.games || [];
      if (games.length === 0) return;
      var row = rows[night.faction];
      row.points += nightPoints(night).points;
      row.playerNights += 1;
      games.forEach(function (g) { if (g.won) row.wins += 1; });
    });

    return FACTION_IDS.map(function (id) { return rows[id]; }).sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }

  return {
    RULES: RULES,
    FACTIONS: FACTIONS,
    FACTION_IDS: FACTION_IDS,
    nightPoints: nightPoints,
    countsForSeason: countsForSeason,
    seasonStandings: seasonStandings
  };
});
