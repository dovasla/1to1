-- PROPOSAL ONLY. NOT RUN. The Fable desk must approve and give it a migration number first.
-- Without this, the receipt shows "Paid £5 · 15 Nov" (no ref), because player_payment_status returns only paid today.
-- Adds two fields to the player's OWN paid check. Same signature, same token check, same grants.
-- Ref = last 4 characters of the Square payment id, upper case. Only returned while the payment counts (active).
create or replace function public.player_payment_status(p_token text, p_night text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_row record;
begin
  select s.id into v_id
  from public.player_sessions p join public.signups s on s.id = p.signup_id
  where p.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and p.expires_at > now()
  limit 1;
  if v_id is null then
    return json_build_object('ok', false, 'reason', 'signed-out');
  end if;
  select np.active, np.amount_pence, np.square_payment_id into v_row
  from public.night_payments np
  where np.signup_id = v_id and np.night_id = p_night;
  return json_build_object(
    'ok', true,
    'paid', coalesce(v_row.active, false),
    'amountPence', case when coalesce(v_row.active, false) then v_row.amount_pence end,
    'ref', case when coalesce(v_row.active, false) then upper(right(v_row.square_payment_id, 4)) end
  );
end $$;
-- After running: notify pgrst, 'reload schema';
