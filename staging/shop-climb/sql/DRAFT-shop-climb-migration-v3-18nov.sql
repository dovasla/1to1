-- DRAFT v3. NOT RUN. Needs Jord's yes before anything goes to the live Supabase.
-- Replaces v2 (kept in sql-drafts/). v3: one free respec EVER, limited drops, crews (3 to 5, one crew per player).
-- Base: the LIVE functions (JORD-PASTE-SHOP-144-R331.sql shop_act, JORD-PASTE-SHOP-STATE-R340.sql _shop_state).
-- Those two are copied below. Only three things differ from the live text: the retired guard in shop_act,
-- the retired filter in _shop_state, and the coin ledger in both balances. Safe to run twice.
--
-- What it does:
--   1. Hides 4 dead items (retired). Rows and owned looks stay. Retired items are not in the shop list and cannot be bought.
--   2. One tree per player. Picks every 3 levels (3 to 60) inside the current RUN. Each pick is a perk, a title or coins.
--      Tree rewards never include shop looks: trees = playstyle, shop = looks.
--   3. Prestige: a new run. Picks are per run, so a new run can pick again from 3. Needs player_state.prestiges (see note below).
--   4. Respec: ONE free respec per player, ever. Clears the tree and this run's picks (marked cleared_at, never deleted). No paid respec.
--   5. Coins from a pick are paid once per run per level, so respeccing cannot farm coins.
--   6. Coin balance = earned + VIP bonus - purchases + shop_coin_ledger (picks add, respec takes away).
--
-- NOTE: player_state.prestiges is set by migration 9 (player_prestige, level 60 only, +1 per prestige). The XP sync must
-- not reset it. Until migration 9 runs, every player is in run 0, which still works.
--
-- Phone calls (token first, same as shop_state / shop_act):
--   shop_state(p_token)                          existing call, same answer, plus retired items hidden and coin ledger counted
--   shop_act(p_token, p_item, p_tag)             existing call, same rules, plus "No longer sold" for retired items
--   shop_climb_state(p_token)                    NEW: the climb block (tree, run, picks, pending offers, respec cost)
--   shop_climb_choose_tree(p_token, p_tree)      NEW: only when no tree is picked
--   shop_climb_pick(p_token, p_level, p_reward)  NEW: p_reward is an id from the pending offers
--   shop_climb_respec(p_token)                   NEW: one free respec ever; clears tree and this run's picks
--   shop_crew_create / shop_crew_join / shop_crew_leave / shop_crew_state   NEW: crews (3 to 5 players, tag 2 to 4 letters or digits)

-- 1. Retire the 4 dead items.
alter table public.shop_items add column if not exists retired boolean not null default false;
update public.shop_items set retired = true
  where id in ('banner-gold', 'name-gold', 'calling-gold', 'clan-tag') and retired = false;

-- 1b. Limited drops: a look can end on a date. Owned ones stay owned.
alter table public.shop_items add column if not exists available_until timestamptz;

-- 2. Run number. Set by player_prestige (migration 9). Created here too so the climb can read it.
alter table public.player_state add column if not exists prestiges int not null default 0;

-- 3. Coin ledger: picks add coins, respec takes them away. Signed.
create table if not exists public.shop_coin_ledger (
  id          bigint generated always as identity primary key,
  signup_id   uuid not null references public.signups(id) on delete cascade,
  delta       int  not null check (delta <> 0),
  reason      text not null,
  run_no      int  not null default 0,
  at          timestamptz not null default now()
);

-- 4. Climb state: one row per player.
create table if not exists public.shop_climb (
  signup_id        uuid primary key references public.signups(id) on delete cascade,
  tree             text check (tree in ('fire', 'ice', 'gold', 'storm', 'shadow')),
  free_respec_run  int,                 -- the run in which the free respec was used (null = not used)
  chosen_at        timestamptz
);

alter table public.shop_climb add column if not exists respec_used boolean not null default false;

-- 5. Picks. Cleared picks stay as history (cleared_at set). Only active ones (cleared_at is null) count.
create table if not exists public.shop_picks (
  signup_id   uuid not null references public.signups(id) on delete cascade,
  run_no      int  not null default 0,
  interval_lv int  not null check (interval_lv in (3,6,9,12,15,18,21,24,27,30,33,36,39,42,45,48,51,54,57,60)),
  tree        text not null check (tree in ('fire', 'ice', 'gold', 'storm', 'shadow')),
  kind        text not null check (kind in ('perk', 'title', 'coins')),
  reward_id   text not null,
  name        text not null,
  descr       text not null default '',
  value       int  not null default 0,
  paid        boolean not null default false,   -- coins were paid for this level in this run
  picked_at   timestamptz not null default now(),
  cleared_at  timestamptz
);
create unique index if not exists shop_picks_one_active
  on public.shop_picks (signup_id, run_no, interval_lv) where cleared_at is null;

