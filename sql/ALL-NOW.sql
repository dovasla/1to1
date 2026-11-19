-- ALL-NOW: migrations 34, 37, 38, 39, 40 in order. Run once in Supabase SQL Editor.
begin;

-- ===== migration-34-pay-unique.sql =====
-- 1TO1 player app: migration 34. One live pay link per player per night.
-- Run in the Supabase SQL editor AFTER migration-5-square-auto.sql (pay_orders must exist).
-- Safe to run again. Only adds a check and one new index. Does not change any table, policy or function.
--
-- Why: pay-core checks for an open or pending link before it makes one, but two taps at the
-- same instant can both pass that check. This index stops the second row at the database.
-- Failed rows are left out, so a player can still get a new link after a failed try.

-- Step 1 (read only): list any player and night with more than one pending or open link.
-- If this returns rows, step 2 stops. Fix those rows by hand, then run the file again.
select signup_id, night_id, count(*) as live_links
from public.pay_orders
where status in ('pending', 'open')
group by signup_id, night_id
having count(*) > 1;

-- Step 2: stop the run if any duplicates exist, so the index below can be made.
do $$
declare
  v_list text;
begin
  select string_agg(signup_id::text || ' / ' || night_id, ', ') into v_list
  from (
    select signup_id, night_id
    from public.pay_orders
    where status in ('pending', 'open')
    group by signup_id, night_id
    having count(*) > 1
    limit 20
  ) d;
  if v_list is not null then
    raise exception 'migration-34 stopped: duplicate live pay links (signup / night): %. Fix them, then run this file again.', v_list;
  end if;
end $$;

-- Step 3: one live link per player per night. Pending or open only.
create unique index if not exists pay_orders_one_live_per_night
  on public.pay_orders (signup_id, night_id)
  where status in ('pending', 'open');

-- Step 4: tell the API to reload its schema cache.
notify pgrst, 'reload schema';

-- ===== migration-37-cash-fix.sql =====
-- migration-37-cash-fix.sql
-- Cash "Mark paid" and "Mark unpaid" from the organiser (brief K, ruling R55). Local Postgres 16 tested only. NOT run on live.
-- Run ONCE in the Supabase SQL Editor (project 1TO1), AFTER final-15nov/r5/ALL-IN-ONE-now.sql. Safe to run again.
-- Never run setup.sql or schema.sql. Only Jord runs this, after approval in the SQL thread.
--
-- Why:
--   1. The organiser's "Mark unpaid" sends p_amount_pence. organiser_mark_cash_unpaid takes only two ids, so PostgREST answers 404.
--      This file gives it an optional p_amount_pence (ignored), so the installed organiser works without a new APK.
--   2. Both cash functions must check public.is_organiser() (R1). Any copy that still calls is_owner() (the old migration-13 text)
--      fails on every call. This file redefines both with is_organiser().
--   Nothing else changes. A hand mark (source not 'card') is the only thing Mark unpaid clears. A Square row is never cleared here.


-- 0. Guard: the organiser check and the cash table must already exist.
do $$
begin
  if to_regprocedure('public.is_organiser()') is null then
    raise exception 'is-organiser-missing: run ALL-IN-ONE-now.sql first';
  end if;
  if to_regclass('public.night_payments') is null then
    raise exception 'night-payments-missing: run migration-5-square-auto.sql first';
  end if;
end $$;

alter table public.night_payments add column if not exists source text default 'card';

-- 1. Mark paid. Same 4-argument signature as ALL-IN-ONE (p_source defaults to 'cash').
drop function if exists public.organiser_mark_cash_paid(uuid, text, int);
create or replace function public.organiser_mark_cash_paid(p_signup_id uuid, p_night_id text, p_amount_pence int, p_source text default 'cash')
returns json
language plpgsql security definer set search_path = public as $$
declare ref text;
begin
  if not public.is_organiser() then
    raise exception 'not-organiser';
  end if;
  if p_amount_pence is null or p_amount_pence <= 0 or p_amount_pence > 100000 then
    raise exception 'bad-amount';
  end if;
  if p_source is null or p_source not in ('cash', 'pass', 'hand') then
    raise exception 'bad-source';
  end if;
  ref := case when p_source = 'cash' then 'cash-manual' else 'manual-' || p_source end;
  insert into public.night_payments (signup_id, night_id, active, square_payment_id, amount_pence, updated_at, source)
  values (p_signup_id, p_night_id, true, ref, p_amount_pence, now(), p_source)
  on conflict (signup_id, night_id) do update
    set active = true, square_payment_id = ref, amount_pence = excluded.amount_pence,
        updated_at = now(), source = p_source;
  return json_build_object('ok', true, 'source', p_source);
