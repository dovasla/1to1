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

begin;

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

commit;

-- Tell PostgREST (the API) to reload its function list so the new argument is seen at once.
notify pgrst, 'reload schema';
