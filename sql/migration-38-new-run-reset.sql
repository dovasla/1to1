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

begin;

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

commit;
