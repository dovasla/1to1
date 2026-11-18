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

`sql-drafts/DRAFT-shop-climb-migration-v2-18nov.sql` (v2, replaces v1, which is now in sql-drafts/_old/). It copies the LIVE shop_act and _shop_state text and changes only the retired filter and the coin ledger. Run only after Jord says yes.
Before it is useful, the XP sync must set player_state.prestiges +1 on each prestige. Perk XP effects are not in the XP award yet.

Calls the phone makes (all take the player's token, same as shop_state / shop_act):
- `shop_climb_state(p_token)` - the climb block (tree, run, picks, pending offers, respec cost)
- `shop_climb_choose_tree(p_token, p_tree)` - tree: fire, ice, gold, storm or shadow
- `shop_climb_pick(p_token, p_level, p_reward)` - level 3, 6 ... 60; reward = an `id` from `pending[].offers` (perk, title or coins)
- `shop_climb_respec(p_token)` - clears the tree and this run's picks; free once per run, then 200 coins

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
- Picks are real choices: a perk (max 3 active), a title, or a coin pack. No shop looks in trees.
- Fire and Ice perks are marked not live (they need shot counts the organiser does not record yet). Their slot offers a double coin pack until then.

## Not in this set (say so before shipping)

- Still to come from the Opus list (next chunks): night recap card, Hype on Live, auto weekly rival, limited drops, crews. Not built yet.

- Live court screen: not staged. Live thread should use `PlayerName.html({ ..., look })`.
- Server award for tree perks (xp): not built. Perks in tree-xp-perks.md are design only.
- Placeholder content: title names, 200-coin respec price, coin formula (60 + 10 x level). Jord to confirm.
- Tested only in the harness at 390px with a fake server. Not run against Supabase.
