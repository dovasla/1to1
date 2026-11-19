# Faction effects (1TO1)

Files:
- `faction-effects.css`: all 70 classes. Add one class to the element you want to decorate.
- `effects-demo.html`: open it in a browser to see every class, faction by faction.

## Class names

Pattern: `.fx-<faction>-<slot>-<stage>`

Factions: `ember`, `frost`, `brass`, `indigo`, `slate`

Per faction (14 classes each):

| Slot | Stage | Class suffix | Unlocks at level |
|---|---|---|---|
| Card effect | 1 | `card-1` | 3 |
| Card effect | 2 | `card-2` | 15 |
| Card effect | 3 | `card-3` | 30 |
| Card effect | 4 | `card-4` | 45 |
| Card effect | 5 | `card-5` | 60 |

| Slot | Stage | Class suffix | Unlocks at level |
|---|---|---|---|
| Banner | 1 | `banner-1` | 33 |
| Banner | 2 | `banner-2` | 48 |
| Banner | 3 | `banner-3` | 60 |

| Slot | Stage | Class suffix | Unlocks at level |
|---|---|---|---|
| Name effect | 1 | `name-1` | 15 |
| Name effect | 2 | `name-2` | 30 |
| Name effect | 3 | `name-3` | 45 |

| Slot | Stage | Class suffix | Unlocks at level |
|---|---|---|---|
| Badge | 1 | `badge-1` | 6 |
| Badge | 2 | `badge-2` | 12 |
| Badge | 3 | `badge-3` | 42 |

Example for Ember at level 15: `class="fx-ember-card-2"`.

## Rules for the screens
- Put the class on the card, banner, name text or badge element. Only one class per slot.
- Card effects set `overflow: hidden` and `position: relative` on that card.
- Banners set `overflow: hidden` and fill their own box. Give them a height and border radius in the screen CSS.
- Badges are 28px discs. Change width and height in the screen CSS if needed.
- Effects never catch clicks (`pointer-events: none`) and sit behind text.
- Motion uses transform and opacity only. No blur filters.
- With reduced motion on, the effect shows its resting look with no movement.

## Escalation
Stage 1 is a faint edge. Each stage adds a stronger edge, then particles (stage 3), then a flame or lit base (stage 4), then a whole-card finish (stage 5). Names go from a plain colour to a gradient with a sheen. Badges go from a breathing ring to a spinning ring to a crest.

Faction flavour: Ember rises, Frost falls like snow, Brass twinkles, Indigo falls fast, Slate drifts.

Colours per faction are set in the file (`--fx-a`, `--fx-b`, `--fx-c`) so a palette change is one block per faction.
