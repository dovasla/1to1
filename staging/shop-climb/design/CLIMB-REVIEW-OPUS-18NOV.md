# Climb, trees and shop: review and next ideas (Opus, 18 Nov 2026)

This is a read-only review. Nothing was changed, run or published.
What I read: `revamp/GAMIFICATION-CLIMB-18NOV.md`, `shop-redesign-18nov/tree-xp-perks.md`, `looks/looks.js`, `looks/looks.css`, `sql-drafts/DRAFT-shop-climb-migration-18nov.sql` and `DRAFT-shop-tree-picks-and-hide-18nov.sql`, and the PNGs `shop-climb-390.png` and `reward-pick-390.png`. For comparison I used `revamp/build/player-app/supabase/shop-server.sql`, `JORD-PASTE-SHOP-144-R331.sql` and `JORD-PASTE-SHOP-STATE-R340.sql`.

## 1. Short answer

The direction is right. One climb, a few big looks, rewards that show on court, and XP rules built only on data the organiser records. But there are **four must-fix problems** before any of it runs:

1. **The SQL draft breaks the shop that's live now.** Its `_shop_state` is copied from the old `shop-server.sql`, so it drops the `layer`, `tier`, `effect`, `unlockKind` and `sort` fields that R331/R340 added. `shop-v2-final.js` filters on `i.layer`, so the current shop would show "Nothing here yet". The draft `shop_act` also needs checking for the badge and VIP unlocks R331 added.
2. **Prestige breaks the climb.** `shop_picks` has a key of (player, level) and nothing that marks which run it belongs to. After a prestige the level goes back to 1, but the picks at 3 to 60 are still there. The player can never pick again ("You already picked this one").
3. **Respec doesn't do what the screen says.** It deletes the picks but keeps the tree, and `shop_climb_choose_tree` refuses a second tree. So a respec only re-offers the same tree, with the same rewards pushed to the back. The counter also never resets per run, so "1 free respec per run" is really "1 free respec ever". It also hard-deletes rows. That's against the never-delete spirit and loses history.
4. **"Pick 1 of 3" isn't a real choice.** Every pick offers Simple, Mid and Flashy from the same tree, and Flashy is always better. Nobody will pick "Red Hot" over "Flame Sweep". A pick only feels good when the options are **different kinds** of reward of equal worth (section 3).

## 2. What's working

- The shop path screen (`shop-climb-390.png`) is clear. It has the live card on top, 4 big steps, "13 levels to go", and a mystery-box locked tier. Keep it.
- One shared look renderer (`PlayerLook`) with only transform and opacity animations, plus a lite mode. That's right for cheap phones.
- The data rule (no assists, fouls 0 XP) is respected throughout. The night cap of 250 still applies to everything.
- The shot-perk guards (a +30 cap, half pay after 5 shots, half pay on a night with no win) are well thought through.
- The server checks every offer (`_climb_offers`), so the phone can't invent a reward.

## 3. Improvements to what exists

### 3.1 Two reward systems now overlap. Merge them.
The **shop path** (buy Hot Name, Live Glow, Afterburn and Inferno with coins) and the **tree picks** (free every 3 levels) both hand out the same looks: `heat-red`, `glow-ember`, flame and so on. The Fire tree's "simple" rewards even include "Ice Heat" and "Ice Glow". Players won't know whether to buy a look or wait to pick it.

**Fix:** tree picks give **perks, titles, small coin bundles and tree-only look variants**, and the **shop** sells the 4 big looks. That gives each system one job:
- **Shop = how you look.** Buy it, wear it.
- **Tree = how you play.** Pick it, and it changes your XP.

### 3.2 Make each pick a real choice
Every 3 levels, offer three *different kinds* of reward, all of similar worth:

| Slot | Example (Fire, level 15) |
|---|---|
| Perk | Heat Check: each three after your 2nd in a game +6 XP |
| Flair | "Microwave" title, or a Fire-only flame colour for the look you own |
| Coins | +150 coins now |

Perks stack as you climb, and you can have at most **3 active perks**. A new perk swaps one out. That stops XP creep (3.4).

### 3.3 Respec
Respec should clear the **tree and its picks** together. Mark the rows `cleared_at` instead of deleting them. Reset the free respec on each prestige, and make later respecs cost 200 coins. The code currently gives the free respec once ever.

### 3.4 Balance numbers to check
- An average night is about **99 XP** (doc example) and the cap is 250. Three stacked perks can add roughly +30 to +50 a night, which is **30 to 50% faster levelling** for tree players. That's fine if every player gets a tree at level 3. It isn't fine if it's optional. Recommend: auto-offer the tree choice at level 3, and give every tree the same expected XP a night (about +20 for an average player).
- **Two perk lists disagree.** Middy Merchant is +2 in GAMIFICATION but +5 in tree-xp-perks.md. tree-xp-perks still has Lightning and Shadow Wins as the same perk, and still has "Quiet Shooter". Pick one list before build. I'd use the GAMIFICATION one.
- **Data conflict:** tree-xp-perks.md says the ledger does **not** record 1s, 2s and 3s. GAMIFICATION says it does ("per coordinator"). Until the organiser's ledger is checked, ship **no shot perks**. The Fire and Ice signature perks depend on them.
- **Weekly-night perks** (Crown Week 4+ nights, Double Trouble) are dead if there's one run a week. Swap them for streak or per-night perks.
- **Coins:** three formulas exist (open call 2 in the climb doc). Use the server one, `10 × (L(L+1)/2 − 1)`. The shop prices (Afterburn at L25, Inferno at 3 stars) only fit that one.
- **Levels in the doc vs the PNG:** Live Glow is L10 in the PNG, and Afterburn is L25. Inferno is "3 stars" in the PNG but "L50 or 1 star" in my earlier plan. Pick one; I'd now go with the PNG.

