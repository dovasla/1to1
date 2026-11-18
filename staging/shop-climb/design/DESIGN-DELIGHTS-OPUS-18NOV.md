# Design, structure, colour and delights (Opus, 18 Nov 2026)

This is a read-only review. Nothing was changed or published.
What I looked at:
- Live court: `live-court-lit-390-…e4c4.png` and `live-player-card-390-…2d1f.png` (project root).
- Shop and Climb: the `shop-redesign-18nov/` PNGs, `GAMIFICATION-CLIMB-18NOV.md`, and my two earlier reviews (`SHOP-REVIEW-OPUS-18NOV.md`, `CLIMB-REVIEW-OPUS-18NOV.md`).
- Organiser Court and Door: `revamp/design-review-18nov/` (mock-1-court, mock-2-door, REVIEW.md, polish-patch-plan.md). This folder is on the PC only, not in the shared mount.
- Code: player app `lib/player-name.js`, `shop/`, and the `screens/` folder list.

Effort is S (under 2h), M (half a day) or L (a day or more). Risk is what could break.

## 1. Short answer

The look is right: a dark base, one yellow action, big numbers and condensed caps. Don't rebrand. Three things would lift it most:
- **Fix the Live court's clashes** between glows, team colours, fouls and names. It's the screen everyone stares at during a run.
- **One shared colour rule:** team colours, status colours and shop-look colours each get their own lane.
- **Delights at the moments that already happen:** you score, you pay, a game ends, you level up, the organiser taps +2. No new features are needed for most of them.

## 2. Live court: what the PNG shows and the fix

| # | Problem in `live-court-lit-390` | Fix | Effort | Risk |
|---|---|---|---|---|
| L1 | Glows wash out text. Loganberry's "Lv 5" and Tonette's "Lv 9" are almost invisible under the blue and violet glows. | Put the glow **behind the score disc only** (clip it to a 64px circle), and keep names and levels on a dark plate at full contrast. | S | Low |
| L2 | One tile is broken: "Player" shows in a grey box with no disc or level. | Fallback tile: an initials disc, "Guest", and the score. Never show raw "Player". | S | Low |
| L3 | **Yellow means three things.** The legend says yellow ring = just scored, but Fartin's yellow dashed ring is foul trouble, and "FOUL 4" is a yellow chip. | Yellow stays for **just scored** (and your own team). Foul trouble becomes a **red outline and a red "4 FOULS" chip**. | S | Low |
| L4 | Long or red names clip. "TIDDLEYWIN" runs into the court edge, and a red name reads like a foul warning. | Cap names at 10 characters with an ellipsis, using the PlayerName short name (first name + initial). See the colour rule in section 4 (red is for fouls only). | S | Low |
| L5 | The page needs a legend footer ("Yellow ring: just scored…") to make sense. | Once L3 is fixed, drop the footer. States should explain themselves: a "+2" pop for scoring, a red chip for fouls, a flame for a streak. | S | Low |
| L6 | You can't find yourself fast. | Your own tile gets a **thin yellow ring and "YOU" under the disc**. Your team's half gets a 4% yellow tint. | S | Low |
| L7 | "Last baskets" repeats the words BLUE and WHITE. | Use a team colour dot, plus "12s ago" in grey. The newest row slides in from the top. | S | Low |
| L8 | Score digits jiggle as they change. | `font-variant-numeric: tabular-nums` on every score and number, in both apps. | S | None |

### Player sheet (`live-player-card-390`)

| # | Problem | Fix | Effort |
|---|---|---|---|
| P1 | Empty avatar circle | Initials disc in the team colour, or the photo if one exists (a `photo/` screen exists) | S |
| P2 | Blue gradient band at the top looks unfinished | A solid 6px team-colour strip, or the player's worn **banner** (that's where the shop look pays off) | S |
| P3 | Two lines of plain text ("10 points this game", "Level 24") | A row of 3 big-number stats: **10** PTS TONIGHT · **24** LEVEL · **3** WEEK STREAK | S |
| P4 | Nothing to do except leave | Add a 🔥 **Hype** button (section 5, D9) next to See player | M |

## 3. Structure and information architecture

