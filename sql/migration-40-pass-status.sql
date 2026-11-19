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
