# Climb review checklist (from CLIMB-REVIEW-OPUS-18NOV.md), 18 Nov

Owners: **me** = shop/climb thread. **recap/hype** = recap and hype thread. **rival** = weekly rival thread. **organiser** = organiser app. **Jord** = decision.
Status: done / in progress / not started. Chunks land in shop-redesign-18nov/staging/ (zip: climb-v3-18nov.zip).

## 3. Improvements to what exists
| Item | Owner | Status | Note |
|---|---|---|---|
| 3.1 Merge the two reward systems (trees = perks, titles, coins; shop = looks) | me | shipped (per coordinator, 3827791) | Trees have no looks (SQL). Climb is inside the shop screen (staged). Live phone check still to do. |
| 3.2 Real pick choices (perk, title, coins; max 3 perks, a full perk replaces the oldest) | me | done | SQL v2. Plain descriptions on each option. Fire and Ice have no live perks yet (shot data). |
| 3.3 Respec (clear tree and picks, one free respec ever, no paid respec) | me | done | v3 SQL: one respec ever, no coins. Screens done, tested in harness. |
| 3.4a Perk list: GAMIFICATION one | me | done | Middy +2 used. |
| 3.4b Shot perks off until organiser records 1s, 2s, 3s | me | done | Marked live = false. |
| 3.4c Drop weekly-night perks (Crown Week, Double Trouble) | me | done | Not in the list. |
| 3.4d Shadow Wins vs Lightning fixed (two different perks) | me | done | |
| 3.4e Auto-offer the tree at level 3 | me | done | Tree picker on first entry, with Skip. |
| 3.4f Server coin formula (or document flat 150) | me | done (40 + 6 x level, provisional) | Using flat 150 for picks. Documented in CLIMB notes; simulation still to run. |
| 3.4g Balance simulation (coins vs prices) | me | done (test/coin-sim.js, revamp/COIN-BALANCE-SIM-18NOV.md). Perk XP sim waits on award wiring. | Needs the XP award function, not built. |
| 3.5a Tier shown once on reward cards | me | done | |
| 3.5b Preview shows the player's own name | me | done | |
| 3.5c Red Hot preview colour | me | done in CSS | SQL item names unchanged. |
| 3.5d "Wearing" chip in yellow | me | done | Text and colour in staged shop files. |

## 4. Abuse and fairness guards
| Guard | Owner | Status | Note |
|---|---|---|---|
| Rival farming: rival within ±5 levels or auto-picked | rival | not started | Rival thread builds the matcher. Climb rival perk removed from pick list. |
| Three chucking: no 3s challenges | me | done | No challenge uses 3s. Shot perks off. |
| MVP vote trading: Gold perks count organiser MVP only | me | done | No player-vote MVP anywhere. |
| First Ten boost tied to checked-in signups | Jord | default chosen, not built | Default: first ten checked-in players get one extra pick. Needs the check-in table. Jord to confirm. |
| Organiser bias: personal night line on recap | recap | not started | Recap thread. |
| Server and phone drift: one test fixture for both | me | not started | Needs the XP award function first. |
| Prestige key bug: run number on picks | me | done | run_no = prestiges (needs XP sync). |
| Server-side validation of every pick and offer | me | done | Offers built in SQL. |
| One free respec ever | me | done | v3 SQL. |
| Coins paid once per run per level (no respec farming) | me | done | paid flag in SQL. |

## 5. New avenues
| # | Idea | Owner | Status | Note |
|---|---|---|---|---|
| 1 | Hype on Live | hype | not started | Owned by the hype thread on the PC. |
| 2 | Night recap card | recap | not started | Owned by the recap thread on the PC. |
| 3 | Auto rival | rival | not started | Owned by the rival thread. |
| 4 | Crews (3 to 5, tag, weekly board) | me | partly shipped | Shipped: SQL v3, crew panel, member names, weekly board. Not wired: crew XP needs the award call (6c). |
| 5 | Limited drops (available_until) | me | done | v3 SQL column, shop filter, availableUntil sent. "Ends in" tile label done (syntax checked, not seen on device). |
| 6a | Crew member names (First L) and crew panel | me | done | Crew panel (shop-crew.js) join, make, leave, members. Hides if RPC missing. Harness shots at 390px. |
| 6b | Weekly crew board + crew XP | me | done | shop_crew_board and crew_week_xp, board shown in the crew panel. |
| 6c | Perk XP in the award | me | partly: hook only, not wired | climb_xp_for_night, live perks only. The award function was not found in the files; it must call the hook. |
| 6d | player_state.prestiges | me | done in migration 9 | player_prestige already +1 per prestige. XP sync must not reset it. |
| 6 | Season trophies | me | SQL v4 + panel (drafts) | Table and read call done. The organiser awards them later. |
| 7 | Bounty night | organiser | SQL v4 + panel (drafts) | Table and read call done. Organiser toggle not built. |
| 8 | Shot of the night vote | me | SQL v4 draft | Vote table and call done. Shot check and vote screen not built. |
| 9 | Seasonal events (double coins, bracket) | me | SQL v4 + panel (drafts) | Event table and panel done. The effect itself is not wired into coins. |
| 10 | Team bib colour on Live | organiser | SQL v4 draft | Table done. Live court and organiser setting not built (Live thread). |

## 6. Before run night
| Step | Owner | Status |
|---|---|---|
| 1 Fix the SQL draft (regression, prestige key, respec) | me | done in v3 (not run, needs Jord yes) |
| 2 Ship phase 1 with no SQL (ranks, Climb card on Home, moments, shop path) | Jord / PC thread | not started |
| 3 Night recap card | recap | not started |
| 4 Hype on Live (client first) | hype | not started |
| 5 Merge reward systems, make picks real | me | in progress (3.1, 3.2) |
| 6 Confirm shot counts in the organiser ledger | organiser | not started |
| 7 After one real night: rival, drops, crews | rival / me | not started |

## Open calls (Jord)
1. Tree picks give perks, titles and coins, shop sells looks? Recommended yes. Done in the SQL.
2. Max 3 active perks? Recommended yes. Done in the SQL.
3. Rival auto or within ±5 levels? Recommended auto. Rival thread.
4. Inferno gate 3 stars or L50? Recommended 3 stars plus a cheaper L50 look. Shop, not climb.

## Final check (18 Nov, after publish)
- Update (18 Nov, later): coin formula 40 + 6 x level and sim done; SQL v4 draft (extras) and extras panel added; First Ten default noted; season, bounty, vote, events and bib are drafts, not run.
- Shipped: shop SQL v3 (migration 51 live, per coordinator), climb screens, crew panel, limited drops (tile label not seen on a device), coins and respec rules.
- Partly done: perk XP (hook only, needs the XP award to call it), crew XP on the board (same), 3.4f coin formula (flat 150, simulation not run).
- Not done: 3.4g balance simulation, shot perks (wait for organiser shot counts), rival matcher, First Ten decision, recap/hype/rival (other threads), season trophies, bounty night, shot vote, seasonal events, bib colours.
- Could not verify commit 3827791 from this clone: the last commit here is 9a13d37 on shop-climb-staging.