| # | Idea | Where | Why | Effort | Risk |
|---|---|---|---|---|---|
| A1 | **Four tabs only: Home, Live, Board, Me.** The shop sits behind the coins icon (already done). Profile, Climb, badges, streaks, seasons and prestige all live in **Me** as sections. | Player tab bar, `screens/` | The app has 24 screen folders (achievements, streaks, seasons, prestige, peek, head-to-head…). Players should never hunt. | M | Medium: links between screens |
| A2 | **Home is "what's next"**, in this order: Tonight card (pay / bib / who's in) → Live strip (only while a game is on) → Climb card (level bar, next unlock) → last run's top 3. Nothing else. | `screens/home` | Matches the order in the tabs thread. One job per card. | S (already in progress) | Low |
| A3 | **Merge peek and head-to-head into the player sheet.** Tap anyone anywhere and you get the same sheet: stats, look, and "You vs them" this season. | `screens/peek`, `screens/head-to-head` | One pattern to learn, used everywhere. | M | Low |
| A4 | **One renderer for names and looks.** PlayerName stays, and PlayerLook folds into it (coordinator decision). | `lib/player-name.js` | Already agreed. It stops two looks drifting apart. | M | Medium |
| A5 | **One tokens file for both apps.** Today there's `organiser-v9/shared/tokens.css` and the player app's `app-tokens.css`. | Shared tokens | Colours and sizes drift between the apps (REVIEW.md item 7). | M | Medium |
| A6 | **A shared "moments" helper.** One queue, at most one moment every 30s per screen, `prefers-reduced-motion` respected, plus a haptics call. | New `lib/moments.js` | Every delight below goes through it, so Live never gets noisy. | S | Low |

## 4. Colour and style

**The colour rule. Write it into the tokens file and the design rules.**

| Lane | Colours | Used for | Never used for |
|---|---|---|---|
| Brand | Yellow #FFD21F, black, blue #0A5CFF | One main action per screen, "just scored", you/your team | Decoration, outlines on secondary buttons |
| Team | Blue, White (and Yellow, Green when there are 3 or 4 teams) | Court halves, bibs, team dots | Shop looks |
| Status | Green = paid / done. Red = owes / fouls / remove | Door, foul trouble, errors | Names, shop looks |
| Looks (shop) | Orange, ice cyan, violet, gold, neon lime | Name colours, glows, flames | Status or team meaning |

What changes because of it:
- The shop's **"Red Hot" name becomes "Hot Orange" or "Crimson Fire"** with an orange-red gradient. A pure red name reads as a foul on Live (L4).
- **Blue glow looks** (Loganberry, "Live Glow" in the shop path) move to **ice cyan** #5FE1FF, so they don't read as Team Blue.
- The shop chip "ON YOUR CARD" (blue) and "Owned" (blue) become **"Wearing"** in yellow, and "Owned" in grey.

**Style.**
- **Type:** Barlow Condensed 700 for headings and numbers, Barlow 600 for body. The 14px floor applies everywhere. Tabular numbers (L8).
- **Motion tokens:** 3 durations only: 120ms for taps, 240ms for sheets and toasts, 600 to 1200ms for celebrations. Use one easing: `cubic-bezier(.2,.8,.2,1)`.
- **Bright hall (light mode):** glows vanish on white. Each look needs a light-mode version: a 2px coloured outline and darker text instead of a glow. Test both themes.
- **Organiser:** I back REVIEW.md items 1, 3, 4, 5 and 6. Item 2: Jord rejected pills, but `mock-2-door.png` still shows them. Use the polish plan's revised version instead (a 4px row colour edge, green for paid and red for owes, plus a 44px+ paid icon).

## 5. Delights

Each one hooks into a moment that already exists. Haptics use `navigator.vibrate`, which works in the Android APK but **not on iPhone Safari**, so every delight must look good with no vibration. Sounds are **off by default** because a gym is loud; there's a toggle in Me → Settings.

### Player app

| # | Delight | Where | Why | Effort | Risk |
|---|---|---|---|---|---|
| D1 | **Your score bump:** when *you* score, your disc does a quick squash-and-bounce, the number rolls up, and the phone buzzes once (20ms). | Live, own tile | The best feeling in the app. It happens many times a night. | S | Low |
| D2 | **Ticket punch:** after paying, the bib card stamps "PAID", a hole punches through the corner, and the phone buzzes. | Tonight card / pay screen (`pay/`, `receipt/`) | Turns a chore into a small win, at the moment they're at the door. | S | Low |
| D3 | **Game-end wave:** when a game ends, the winning team's discs bounce one after another, left to right, and a banner reads "BLUE WIN 21–17". | Live | Gives every game a finish line, seen by everyone. | S if a game-end event exists in the feed, M if not | Low |
| D4 | **Morning-after XP:** the first app open after a run shows the XP bar counting up ("+99 XP from Tuesday"). Crossing a level fires the level-up moment. | Home Climb card | The reason to open the app between runs. Ties to Climb phase 1. | M | Low: reads the existing ledger |
| D5 | **Streak flame and nudge:** a flame with the week count on Home. On the day of a run: "Play tonight to keep your 4-week streak." | Home | Simple, proven pull to come back. Uses streak data that already exists. | S | Low |
| D6 | **Milestone lines** in plain, warm copy: 1st night "Welcome to the run." 10th "Double digits. You're a regular." 25th "Part of the furniture." 50th "Half a century of nights." | Home toast + badge | Costs only words and makes regulars feel seen. | S | None |
| D7 | **Bib reveal:** on the first check-in of the night, the bib number flips in like a jersey number. | `reveal/` (folder exists) | A tiny bit of ceremony. | S | Low |
| D8 | **Drip check:** long-press your own name anywhere to see your card full screen with your look running. | Anywhere PlayerName renders | Shows off the look you paid for. | S | Low |
| D9 | **🔥 Hype taps:** bench and home viewers tap a player's tile, flames float up, and the night recap counts them ("14 hype"). | Live tile + player sheet | Gives bench players something to do, and gets looks noticed. | M (needs one table to share taps) | Low. Rate-limit to 1 tap per 3s per person. |
| D10 | **Night recap card:** after the run, a shareable card in your look with points, wins, XP, level bar and your best moment. | Home after the run, `share-card/` (folder exists) | WhatsApp sharing = free invites. | M | Low |
| D11 | **Seasonal skins by date, automatic:** December gives snow on the court lines and a Santa-hat dot on bib numbers. Halloween turns the court orange with a pumpkin ball. The season start ("Tip-Off") gets a tip-off animation on Home. | Live court lines + Home | Feels alive without new features. One CSS class on `<html>` by date. | M | Low |
| D12 | **Easter eggs:** tap the loading ball 3 times and it spins and swishes. Score exactly 21 in a game and you get a hidden "Blackjack" badge. On a 69th or 100th game, a wink line. | Loading screen, badges | Players tell each other, which spreads the word. | S each | None |

### Organiser app

| # | Delight | Where | Why | Effort | Risk |
|---|---|---|---|---|---|
| O1 | **Score tap feedback:** each +1/+2/+3 tap buzzes (15ms), the team total pulses, and a toast reads "+2 Ava · Undo" for 4s. | Court | The organiser scores without looking. The buzz confirms it, and the Undo saves mis-taps. | S | Low |
| O2 | **"Everyone's paid"**: when owes hits 0, a single green sweep runs across the Door list with "All paid. Nice." | Door | Rewards the most boring job of the night. | S | Low |
| O3 | **End-of-night line:** after End run, show "£60 in · 12 players · 9 games. Good run." with a share button. | End run screen | Closes the night with a sense of done. | S | Low |
| O4 | **Full house:** when check-ins reach the cap, the count chip turns gold and says "Full house". | Door header | Instant status without counting. | S | Low |

## 6. Top 10 before run night (most fun per effort, lowest risk)

| Rank | Item | Effort | Why now |
|---|---|---|---|
| 1 | **Live court fixes L1, L2, L3, L6** (glow behind the disc, guest tile, red fouls, YOU ring) | S | It's the screen everyone watches tonight, and these are visible bugs. |
| 2 | **O1 organiser score buzz + Undo toast** | S | Fewer scoring mistakes on the night. |
| 3 | **D1 your score bump** | S | The single best moment. |
| 4 | **Player sheet P1 to P3** (initials, team strip, big stats) | S | Every tap on the court lands here. |
| 5 | **Colour rule** (section 4): Red Hot → orange-red, blue glows → ice cyan, Wearing/Owned chips | S | Stops looks being read as fouls or teams. Do it before looks ship. |
| 6 | **L8 tabular numbers + 14px floor + yellow-only** (both apps, token changes) | S | Low risk, tidies everything. |
| 7 | **D2 ticket punch on pay** | S | Happens at the door, first thing. |
| 8 | **D3 game-end wave** (if the game-end event exists) | S | A finish line for every game. |
| 9 | **O2 + O3 "All paid" and end-of-night line** | S | Makes the organiser's night feel good too. |
| 10 | **D5 + D6 streak nudge and milestone lines** | S | Words only, and it pulls people back next week. |

**After run night:** D4 morning-after XP (with Climb phase 1), D10 recap card, D9 hype, A1 four tabs, A3 single player sheet, A5 shared tokens, then D11 seasonal skins and D12 easter eggs.

## 7. Risks and checks

- Delights must go through one moments helper (A6), with one moment at a time. Otherwise Live gets noisy and slow on cheap phones.
- No vibration on iPhone, so test with it off.
- Every animation has a static version for reduced motion, and the "low" FX mode stops loops.
- Test both themes at 390px. Glow looks need the light-mode outline version.
- The Live fixes touch the court-view files, which the thread "Preview court view with tappable players" is working in. Route them to that thread, not a new one.