-- 6. Reward catalogue (tree perks and titles only; no shop looks).
create table if not exists public.shop_climb_rewards (
  id    text primary key,
  tree  text not null check (tree in ('fire', 'ice', 'gold', 'storm', 'shadow')),
  kind  text not null check (kind in ('perk', 'title')),
  ord   int  not null check (ord between 1 and 4),
  name  text not null,
  descr text not null,
  live  boolean not null default true,      -- false = needs data the organiser does not record yet
  unique (tree, name)
);

-- Perks: 3 per tree (GAMIFICATION doc). live = false means it needs shot counts the organiser does not record yet.
-- Titles: placeholder names, 4 per tree. Coins: 40 + 6 x level (see test/coin-sim.js in staging), paid once per run per level.
insert into public.shop_climb_rewards (id, tree, kind, ord, name, descr, live) values
  ('fire-perk-1',  'fire',  'perk', 1, 'Heat Check',     'Each three after your 2nd in one game +6 XP', false),
  ('fire-perk-2',  'fire',  'perk', 2, 'Middy Merchant', 'Every 2-pointer +2 XP', false),
  ('fire-perk-3',  'fire',  'perk', 3, 'Hot Night',      'A night with 4+ threes +15 XP', false),
  ('ice-perk-1',   'ice',   'perk', 1, 'Cold Blooded',   'Each free throw +3 XP once you have made 3 in a game', false),
  ('ice-perk-2',   'ice',   'perk', 2, 'Free Throw Pro', 'Every free throw +2 XP', false),
  ('ice-perk-3',   'ice',   'perk', 3, 'Ice Run',        'Win a game where you scored 0 threes +10 XP', false),
  ('gold-perk-1',  'gold',  'perk', 1, 'Crown Keeper',   'MVP two nights in a row +15 XP', true),
  ('gold-perk-2',  'gold',  'perk', 2, 'Gold Captain',   'MVP nights +10 XP', true),
  ('gold-perk-3',  'gold',  'perk', 3, 'Gold Streak',    'Each streak week +2 XP', true),
  ('storm-perk-1', 'storm', 'perk', 1, 'Second Wind',    'Each game after your 3rd in one night +5 XP', true),
  ('storm-perk-2', 'storm', 'perk', 2, 'Storm Run',      'A night with 3+ games +10 XP', true),
  ('storm-perk-3', 'storm', 'perk', 3, 'Lightning',      'Each win +5 XP', true),
  ('shadow-perk-1','shadow','perk', 1, 'Bounce Back',    'Win the game after a loss in the same night +10 XP', false),
  ('shadow-perk-2','shadow','perk', 2, 'Rival Night',    'Outscore your rival that night +10 XP', false),
  ('shadow-perk-3','shadow','perk', 3, 'Shadow Wins',    'A night with 3+ wins +10 XP', true),
  ('fire-title-1',  'fire',   'title', 1, 'Microwave',   'A title on your card', true),
  ('fire-title-2',  'fire',   'title', 2, 'Heat Seeker', 'A title on your card', true),
  ('fire-title-3',  'fire',   'title', 3, 'Ember',       'A title on your card', true),
  ('fire-title-4',  'fire',   'title', 4, 'Blaze',       'A title on your card', true),
  ('ice-title-1',   'ice',    'title', 1, 'Cool Head',   'A title on your card', true),
  ('ice-title-2',   'ice',    'title', 2, 'Ice Water',   'A title on your card', true),
  ('ice-title-3',   'ice',    'title', 3, 'Frostbite',   'A title on your card', true),
  ('ice-title-4',   'ice',    'title', 4, 'Steady',      'A title on your card', true),
  ('gold-title-1',  'gold',   'title', 1, 'Captain',     'A title on your card', true),
  ('gold-title-2',  'gold',   'title', 2, 'Gold Standard','A title on your card', true),
  ('gold-title-3',  'gold',   'title', 3, 'Crown',       'A title on your card', true),
  ('gold-title-4',  'gold',   'title', 4, 'Golden Hour', 'A title on your card', true),
  ('storm-title-1', 'storm',  'title', 1, 'Grinder',     'A title on your card', true),
  ('storm-title-2', 'storm',  'title', 2, 'Non-Stop',    'A title on your card', true),
  ('storm-title-3', 'storm',  'title', 3, 'Storm Front', 'A title on your card', true),
  ('storm-title-4', 'storm',  'title', 4, 'Overtime',    'A title on your card', true),
  ('shadow-title-1','shadow', 'title', 1, 'Underdog',    'A title on your card', true),
  ('shadow-title-2','shadow', 'title', 2, 'Quiet One',   'A title on your card', true),
  ('shadow-title-3','shadow', 'title', 3, 'Comeback Kid','A title on your card', true),
  ('shadow-title-4','shadow', 'title', 4, 'Shade',       'A title on your card', true)
