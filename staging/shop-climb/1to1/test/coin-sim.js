// Climb coin balance sim. Run: node test/coin-sim.js
// Uses copies of the real XP engine (test/ref/xp.js from lib/xp.js) and catalogue (test/ref/items-136.json).
// Shows: weeks to each climb pick level, and climb coins per run, for each coin formula.
var path = require('path');
var ref = path.join(__dirname, 'ref');
var XP = require(path.join(ref, 'xp.js'));
var items = require(path.join(ref, 'items-136.json'));
var prices = (Array.isArray(items) ? items : (items.items || [])).map(function (i) { return i.price; })
  .filter(function (p) { return typeof p === 'number' && p > 0; }).sort(function (a, b) { return a - b; });
var pct = function (q) { return prices[Math.min(prices.length - 1, Math.floor(prices.length * q))]; };

var PICKS = []; for (var L = 3; L <= 60; L += 3) PICKS.push(L);
var FORMULAS = {
  'A flat 150 (current)': function () { return 150; },
  'B 40 + 6L': function (L) { return 40 + 6 * L; },
  'C 60 + 10L': function (L) { return 60 + 10 * L; }
};

// A typical player's night: 3 games, 12 points each, 1 win in 2 games, 1 MVP in 10 nights (a stand-in).
function nightFor(n) {
  return { nightNo: n, week: n, mvp: n % 10 === 0,
    games: [{ pts: 12, won: n % 2 === 0 }, { pts: 12, won: false }, { pts: 12, won: n % 2 === 1 }] };
}

// Nights (and so weeks, at one night per week) for a player to reach each pick level, with 1 star = none.
function nightsToLevel(target) {
  var run = XP.newRun(), n = 0;
  while (XP.levelOf(run.xp) < target && n < 500) {
    n += 1;
    run = XP.applyNight(run, nightFor(n)).run;
  }
  return n;
}

var out = [];
out.push('Climb coin balance sim (run with: node test/coin-sim.js)');
out.push('Catalogue: ' + prices.length + ' priced items. Price p25 ' + pct(0.25) + ', median ' + pct(0.5) + ', p75 ' + pct(0.75) + ', max ' + pct(1) + '.');
out.push('Player: 3 games a night, 12 points a game, 1 MVP in 10 nights, one night a week, no prestige stars.');
out.push('');
out.push('Weeks to reach each pick level (one night a week):');
var weeksAt = {};
PICKS.forEach(function (L) { weeksAt[L] = nightsToLevel(L); });
out.push(PICKS.map(function (L) { return 'L' + L + ':' + weeksAt[L]; }).join('  '));
out.push('');
Object.keys(FORMULAS).forEach(function (name) {
  var f = FORMULAS[name];
  var total = PICKS.reduce(function (s, L) { return s + f(L); }, 0);
  var weeks = weeksAt[60];
  var perWeek = Math.round(total / weeks);
  out.push(name + ': ' + total + ' coins per full run, about ' + perWeek + ' a week at one night a week, ' +
    'so a p25 item (' + pct(0.25) + ') takes ' + Math.ceil(pct(0.25) / perWeek) + ' weeks and a median item (' +
    pct(0.5) + ') takes ' + Math.ceil(pct(0.5) / perWeek) + ' weeks from climb coins alone.');
});
out.push('');
out.push('Note: the live shop also earns coins from levels (_shop_earned). That formula is not in the files this sim could read,');
out.push('so these numbers are climb coins only. Check them against live _shop_earned before setting the final formula.');
console.log(out.join('\n'));