### 3.5 Small UI fixes (from the PNGs)
- `reward-pick-390.png` shows the tier twice on each card (SIMPLE label and SIMPLE chip). Drop the chip.
- The "Red Hot" preview text is orange, not red.
- The previews in both PNGs are empty rounded boxes. Show the **player's own name and card** inside every preview, because that's the hook.
- The shop path's "Live Glow" says "ON YOUR CARD" in blue, while "Owned" is also blue. Use "Wearing" as the chip, in yellow.

## 4. Abuse and fairness risks

| Risk | How it's abused | Fix |
|---|---|---|
| **Rival farming** | Pick the weakest player as your rival, then win Rival Night every week | Rival must be within ±5 levels, or be auto-assigned (the closest player on the weekly board) |
| **Three chucking** | Fire players take bad threes | Already capped. Also keep threes out of challenges (keep "score 8 in a game", drop "3 threes") |
| **MVP vote trading** (if MVP is ever a player vote) | Friends vote each other for Gold-tree MVP bonuses | Gold perks only count MVP picked by the organiser. Drop the "extra MVP vote" shop perk from the 6 Nov memo |
| **First Ten boost on new accounts** | Make a new account for +20% | Little gain, since XP is per account. Tie the boost to signups the organiser has checked in |
| **Organiser bias** | The organiser hand-logs shots for friends | Show each player their own night line on the recap ("you: 2 threes, 3 twos"), so mistakes get spotted |
| **Server and phone drift** | `xp.js` and the server award function differ, so the phone shows the wrong level | One test fixture used by both (Node test + SQL test) |
| **Prestige key bug** | See 1.2 | Add a `run` column (stars at pick time) to the `shop_picks` key |

## 5. New avenues, ranked by fun for the effort

| # | Idea | Why it's fun | Effort | Needs SQL? |
|---|---|---|---|---|
| 1 | **Hype on Live** | Spectators (players on the bench or watching from home) tap 🔥 on a player's tile. A burst floats up and the count shows on the recap: "Sam K: 14 hype". This gives bench players something to do and makes looks get noticed. | Small | One table (or reuse the live feed) |
| 2 | **Night recap card** | After the run, each player gets a shareable card in their worn look: points, wins, XP gained, level bar and best moment. Players share it to WhatsApp, which is free marketing. | Small | No (uses the ledger) |
| 3 | **Auto rival** | Every week the app pairs you with the closest player by weekly XP. On Live, both tiles show "Rival", and beating them gives +10 XP and a badge. There's no picking, so no farming. | Medium | Small view |
| 4 | **Crews (3 to 5 players)** | Friends form a crew with a 2 to 4 letter tag (clan tags already exist in `shop-server.sql`). There's a weekly crew board (sum of members' XP, capped per member), and the top crew gets a banner tint for the week. | Medium | Crew table |
| 5 | **Limited drops** | One look a month, on sale for 7 days only (e.g. a "Winter Frost" variant in December). It's shown on the Home card with a countdown. It brings players back without making the game pay-to-win. | Small once looks exist | One `available_until` column |
| 6 | **Season trophies** | At the end of Tip-Off: trophies for top XP, most improved, iron man (most games) and best crew. They show on the profile shelf for ever. | Small | Uses the season window that already exists |
| 7 | **Bounty night** | The organiser marks one player (last week's MVP) as the Bounty. Anyone whose team beats theirs gets +10 XP, and the Bounty gets +5 for every win they hold. | Small (organiser toggle) | One flag on the night |
| 8 | **Shot of the night vote** | After the run, players vote on one big moment from a list of 3 the organiser tagged. The winner's look gets a 24h gold trim. | Medium | Vote table |
| 9 | **Seasonal events** | Christmas week gives double coins. "Buzzer Beater" finals week has a mini bracket. | Medium | Event table |
| 10 | **Look loadout for teams** | When the organiser splits teams, each team's tiles take on the bib colour plus each player's look. This makes Live court more readable. | Small | No |

Not recommended now: loot boxes, any paid track, trading items, and coins for anything that changes a game. These break the 6 Nov fairness rules.

## 6. What to do next before run night (most fun per effort)

1. **Fix the SQL draft** (1.1 regression, 1.2 prestige key, 1.3 respec). It must not run as it is now.
2. **Ship phase 1 with no SQL:** rank titles, the Climb card on Home, level-up and unlock moments, and the shop path screen using the current backend. This is already planned.
3. **Night recap card** (idea 2). It uses the ledger only, is very shareable, and shows looks off-court.
4. **Hype on Live** (idea 1), client side first. Taps can show locally and on the recap later. Then add one small table after Jord's yes.
5. **Merge the reward systems** (3.1) and **make picks real choices** (3.2) *before* the tree picker is built, because changing them later costs more.
6. **Confirm the shot-count data** in the organiser ledger. Shot perks wait until that's done.
7. After one real night: auto rival, limited drops, then crews.

## 7. Open calls (for Fable or Jord)

1. Tree picks give perks, flair and coins, while the shop sells looks (3.1)? I recommend yes.
2. A cap of 3 active perks (3.2)? I recommend yes.
3. Rival: auto-assigned or within ±5 levels? I recommend auto.
4. Inferno gate: 3 stars (as in the PNG) or L50 / 1 star? I recommend the PNG's 3 stars, plus a cheaper L50 look below it.