on conflict (id) do update set
  tree = excluded.tree, kind = excluded.kind, ord = excluded.ord, name = excluded.name, descr = excluded.descr, live = excluded.live;

-- 7. Row-level security: deny by default. The phone reads these only through the functions below (security definer).
alter table public.shop_coin_ledger   enable row level security;
alter table public.shop_climb         enable row level security;
alter table public.shop_picks         enable row level security;
alter table public.shop_climb_rewards enable row level security;
revoke all on public.shop_coin_ledger, public.shop_climb, public.shop_picks, public.shop_climb_rewards from anon, authenticated;
drop policy if exists shop_coin_ledger_deny on public.shop_coin_ledger;
create policy shop_coin_ledger_deny on public.shop_coin_ledger for all to anon, authenticated using (false) with check (false);
drop policy if exists shop_climb_deny on public.shop_climb;
create policy shop_climb_deny on public.shop_climb for all to anon, authenticated using (false) with check (false);
drop policy if exists shop_picks_deny on public.shop_picks;
create policy shop_picks_deny on public.shop_picks for all to anon, authenticated using (false) with check (false);
drop policy if exists shop_climb_rewards_deny on public.shop_climb_rewards;
create policy shop_climb_rewards_deny on public.shop_climb_rewards for all to anon, authenticated using (false) with check (false);

-- 8. Helpers.
-- One reward of a kind for this tree: rotates by pick index, skips rewards this run already holds, skips non-live ones.
create or replace function public._climb_take(p_tree text, p_kind text, p_k int, p_sid uuid, p_run int)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('kind', p_kind, 'id', b.id, 'name', b.name, 'desc', b.descr)
  from (
    select r.id, r.name, r.descr,
      ((((r.ord - 1 - p_k) % count(*) over ()) + count(*) over ()) % count(*) over ()) as rot,
      (r.name in (select sp.name from public.shop_picks sp
                  where sp.signup_id = p_sid and sp.run_no = p_run and sp.cleared_at is null)) as taken
    from public.shop_climb_rewards r
    where r.tree = p_tree and r.kind = p_kind and r.live
  ) b
  order by b.taken, b.rot
  limit 1
$$;

-- The three options for one pick level. Three different kinds, each with a plain description:
--   perk  : adds an XP perk. If 3 perks are already active, it REPLACES the oldest one (the description says which).
--   title : a title on your card.
--   coins : 40 + 6 x level coins for the shop (was a flat 150).
-- Fallback only when no live perk is left in this tree: the perk slot becomes a second coin pack (100 coins, plain).
create or replace function public._climb_offers(p_sid uuid, p_level int)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tree text;
  v_run int;
  v_k int := p_level / 3 - 1;
  v_perks int;
  v_oldest text;
  v_perk jsonb;
  v_title jsonb;
begin
  select tree into v_tree from public.shop_climb where signup_id = p_sid;
  if v_tree is null then return '[]'::jsonb; end if;
  select coalesce(prestiges, 0) into v_run from public.player_state where signup_id = p_sid;
  select count(*) into v_perks from public.shop_picks
    where signup_id = p_sid and run_no = v_run and cleared_at is null and kind = 'perk';
  select name into v_oldest from public.shop_picks
    where signup_id = p_sid and run_no = v_run and cleared_at is null and kind = 'perk'
    order by picked_at limit 1;

  v_perk := public._climb_take(v_tree, 'perk', v_k, p_sid, v_run);
  if v_perk is null then
    v_perk := jsonb_build_object('kind', 'coins', 'id', 'extra-' || p_level, 'name', '+100 coins',
                                 'desc', '100 coins to spend in the shop. No live perk is left in this tree.', 'value', 100);
  else
    v_perk := v_perk || jsonb_build_object('value', 0,
      'desc', case when v_perks >= 3 then 'Replaces ' || v_oldest || '. ' else '' end || (v_perk->>'desc'));
  end if;
  v_title := public._climb_take(v_tree, 'title', v_k, p_sid, v_run) || jsonb_build_object('value', 0);

  return jsonb_build_array(
    v_perk,
    v_title,
    jsonb_build_object('kind', 'coins', 'id', 'coins-' || p_level,
                       'name', '+' || (40 + 6 * p_level) || ' coins',
                       'desc', (40 + 6 * p_level) || ' coins to spend in the shop.', 'value', 40 + 6 * p_level)
  );
end $$;

