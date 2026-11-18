# Climb coin formula and balance sim (18 Nov)

Decision: climb pick coins = 40 + 6 x level (levels 3 to 60: 58 coins at level 3, 400 at level 60).
Replaces the flat 150. Provisional until the live _shop_earned formula is checked against it.

Why: a flat 150 gives the same pay at level 3 and level 60. The new formula pays more for the big picks, which fits the
"hit a high unlock" feel. A full run pays 4,580 coins, about 1.5 times the old 3,000, so it does not empty the shop.

Sim output (test/coin-sim.js, real XP engine and real catalogue prices):

```
Climb coin balance sim (run with: node test/coin-sim.js)
Catalogue: 118 priced items. Price p25 300, median 1200, p75 3800, max 5600.
Player: 3 games a night, 12 points a game, 1 MVP in 10 nights, one night a week, no prestige stars.

Weeks to reach each pick level (one night a week):
L3:1  L6:1  L9:2  L12:3  L15:4  L18:5  L21:6  L24:7  L27:8  L30:10  L33:11  L36:13  L39:15  L42:16  L45:18  L48:20  L51:23  L54:25  L57:27  L60:30

A flat 150 (current): 3000 coins per full run, about 100 a week at one night a week, so a p25 item (300) takes 3 weeks and a median item (1200) takes 12 weeks from climb coins alone.
B 40 + 6L: 4580 coins per full run, about 153 a week at one night a week, so a p25 item (300) takes 2 weeks and a median item (1200) takes 8 weeks from climb coins alone.
C 60 + 10L: 7500 coins per full run, about 250 a week at one night a week, so a p25 item (300) takes 2 weeks and a median item (1200) takes 5 weeks from climb coins alone.

Note: the live shop also earns coins from levels (_shop_earned). That formula is not in the files this sim could read,
so these numbers are climb coins only. Check them against live _shop_earned before setting the final formula.
```

Open: the live shop also earns coins from levels (_shop_earned). The SQL thread should confirm the total against it.
