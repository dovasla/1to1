-- 1TO1 shop extras: season trophies, bounty night, shot-of-the-night vote, seasonal events, team bib colours.
-- DRAFT, not run. Needs Jord's yes. Runs after shop climb v3 (it uses _shop_signup from the shop server).
-- Rules:
--   * Every table is deny-by-default (RLS on, no policy for anon or authenticated). Phones only call the RPCs below.
--   * Organiser writes (bounty, bibs, events) are not in this file: they are set by the organiser tools later.
--   * Night ids are text (the night id the XP ledger uses). No foreign keys to night tables we cannot see.
-- Calls the phone makes (token first):
--   shop_extras_state(p_token)            trophies, active events, tonight's bounty and bibs (one call for the screen)
--   shop_vote_shot(p_token, p_night, p_shot)  one vote per player per night, for a shot the night recorded

-- 1. Season trophies: awarded by the organiser per season (one row per player per trophy per season).
create table if not exists public.season_trophies (
  signup_id   uuid not null references public.signups(id) on delete cascade,
  season_id   text not null,
  trophy_id   text not null,
  awarded_at  timestamptz not null default now(),
  primary key (signup_id, season_id, trophy_id)
);

-- 2. Bounty night: one row per night the organiser marks. Bonus is shown to players; XP itself is the award's job.
create table if not exists public.bounty_nights (
  night_id    text primary key,
  title       text not null check (char_length(title) between 2 and 40),
  bonus_xp    int  not null default 0 check (bonus_xp between 0 and 100),
  set_at      timestamptz not null default now()
);

-- 3. Shot of the night vote. shot is the shot id the organiser recorded for that night.
create table if not exists public.shot_votes (
  signup_id   uuid not null references public.signups(id) on delete cascade,
  night_id    text not null,
  shot        text not null check (char_length(shot) between 1 and 64),
  voted_at    timestamptz not null default now(),
  primary key (signup_id, night_id)
);

-- 4. Seasonal events (double coins, bracket, and so on). Active when now() is inside the window.
create table if not exists public.season_events (
  id          text primary key,
  name        text not null check (char_length(name) between 2 and 40),
  effect      text not null default '',
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  check (ends_at > starts_at)
);

-- 5. Team bib colours for the Live court, set per night by the organiser. Colours are never pure red or team blue.
create table if not exists public.night_bibs (
  night_id    text not null,
  team        text not null check (team in ('A', 'B')),
  colour      text not null check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  primary key (night_id, team)
);

alter table public.season_trophies enable row level security;
alter table public.bounty_nights enable row level security;
alter table public.shot_votes enable row level security;
alter table public.season_events enable row level security;
alter table public.night_bibs enable row level security;
revoke all on public.season_trophies, public.bounty_nights, public.shot_votes, public.season_events, public.night_bibs
  from anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['season_trophies', 'bounty_nights', 'shot_votes', 'season_events', 'night_bibs'] loop
    execute format('drop policy if exists %I_deny on public.%I', t, t);
    execute format('create policy %I_deny on public.%I for all to anon, authenticated using (false) with check (false)', t, t);
  end loop;
end $$;

-- The one call the extras screen needs. Trophies are the player's own; events and bounty are public to signed-in players.
create or replace function public.shop_extras_state(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_sid     uuid := public._shop_signup(p_token);
  v_trophies json;
  v_events  json;
  v_bounty  json;
  v_bibs    json;
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;

  select coalesce(json_agg(json_build_object('season', season_id, 'trophy', trophy_id, 'awardedAt', awarded_at)
                           order by awarded_at desc), '[]'::json)
    into v_trophies from public.season_trophies where signup_id = v_sid;

  select coalesce(json_agg(json_build_object('id', id, 'name', name, 'effect', effect, 'endsAt', ends_at)
                           order by ends_at), '[]'::json)
    into v_events from public.season_events where now() between starts_at and ends_at;

  -- Bounty: the most recent night the organiser marked in the last 24 hours (tonight's, in practice).
  select coalesce((select json_build_object('nightId', night_id, 'title', title, 'bonusXp', bonus_xp)
                     from public.bounty_nights where set_at > now() - interval '24 hours'
                    order by set_at desc limit 1), null::json)
    into v_bounty;

  select coalesce(json_agg(json_build_object('nightId', night_id, 'team', team, 'colour', colour)), '[]'::json)
    into v_bibs from public.night_bibs
   where night_id in (select night_id from public.bounty_nights where set_at > now() - interval '24 hours');

  return json_build_object('ok', true, 'trophies', v_trophies, 'events', v_events, 'bounty', v_bounty, 'bibs', v_bibs);
end $$;

-- One vote per player per night. The shot must be one the night recorded (the organiser writes the shot list elsewhere,
-- so this draft only checks the vote is new; the shot check is added when the shot table exists).
create or replace function public.shop_vote_shot(p_token text, p_night text, p_shot text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_sid uuid := public._shop_signup(p_token);
begin
  if v_sid is null then return json_build_object('ok', false, 'error', 'Sign in again'); end if;
  if p_night is null or char_length(p_night) < 1 or p_shot is null or char_length(p_shot) < 1 then
    return json_build_object('ok', false, 'error', 'Pick a shot to vote for');
  end if;
  if exists (select 1 from public.shot_votes where signup_id = v_sid and night_id = p_night) then
    return json_build_object('ok', false, 'error', 'You have already voted for this night');
  end if;
  insert into public.shot_votes (signup_id, night_id, shot) values (v_sid, p_night, p_shot);
  return json_build_object('ok', true, 'message', 'Vote in.');
end $$;

revoke execute on function public.shop_extras_state(text) from public;
revoke execute on function public.shop_vote_shot(text, text, text) from public;
grant execute on function public.shop_extras_state(text) to anon, authenticated;
grant execute on function public.shop_vote_shot(text, text, text) to anon, authenticated;