end $$;

-- 2. Mark unpaid. The old 2-argument version must go first: with both present, a 2-argument call is ambiguous.
--    p_amount_pence is optional and ignored, so old and new organiser builds both work.
drop function if exists public.organiser_mark_cash_unpaid(uuid, text);
create or replace function public.organiser_mark_cash_unpaid(p_signup_id uuid, p_night_id text, p_amount_pence int default null)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_organiser() then
    raise exception 'not-organiser';
  end if;
  update public.night_payments set active = false, updated_at = now()
  where signup_id = p_signup_id and night_id = p_night_id and coalesce(source, 'card') <> 'card';
  return json_build_object('ok', true);
end $$;

-- 3. Permissions: only a signed-in organiser can call them.
revoke execute on function public.organiser_mark_cash_paid(uuid, text, int, text) from public, anon;
revoke execute on function public.organiser_mark_cash_unpaid(uuid, text, int) from public, anon;
grant execute on function public.organiser_mark_cash_paid(uuid, text, int, text) to authenticated;
grant execute on function public.organiser_mark_cash_unpaid(uuid, text, int) to authenticated;


-- Tell PostgREST (the API) to reload its function list so the new argument is seen at once.
notify pgrst, 'reload schema';

-- ===== migration-38-new-run-reset.sql =====
-- migration-38-new-run-reset.sql (Fable R58, 15 Nov 2026; spec in revamp/STRESS-LOGIC-15NOV.md)
-- Server only. Works with the organiser already installed (it stores every run under 'tonight'
-- and sends the run's own id when it ends the run).
--
-- Part A: End run really ends the code. If there is no code under the id it was given,
--         end the code stored under 'tonight'. (Fixes stress case 7: a code kept working after End run.)
-- Part B: A new run starts clean. Before a new code is made, look at the old one:
--         - no old code, or it ended more than 10 minutes ago  -> NEW RUN: copy that night's
--           check-ins and payments to the keep-forever *_past tables (with the old code's made-at
--           time), then clear check-ins, payments and wrong-try rows for that night.
--         - old code still valid (New code mid-run) or ended within 10 minutes (Reopen) -> keep everything.
-- Never touches player_night_stats, XP or game history.
--
-- Local Postgres tested only (tests-38-new-run-reset.sql). Do NOT run live without Jord's go.
-- Safe to run twice. Whole file is one transaction. Never re-run setup.sql or schema.sql.


-- 1. Keep-forever archive tables. Nobody reads or writes them directly (no policies, no grants).
--    No foreign keys on purpose: an archive must survive a deleted player or night.
create table if not exists public.night_checkins_past (
  id           bigint generated always as identity primary key,
  night_id     text not null,
  signup_id    uuid not null,
  at           timestamptz,
  code_made_at timestamptz,
  archived_at  timestamptz not null default now()
);

-- Whole row kept as jsonb, so later column changes to night_payments do not break the archive.
create table if not exists public.night_payments_past (
  id           bigint generated always as identity primary key,
  night_id     text not null,
  code_made_at timestamptz,
  data         jsonb not null,
  archived_at  timestamptz not null default now()
);

alter table public.night_checkins_past enable row level security;
alter table public.night_payments_past enable row level security;
revoke all on public.night_checkins_past, public.night_payments_past from public, anon, authenticated;

-- 2. Organiser: make a new code. Same as migration-35 (valid now, 12 hours), plus the new-run reset.
create or replace function public.organiser_new_run_code(p_night text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_payload jsonb;
  v_from timestamptz;
  v_to timestamptz;
  v_code text;
  v_old text;
  v_old_made timestamptz;
  v_old_to timestamptz;
begin
  if not public.is_organiser() then raise exception 'not-organiser'; end if;

  select n.payload into v_payload from public.nights n where n.id = p_night;
  if not found then raise exception 'no-night'; end if;
  if coalesce(v_payload->>'cancelled', 'false') = 'true' then raise exception 'run-cancelled'; end if;

  -- Is this a new run? Look at the code that is there now.
  select c.code, c.made_at, c.valid_to into v_old, v_old_made, v_old_to
    from public.night_codes c where c.night_id = p_night;
  if not found or v_old_to <= now() - interval '10 minutes' then
    insert into public.night_checkins_past (night_id, signup_id, at, code_made_at)
      select ci.night_id, ci.signup_id, ci.at, v_old_made
        from public.night_checkins ci where ci.night_id = p_night;
    insert into public.night_payments_past (night_id, code_made_at, data)
      select np.night_id, v_old_made, to_jsonb(np)
        from public.night_payments np where np.night_id = p_night;
    delete from public.night_checkins where night_id = p_night;
    delete from public.night_payments where night_id = p_night;
    delete from public.night_code_tries where night_id = p_night;
  end if;

  v_from := now() - interval '2 seconds';
  v_to := now() + interval '12 hours';

  loop
    v_code := public._run_code_make();
    exit when v_code is distinct from v_old;
  end loop;

  insert into public.night_codes as c (night_id, code, valid_from, valid_to, made_at)
  values (p_night, v_code, v_from, v_to, now())
  on conflict (night_id) do update set
    code = excluded.code,
    valid_from = excluded.valid_from,
    valid_to = excluded.valid_to,
    made_at = excluded.made_at;

  return json_build_object('ok', true, 'code', v_code, 'validFrom', v_from, 'validTo', v_to);
end $$;

-- 3. Organiser: end the code now. Part A: if nothing is stored under the id given, end 'tonight'.
create or replace function public.organiser_end_run_code(p_night text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id text := p_night;
begin
  if not public.is_organiser() then raise exception 'not-organiser'; end if;
  if not exists (select 1 from public.night_codes c where c.night_id = p_night) then
    v_id := 'tonight';
  end if;
  update public.night_codes c
     set valid_from = least(c.valid_from, now() - interval '2 seconds'),
         valid_to = now() - interval '1 second'
   where c.night_id = v_id;
  if not found then return json_build_object('ok', false, 'reason', 'no-code'); end if;
  return json_build_object('ok', true, 'ended', true);
end $$;

-- 4. Grants (same as migration-25 / migration-35). Organiser login only.
revoke all on function public.organiser_new_run_code(text) from public, anon;
grant execute on function public.organiser_new_run_code(text) to authenticated;
revoke all on function public.organiser_end_run_code(text) from public, anon;
grant execute on function public.organiser_end_run_code(text) to authenticated;

-- 5. Reload the API schema so the new functions are used at once.
notify pgrst, 'reload schema';


-- ===== migration-39-next-run.sql =====
-- migration-39-next-run.sql (organiser src-23, Jord 15 Nov: "Next run" in the synced organiser shows on the player Home)
-- One row holds the next upcoming run: date, start time and place (the court name). Nothing else.
-- The organiser writes it with organiser_set_next_run (owner only). Players read it with player_next_run
-- (no sign-in, no ids, no counts). A run whose date has passed is not returned.
-- Do NOT run live without Jord's go. Test on a scratch database first.

create table if not exists public.next_run (
  id          text primary key default 'next' check (id = 'next'),
  run_date    date,
  start_time  text,
  place       text,
  updated_at  timestamptz not null default now()
);

alter table public.next_run enable row level security;
-- No policies: nobody reads or writes the table directly. Only the two functions below.
revoke all on public.next_run from public, anon, authenticated;

create or replace function public.organiser_set_next_run(p_date text, p_start text, p_place text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_date date;
  v_place text := left(btrim(coalesce(p_place, '')), 60);
begin
  if not public.is_organiser() then raise exception 'not-organiser'; end if;
  if coalesce(p_date, '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'bad-date'; end if;
  if coalesce(p_start, '') !~ '^[0-9]{1,2}:[0-9]{2}$' then raise exception 'bad-time'; end if;
  v_date := p_date::date;

  insert into public.next_run (id, run_date, start_time, place, updated_at)
  values ('next', v_date, p_start, v_place, now())
  on conflict (id) do update
    set run_date = excluded.run_date,
        start_time = excluded.start_time,
        place = excluded.place,
        updated_at = excluded.updated_at;

  return json_build_object('ok', true);
end $$;

revoke all on function public.organiser_set_next_run(text, text, text) from public;
grant execute on function public.organiser_set_next_run(text, text, text) to authenticated;

-- Player read. Returns only date, start and place. Hidden once the date has passed (London time).
create or replace function public.player_next_run()
returns json
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select json_build_object(
              'ok', true,
              'date', to_char(n.run_date, 'YYYY-MM-DD'),
              'start', n.start_time,
              'place', n.place)
       from public.next_run n
      where n.id = 'next'
        and n.run_date >= (now() at time zone 'Europe/London')::date
      limit 1),
    json_build_object('ok', true, 'date', null, 'start', null, 'place', null)
  );
$$;

revoke all on function public.player_next_run() from public;
grant execute on function public.player_next_run() to anon, authenticated;

notify pgrst, 'reload schema';

-- ===== migration-40-pass-status.sql =====
-- migration-40-pass-status.sql (next-36, ruling R59)
-- Lets the player phone see a pass from the organiser. A pass means free for this run:
-- the phone shows "You're in. Pass." and never a Pay step.
-- Needs migration-37 first (order: 37, 38, 39, 40) (adds night_payments.source). Changes only the read function.
-- Do NOT run live without Jord's go. Test on a scratch database first.
-- Note: the installed organiser (src-22) does not send a pass to the server yet. Until it does, pass stays false.
-- src-24 (ruling R59): a pass is sent as organiser_mark_cash_paid with source 'pass' and amount 0.
-- This file also lets organiser_mark_cash_paid accept amount 0 for source 'pass' ONLY. Other sources still need > 0.
-- Changes: the read function (above) and organiser_mark_cash_paid (below). Safe to run twice.

create or replace function public.player_payment_status(p_token text, p_night text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_active boolean;
  v_source text;
begin
  select s.id into v_id
  from public.player_sessions p join public.signups s on s.id = p.signup_id
  where p.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and p.expires_at > now()
  limit 1;
  if v_id is null then
    return json_build_object('ok', false, 'reason', 'signed-out');
  end if;
  select np.active, coalesce(np.source, 'card') into v_active, v_source
  from public.night_payments np
  where np.signup_id = v_id and np.night_id = p_night;
  return json_build_object('ok', true,
    'paid', coalesce(v_active, false),
    'pass', coalesce(v_active, false) and coalesce(v_source, 'card') = 'pass');
end $$;

revoke execute on function public.player_payment_status(text, text) from public;
grant execute on function public.player_payment_status(text, text) to anon, authenticated;

-- organiser_mark_cash_paid: same signature as migration-37. Only the amount rule changes (0 allowed for pass).
create or replace function public.organiser_mark_cash_paid(p_signup_id uuid, p_night_id text, p_amount_pence int, p_source text default 'cash')
returns json
language plpgsql security definer set search_path = public as $$
declare ref text;
begin
  if not public.is_organiser() then
    raise exception 'not-organiser';
  end if;
  if p_source is null or p_source not in ('cash', 'pass', 'hand') then
    raise exception 'bad-source';
  end if;
  if p_amount_pence is null or p_amount_pence < 0 or p_amount_pence > 100000 then
    raise exception 'bad-amount';
  end if;
  if p_amount_pence = 0 and p_source <> 'pass' then
    raise exception 'bad-amount';
  end if;
  ref := case when p_source = 'cash' then 'cash-manual' else 'manual-' || p_source end;
  insert into public.night_payments (signup_id, night_id, active, square_payment_id, amount_pence, updated_at, source)
  values (p_signup_id, p_night_id, true, ref, p_amount_pence, now(), p_source)
  on conflict (signup_id, night_id) do update
    set active = true, square_payment_id = ref, amount_pence = excluded.amount_pence,
        updated_at = now(), source = p_source;
  return json_build_object('ok', true, 'source', p_source);
end $$;

revoke execute on function public.organiser_mark_cash_paid(uuid, text, int, text) from public, anon;
grant execute on function public.organiser_mark_cash_paid(uuid, text, int, text) to authenticated;

notify pgrst, 'reload schema';

commit;
