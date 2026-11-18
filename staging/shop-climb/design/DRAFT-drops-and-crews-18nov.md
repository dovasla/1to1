# Limited drops and crews: design draft (18 Nov). Not built, not run.

## Limited drops
- One shop look a month, on sale for 7 days only. Shown on the Home card with a countdown.
- Data: one column, `shop_items.available_until timestamptz null` (null = always on). `_shop_state` and `shop_act` filter on it.
- Rule: a dropped look that has been bought stays owned. After the window it is shown as "Ended", not removed.
- Needs Jord's yes on the look and dates. No price changes for existing items.

## Crews (3 to 5 players)
- A crew has a name and a 2 to 4 letter tag (clan tag rules already exist in shop_act).
- Join by invite from one member. A player is in one crew at a time. Leaving is always allowed.
- Crew board for the week: sum of members' weekly XP, each member capped (suggest 150) so one player can't carry it.
- Reward: top crew gets a banner tint for the week only. No coins.
- Tables (draft): `crews(id, name, tag, created_by)`, `crew_members(crew_id, signup_id, joined_at, left_at)` with a partial unique index on signup_id where left_at is null. RLS deny-by-default, same as the climb tables.
- Open calls for Jord: max crew size (5), whether the crew board counts ±rivals, and who can remove a member.