-- The climb block the phone shows.
create or replace function public._climb_state(p_sid uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cl public.shop_climb%rowtype;
  v_st public.player_state%rowtype;
  v_run int;
begin
  insert into public.player_state (signup_id) values (p_sid) on conflict (signup_id) do nothing;
  insert into public.shop_climb (signup_id) values (p_sid) on conflict (signup_id) do nothing;
  select * into v_cl from public.shop_climb where signup_id = p_sid;
  select * into v_st from public.player_state where signup_id = p_sid;
  v_run := v_st.prestiges;
  return jsonb_build_object(
    'tree', v_cl.tree,
    'level', v_st.level,
    'run', v_run,
    'respecsLeft', case when v_cl.respec_used then 0 else 1 end,
    'perks', (select count(*) from public.shop_picks where signup_id = p_sid and run_no = v_run and cleared_at is null and kind = 'perk'),
    'picks', coalesce((select jsonb_agg(jsonb_build_object('level', sp.interval_lv, 'kind', sp.kind, 'name', sp.name,
                 'desc', sp.descr, 'value', sp.value) order by sp.interval_lv)
               from public.shop_picks sp where sp.signup_id = p_sid and sp.run_no = v_run and sp.cleared_at is null), '[]'::jsonb),
    'pending', case when v_cl.tree is null then '[]'::jsonb else coalesce((
               select jsonb_agg(jsonb_build_object('level', l, 'offers', public._climb_offers(p_sid, l)) order by l)
               from generate_series(3, 60, 3) as l
               where l <= v_st.level
                 and not exists (select 1 from public.shop_picks sp where sp.signup_id = p_sid and sp.run_no = v_run
                                 and sp.interval_lv = l and sp.cleared_at is null)), '[]'::jsonb) end
  );
end $$;

-- 9. Live shop functions, copied from the live text (see header for the three changed lines).
CREATE OR REPLACE FUNCTION public._shop_state(p_sid uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_st public.player_state%rowtype;
  v_spent int;
  v_items json;
  v_owned json;
begin
  perform public._vip_apply(p_sid);
  insert into public.player_state (signup_id) values (p_sid) on conflict (signup_id) do nothing;
  select * into v_st from public.player_state where signup_id = p_sid;
  select coalesce(sum(price_paid), 0) into v_spent from public.shop_purchases where signup_id = p_sid;
  v_spent := v_spent - (select coalesce(sum(delta), 0) from public.shop_coin_ledger where signup_id = p_sid);
  select coalesce(json_agg(json_build_object(
           'id', id, 'slot', slot, 'value', value, 'name', name, 'price', price,
           'minLevel', min_level, 'minStars', min_stars, 'layer', layer, 'tier', tier, 'depth', depth, 'effect', effect, 'unlockKind', unlock_kind, 'unlockValue', unlock_value, 'sort', sort,
           'availableUntil', available_until,
           'unlockName', (select a.title from public.achievements a where a.id = unlock_value)) order by sort, price, id), '[]'::json)
    into v_items from public.shop_items where retired = false and (available_until is null or available_until > now());
  select coalesce(json_agg(item_id), '[]'::json) into v_owned from public.shop_purchases where signup_id = p_sid;
  return json_build_object(
    'ok', true,
    'level', v_st.level,
    'stars', v_st.stars,
    'coins', public._shop_earned(v_st.level, v_st.stars) + v_st.vip_bonus_coins - v_spent,
    'owned', v_owned,
    'equipped', v_st.equipped,
    'clanTag', v_st.clan_tag,
    'vip', exists (select 1 from public.vip_accounts where signup_id = p_sid),
    'badges', (select coalesce(json_agg(achievement_id), '[]'::json) from public.achievement_awards where signup_id = p_sid),
    'items', v_items
  );
end $function$;

CREATE OR REPLACE FUNCTION public.shop_act(p_token text, p_item text, p_tag text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_sid uuid := public._shop_signup(p_token);
  v_it public.shop_items%rowtype;
  v_st public.player_state%rowtype;
  v_owned boolean;
  v_on boolean;
  v_tag text := public._shop_tag(p_tag);
  v_bal int;
  v_msg text;
  v_vip boolean;
  v_price int;
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;

  select * into v_it from public.shop_items where id = p_item;
  if not found then return json_build_object('ok', false, 'error', 'Unknown item'); end if;
  if (v_it.retired or (v_it.available_until is not null and v_it.available_until <= now())) and not exists (select 1 from public.shop_purchases where signup_id = (public._shop_signup(p_token)) and item_id = p_item) then
    return json_build_object('ok', false, 'error', 'No longer sold');
  end if;

  -- Make sure the player's row exists, then lock it. Any other tap for this player waits here.
  perform public._shop_state(v_sid);
  select * into v_st from public.player_state where signup_id = v_sid for update;
  v_vip := exists (select 1 from public.vip_accounts where signup_id = v_sid);
  -- VIPs own everything: level, stars and badge gates do not stop them and they pay nothing.
  v_price := case when v_vip then 0 else v_it.price end;

  if not v_vip and v_st.stars < v_it.min_stars then
    return json_build_object('ok', false, 'error', 'Unlocks at ' || v_it.min_stars ||
      case when v_it.min_stars = 1 then ' prestige star' else ' prestige stars' end);
  end if;
  if not v_vip and v_st.level < v_it.min_level then
    return json_build_object('ok', false, 'error', 'Unlocks at level ' || v_it.min_level);
  end if;

  v_owned := exists (select 1 from public.shop_purchases where signup_id = v_sid and item_id = p_item);
  v_on := (v_st.equipped ->> v_it.slot) = p_item;

  if v_on then
    update public.player_state
       set equipped = jsonb_set(equipped, array[v_it.slot], 'null'::jsonb)
     where signup_id = v_sid;
    v_msg := 'Taken off.';
  else
    if v_it.slot = 'clan' then
      if char_length(v_tag) < 2 then
        return json_build_object('ok', false, 'error', 'Type a 2 to 4 letter or number tag first');
      end if;
      if v_tag = any (public._shop_blocked_tags()) then
        return json_build_object('ok', false, 'error', 'That tag is not allowed');
      end if;
    end if;

    -- R319: badge and VIP unlocks. Taking off is always allowed; buying or equipping needs the unlock.
    if not v_owned and v_it.unlock_kind = 'badge' and not v_vip and not exists (
         select 1 from public.achievement_awards where signup_id = v_sid and achievement_id = v_it.unlock_value) then
      return json_build_object('ok', false, 'error', 'Earn ' || coalesce(
        (select a.title from public.achievements a where a.id = v_it.unlock_value), 'the badge') || ' first');
    end if;
    if not v_owned and v_it.unlock_kind = 'vip' and not v_vip then
      return json_build_object('ok', false, 'error', 'VIP only');
    end if;

    if v_owned then
      v_msg := 'On your card.';
    else
      -- Read after the lock, so this sees every purchase that finished before us.
      v_bal := public._shop_earned(v_st.level, v_st.stars) + v_st.vip_bonus_coins -
               (select coalesce(sum(price_paid), 0) from public.shop_purchases where signup_id = v_sid)
               + (select coalesce(sum(delta), 0) from public.shop_coin_ledger where signup_id = v_sid);
      if v_bal < v_price then
        return json_build_object('ok', false, 'error', 'You need ' || (v_price - v_bal) || ' more coins');
      end if;
      insert into public.shop_purchases (signup_id, item_id, price_paid) values (v_sid, p_item, v_price);
      v_msg := 'Bought. It is on your card.';
    end if;

    update public.player_state
       set equipped = jsonb_set(equipped, array[v_it.slot], to_jsonb(p_item)),
           clan_tag = case when v_it.slot = 'clan' then v_tag else clan_tag end
     where signup_id = v_sid;
  end if;

  return (public._shop_state(v_sid)::jsonb || jsonb_build_object('message', v_msg))::json;
end $function$;

-- 10. Climb calls the phone makes.
create or replace function public.shop_climb_state(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_sid uuid := public._shop_signup(p_token);
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;
  return (public._climb_state(v_sid) || jsonb_build_object('ok', true))::json;
end $$;

create or replace function public.shop_climb_choose_tree(p_token text, p_tree text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_sid uuid := public._shop_signup(p_token);
  v_cl public.shop_climb%rowtype;
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;
  if p_tree is null or p_tree not in ('fire', 'ice', 'gold', 'storm', 'shadow') then
    return json_build_object('ok', false, 'error', 'Unknown tree');
  end if;
  perform public._climb_state(v_sid);
  select * into v_cl from public.shop_climb where signup_id = v_sid for update;
  if v_cl.tree is not null then
    return json_build_object('ok', false, 'error', 'Your tree is already chosen');
  end if;
  update public.shop_climb set tree = p_tree, chosen_at = now() where signup_id = v_sid;
  return (public._climb_state(v_sid) || jsonb_build_object('ok', true, 'message', 'Tree chosen.'))::json;
end $$;

create or replace function public.shop_climb_pick(p_token text, p_level int, p_reward text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_sid uuid := public._shop_signup(p_token);
  v_st public.player_state%rowtype;
  v_cl public.shop_climb%rowtype;
  v_pick jsonb;
  v_paid boolean;
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;
  perform public._climb_state(v_sid);
  select * into v_st from public.player_state where signup_id = v_sid;
  select * into v_cl from public.shop_climb where signup_id = v_sid for update;
  if v_cl.tree is null then return json_build_object('ok', false, 'error', 'Choose a tree first'); end if;
  if p_level is null or p_level < 3 or p_level > 60 or p_level % 3 <> 0 then
    return json_build_object('ok', false, 'error', 'No pick at that level');
  end if;
  if p_level > v_st.level then
    return json_build_object('ok', false, 'error', 'Not reached level ' || p_level || ' yet');
  end if;
  if exists (select 1 from public.shop_picks where signup_id = v_sid and run_no = v_st.prestiges
             and interval_lv = p_level and cleared_at is null) then
    return json_build_object('ok', false, 'error', 'You already picked this one');
  end if;

  select x.value into v_pick from jsonb_array_elements(public._climb_offers(v_sid, p_level)) as x(value)
    where x.value->>'id' = p_reward limit 1;
  if v_pick is null then
    return json_build_object('ok', false, 'error', 'That reward is not on offer');
  end if;

  -- Coins are paid once per run per level, so a respec cannot re-pay the same level.
  v_paid := (v_pick->>'kind') = 'coins' and not exists (select 1 from public.shop_picks where signup_id = v_sid
             and run_no = v_st.prestiges and interval_lv = p_level and kind = 'coins' and paid);

  if (v_pick->>'kind') = 'perk' and (select count(*) from public.shop_picks where signup_id = v_sid and run_no = v_st.prestiges
        and cleared_at is null and kind = 'perk') >= 3 then
    update public.shop_picks set cleared_at = now()
     where signup_id = v_sid and run_no = v_st.prestiges and cleared_at is null and kind = 'perk'
       and picked_at = (select min(picked_at) from public.shop_picks where signup_id = v_sid and run_no = v_st.prestiges
                        and cleared_at is null and kind = 'perk');
  end if;

  insert into public.shop_picks (signup_id, run_no, interval_lv, tree, kind, reward_id, name, descr, value, paid)
  values (v_sid, v_st.prestiges, p_level, v_cl.tree, v_pick->>'kind', p_reward, v_pick->>'name', v_pick->>'desc',
          coalesce((v_pick->>'value')::int, 0), v_paid);

  if v_paid then
    insert into public.shop_coin_ledger (signup_id, delta, reason, run_no)
    values (v_sid, (v_pick->>'value')::int, 'pick ' || p_level, v_st.prestiges);
  end if;

  return (public._climb_state(v_sid) || jsonb_build_object('ok', true, 'message', 'Picked ' || (v_pick->>'name') || '.',
          'pick', v_pick || jsonb_build_object('level', p_level)))::json;
end $$;

-- Respec: ONE free respec per player, ever. Clears the tree and this run's picks (marked cleared_at).
-- No coins are charged. A second respec is refused.
create or replace function public.shop_climb_respec(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_sid uuid := public._shop_signup(p_token);
  v_st public.player_state%rowtype;
  v_cl public.shop_climb%rowtype;
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;
  perform public._climb_state(v_sid);
  select * into v_st from public.player_state where signup_id = v_sid;
  select * into v_cl from public.shop_climb where signup_id = v_sid for update;
  if v_cl.tree is null then return json_build_object('ok', false, 'error', 'Choose a tree first'); end if;
  if v_cl.respec_used then return json_build_object('ok', false, 'error', 'Your free respec is used. You get one, ever.'); end if;

  update public.shop_picks set cleared_at = now()
   where signup_id = v_sid and cleared_at is null;
  update public.shop_climb set tree = null, chosen_at = null, respec_used = true where signup_id = v_sid;

  return (public._climb_state(v_sid) || jsonb_build_object('ok', true, 'message', 'Respec used. Pick a tree again.'))::json;
end $$;

-- 11. Grants, like the other shop calls.
revoke execute on function public._climb_take(text, text, int, uuid, int) from public, anon, authenticated;
revoke execute on function public._climb_offers(uuid, int) from public, anon, authenticated;
revoke execute on function public._climb_state(uuid) from public, anon, authenticated;
revoke execute on function public._shop_state(uuid) from public, anon, authenticated;
revoke execute on function public.shop_state(text) from public;
revoke execute on function public.shop_act(text, text, text) from public;
revoke execute on function public.shop_climb_state(text) from public;
revoke execute on function public.shop_climb_choose_tree(text, text) from public;
revoke execute on function public.shop_climb_pick(text, int, text) from public;
revoke execute on function public.shop_climb_respec(text) from public;
grant execute on function public.shop_state(text) to anon, authenticated;
grant execute on function public.shop_act(text, text, text) to anon, authenticated;
grant execute on function public.shop_climb_state(text) to anon, authenticated;
grant execute on function public.shop_climb_choose_tree(text, text) to anon, authenticated;
grant execute on function public.shop_climb_pick(text, int, text) to anon, authenticated;
grant execute on function public.shop_climb_respec(text) to anon, authenticated;

-- 12. Crews: 3 to 5 players, a name and a 2 to 4 character tag. One active crew per player. Leaving keeps the row (left_at).
create table if not exists public.crews (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 2 and 24),
  tag         text not null unique check (tag ~ '^[A-Z0-9]{2,4}$'),
  created_by  uuid not null references public.signups(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create table if not exists public.crew_members (
  signup_id   uuid primary key references public.signups(id) on delete cascade,
  crew_id     bigint not null references public.crews(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  left_at     timestamptz
);
create index if not exists crew_members_crew_active on public.crew_members (crew_id) where left_at is null;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
revoke all on public.crews, public.crew_members from anon, authenticated;
drop policy if exists crews_deny on public.crews;
create policy crews_deny on public.crews for all to anon, authenticated using (false) with check (false);
drop policy if exists crew_members_deny on public.crew_members;
create policy crew_members_deny on public.crew_members for all to anon, authenticated using (false) with check (false);

-- The crew a player is in right now (null if none): size, and members as 'First L' names (never usernames).
create or replace function public._crew_of(p_sid uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when c.id is null then null else jsonb_build_object(
      'id', c.id, 'name', c.name, 'tag', c.tag,
      'size', (select count(*) from public.crew_members m2 where m2.crew_id = c.id and m2.left_at is null),
      'max', 5, 'youAreCreator', c.created_by = p_sid,
      'members', (select coalesce(jsonb_agg(jsonb_build_object('name', s.first || coalesce(' ' || s.last_initial, ''),
                    'you', m2.signup_id = p_sid, 'creator', m2.signup_id = c.created_by) order by m2.joined_at), '[]'::jsonb)
                  from public.crew_members m2 join public.signups s on s.id = m2.signup_id
                  where m2.crew_id = c.id and m2.left_at is null)) end
  from (select 1) as one
  left join public.crew_members m on m.signup_id = p_sid and m.left_at is null
  left join public.crews c on c.id = m.crew_id
$$;

create or replace function public.shop_crew_state(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_sid uuid := public._shop_signup(p_token);
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;
  return json_build_object('ok', true, 'crew', public._crew_of(v_sid));
end $$;

create or replace function public.shop_crew_create(p_token text, p_name text, p_tag text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_sid uuid := public._shop_signup(p_token);
  v_name text := btrim(coalesce(p_name, ''));
  v_tag text := upper(btrim(coalesce(p_tag, '')));
  v_id bigint;
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;
  if char_length(v_name) < 2 or char_length(v_name) > 24 then
    return json_build_object('ok', false, 'error', 'Crew name needs 2 to 24 letters');
  end if;
  if v_tag !~ '^[A-Z0-9]{2,4}$' then
    return json_build_object('ok', false, 'error', 'Tag needs 2 to 4 letters or numbers');
  end if;
  if v_tag = any (public._shop_blocked_tags()) then
    return json_build_object('ok', false, 'error', 'That tag is not allowed');
  end if;
  if public._crew_of(v_sid) is not null then
    return json_build_object('ok', false, 'error', 'Leave your crew first');
  end if;
  if exists (select 1 from public.crews where tag = v_tag) then
    return json_build_object('ok', false, 'error', 'That tag is taken');
  end if;
  insert into public.crews (name, tag, created_by) values (v_name, v_tag, v_sid) returning id into v_id;
  insert into public.crew_members (signup_id, crew_id, joined_at, left_at) values (v_sid, v_id, now(), null)
    on conflict (signup_id) do update set crew_id = excluded.crew_id, joined_at = now(), left_at = null;
  return json_build_object('ok', true, 'message', 'Crew made.', 'crew', public._crew_of(v_sid));
end $$;

create or replace function public.shop_crew_join(p_token text, p_tag text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_sid uuid := public._shop_signup(p_token);
  v_crew public.crews%rowtype;
  v_size int;
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;
  if public._crew_of(v_sid) is not null then
    return json_build_object('ok', false, 'error', 'Leave your crew first');
  end if;
  select * into v_crew from public.crews where tag = upper(btrim(coalesce(p_tag, '')));
  if not found then return json_build_object('ok', false, 'error', 'No crew with that tag'); end if;
  select count(*) into v_size from public.crew_members where crew_id = v_crew.id and left_at is null;
  if v_size >= 5 then return json_build_object('ok', false, 'error', 'That crew is full (5 players)'); end if;
  insert into public.crew_members (signup_id, crew_id, joined_at, left_at) values (v_sid, v_crew.id, now(), null)
    on conflict (signup_id) do update set crew_id = excluded.crew_id, joined_at = now(), left_at = null;
  return json_build_object('ok', true, 'message', 'Joined ' || v_crew.name || '.', 'crew', public._crew_of(v_sid));
end $$;

create or replace function public.shop_crew_leave(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_sid uuid := public._shop_signup(p_token);
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;
  update public.crew_members set left_at = now() where signup_id = v_sid and left_at is null;
  return json_build_object('ok', true, 'message', 'You left the crew.', 'crew', null);
end $$;

-- 13. Weekly crew XP and the crew board. The XP award calls climb_xp_for_night once per player per night.
create table if not exists public.crew_week_xp (
  crew_id    bigint not null references public.crews(id) on delete cascade,
  week_start date   not null,
  xp         int    not null default 0 check (xp >= 0),
  primary key (crew_id, week_start)
);
alter table public.crew_week_xp enable row level security;
revoke all on public.crew_week_xp from anon, authenticated;
drop policy if exists crew_week_xp_deny on public.crew_week_xp;
create policy crew_week_xp_deny on public.crew_week_xp for all to anon, authenticated using (false) with check (false);

-- Server only (the XP award calls it, never the phone). Returns the bonus XP from this player's live XP perks
-- in the current run, and adds base + bonus to their crew's XP for this week. Call once per player per night.
-- Perk rules (shop_climb_rewards, live = true): gold-perk-1 MVP two nights running +15, gold-perk-2 MVP +10,
-- gold-perk-3 +2 per streak week, storm-perk-1 +5 per game after the 3rd, storm-perk-2 3+ games +10,
-- storm-perk-3 +5 per win, shadow-perk-3 3+ wins +10.
create or replace function public.climb_xp_for_night(p_sid uuid, p_base_xp int, p_games int, p_wins int,
                                                     p_mvp boolean, p_mvp_streak int, p_streak_weeks int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_run   int := coalesce((select prestiges from public.player_state where signup_id = p_sid), 0);
  v_bonus int := 0;
  v_crew  bigint;
  r       record;
begin
  for r in select pk.reward_id from public.shop_picks pk
           where pk.signup_id = p_sid and pk.run_no = v_run and pk.cleared_at is null and pk.kind = 'perk' loop
    v_bonus := v_bonus + case r.reward_id
      when 'gold-perk-1'   then case when coalesce(p_mvp_streak, 0) >= 2 then 15 else 0 end
      when 'gold-perk-2'   then case when coalesce(p_mvp, false) then 10 else 0 end
      when 'gold-perk-3'   then 2 * greatest(coalesce(p_streak_weeks, 0), 0)
      when 'storm-perk-1'  then 5 * greatest(coalesce(p_games, 0) - 3, 0)
      when 'storm-perk-2'  then case when coalesce(p_games, 0) >= 3 then 10 else 0 end
      when 'storm-perk-3'  then 5 * greatest(coalesce(p_wins, 0), 0)
      when 'shadow-perk-3' then case when coalesce(p_wins, 0) >= 3 then 10 else 0 end
      else 0 end;
  end loop;

  select m.crew_id into v_crew from public.crew_members m where m.signup_id = p_sid and m.left_at is null;
  if v_crew is not null then
    insert into public.crew_week_xp (crew_id, week_start, xp)
      values (v_crew, date_trunc('week', now())::date, greatest(coalesce(p_base_xp, 0), 0) + v_bonus)
      on conflict (crew_id, week_start) do update set xp = public.crew_week_xp.xp + excluded.xp;
  end if;
  return v_bonus;
end $$;

create or replace function public.shop_crew_board(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_sid  uuid := public._shop_signup(p_token);
  v_week date := date_trunc('week', now())::date;
  v_rows json;
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;
  select coalesce(json_agg(row_to_json(b)), '[]'::json) into v_rows from (
    select c.name, c.tag, w.xp,
           (select count(*) from public.crew_members m where m.crew_id = c.id and m.left_at is null) as size
      from public.crew_week_xp w join public.crews c on c.id = w.crew_id
     where w.week_start = v_week
     order by w.xp desc, c.tag
     limit 10) b;
  return json_build_object('ok', true, 'weekStart', v_week, 'board', v_rows);
end $$;

revoke execute on function public.climb_xp_for_night(uuid, int, int, int, boolean, int, int) from public, anon, authenticated;
revoke execute on function public.shop_crew_board(text) from public;
grant execute on function public.shop_crew_board(text) to anon, authenticated;

revoke execute on function public._crew_of(uuid) from public, anon, authenticated;
revoke execute on function public.shop_crew_state(text) from public;
revoke execute on function public.shop_crew_create(text, text, text) from public;
revoke execute on function public.shop_crew_join(text, text) from public;
revoke execute on function public.shop_crew_leave(text) from public;
grant execute on function public.shop_crew_state(text) to anon, authenticated;
grant execute on function public.shop_crew_create(text, text, text) to anon, authenticated;
grant execute on function public.shop_crew_join(text, text) to anon, authenticated;
grant execute on function public.shop_crew_leave(text) to anon, authenticated;
