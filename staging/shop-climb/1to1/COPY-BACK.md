# Shop climb: files to copy back into 1to1 (18 Nov)

Nothing here is published or run. The SQL is a draft and needs Jord's yes before it touches Supabase.

## Copy these (staging folder -> 1to1 folder)

| From (staging/1to1/) | To (1to1/) | New or replaces |
|---|---|---|
| lib/player-name.js | lib/player-name.js | replaces (adds look renderer, old output unchanged) |
| lib/player-name.css | lib/player-name.css | replaces (look CSS appended) |
| shop/shop-climb.js | shop/shop-climb.js | NEW |
| shop/shop-climb.css | shop/shop-climb.css | NEW |
| screens/leaderboard/leaderboard.js | screens/leaderboard/leaderboard.js | replaces (look passed to name chip) |
| screens/profile/profile.js | screens/profile/profile.js | replaces (worn look on the name) |
| test/climb-harness.html | test/climb-harness.html | NEW (test page, not shipped) |
| test/climb-rules.test.js | test/climb-rules.test.js | NEW (`node test/climb-rules.test.js`) |
| test/shoot.js, test/shots/*.png | test/ | NEW (screenshots, optional) |

Before replacing any file, keep the old copy in `_old` next to it (never delete).

## Database (not run)

`sql-drafts/DRAFT-shop-climb-migration-v3-18nov.sql` (v3, the one to use; v2 is superseded and v1 is in sql-drafts/_old/). It copies the LIVE shop_act and _shop_state text and changes only the retired filter and the coin ledger. Run only after Jord says yes.
Before it is useful, the XP sync must set player_state.prestiges +1 on each prestige. Perk XP effects are not in the XP award yet.

Calls the phone makes (all take the player's token, same as shop_state / shop_act):
- `shop_climb_state(p_token)` - the climb block (tree, run, picks, pending offers, respec cost)
- `shop_climb_choose_tree(p_token, p_tree)` - tree: fire, ice, gold, storm or shadow
- `shop_climb_pick(p_token, p_level, p_reward)` - level 3, 6 ... 60; reward = an `id` from `pending[].offers` (perk, title or coins)
- `shop_climb_respec(p_token)` - clears the tree and this run's picks. ONE free respec, ever (shop_climb.respec_used). No coin respec. `respecsLeft` in the climb state is 1 or 0.
- Limited drops: `shop_items.available_until` (hidden after that time, unless already owned). Client "Ends in" badge not built.
- Crews: `shop_crew_create(p_token, p_name, p_tag)`, `shop_crew_join(p_token, p_tag)`, `shop_crew_leave(p_token)`, `shop_crew_state(p_token)`. Tag is 2-4 capitals/digits, max 5 members, one crew per player. Member names not returned yet (needs a names view). Weekly crew board not built.

## Glue the app needs (add in ShopBackend, not in the files above)

Each RPC returns the state fields at the top level. shop-climb.js wants `{ state, pick }` or `{ error }`:

```js
climb: function (a) {
  var rpc = a.type === 'tree' ? ['shop_climb_choose_tree', { p_tree: a.tree }]
          : a.type === 'pick' ? ['shop_climb_pick', { p_level: a.level, p_reward: a.reward }]
          : ['shop_climb_respec', {}];
  // call rpc[0] with { p_token: token, ...rpc[1] }, then:
  // if (!res.ok) return { error: res.error };
  // return { state: res, pick: res.pick };
}
```

Then in the shop screen: `ShopClimb.mount(el, { name, onAction })` and `climb.setState(stateFromShopState)`. Load order: player-name.js, shop-climb.js, then the screen.

## Changes in v2 (Opus review, approved by Jord)

- Live shop functions kept as they are, so the live shop does not empty. Only retired items and coin ledger changed.
- Prestige = new run. Picks are per run. Needs player_state.prestiges from the XP sync.
- Respec clears the tree and picks (cleared_at, no deletes). Free once per run, then 200 coins. Coins from a pick are paid once per run per level.
- v3: one free respec ever (was once per run). Respec clears the tree and this run's picks, no coins.
- Picks are real choices: a perk (max 3 active), a title, or a coin pack. No shop looks in trees.
- Fire and Ice perks are marked not live (they need shot counts the organiser does not record yet). Their slot offers a double coin pack until then.

## Not in this set (say so before shipping)

- Night recap, Hype on Live and weekly rival belong to other threads. Not in this set.
- Limited drops and crews: SQL and design are in; client badge, crew names and weekly board are not.

- Live court screen: not staged. Live thread should use `PlayerName.html({ ..., look })`.
- Server award for tree perks (xp): not built. Perks in tree-xp-perks.md are design only.
- Placeholder content: title names, coin formula (60 + 10 x level). Jord to confirm.
- Red Hot orange-red is in the CSS only. The shop item names in SQL are unchanged.
- Tested only in the harness at 390px with a fake server. Not run against Supabase.
