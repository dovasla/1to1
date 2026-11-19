-- 1TO1 player app: automatic Square payments (migration 5).
-- Run in the Supabase SQL editor AFTER setup.sql, migration-2-safer-signup.sql and pay-claim.sql.
-- Safe to run again. Does not change any existing table or function except adding new ones.
--
-- Rules this file enforces:
--   * Only the Square webhook (Edge Function, service role) can write night_payments. Players can never.
--   * A player can only READ their own paid flag, through player_payment_status(token, night).
--   * Organiser (signed in) can read night_payments. Nothing else.
--   * pay_claims (the old "I've paid" tap) stays as the fallback for cash and other payments.

-- One row per Square payment link we create. The id is also the Square reference_id,
-- so the webhook can match a payment to the player and night without trusting anything the phone sent.
create table if not exists public.pay_orders (
  id uuid primary key,
  signup_id uuid not null references public.signups(id) on delete cascade,
  night_id text not null references public.nights(id) on delete cascade,
  amount_pence int not null check (amount_pence > 0 and amount_pence <= 100000),
  status text not null default 'pending' check (status in ('pending', 'open', 'failed')),
  square_order_id text,
  square_link_id text,
  pay_url text,
  created_at timestamptz not null default now()
);
create index if not exists pay_orders_signup_night on public.pay_orders (signup_id, night_id);
create unique index if not exists pay_orders_square_order on public.pay_orders (square_order_id) where square_order_id is not null;

-- The paid flag. active = true means paid. Refund sets active = false (the row is kept, nothing is deleted).
create table if not exists public.night_payments (
  signup_id uuid not null references public.signups(id) on delete cascade,
  night_id text not null references public.nights(id) on delete cascade,
  active boolean not null default true,
  square_payment_id text not null,
  amount_pence int not null,
  updated_at timestamptz not null default now(),
  primary key (signup_id, night_id)
);

alter table public.pay_orders enable row level security;
alter table public.night_payments enable row level security;

-- Players (anon) and signed-in phones get no direct table access.
revoke all on public.pay_orders from anon, authenticated;
revoke all on public.night_payments from anon, authenticated;

-- Organiser (Jord, signed in) can read the paid list. Only the webhook writes it.
drop policy if exists "organiser read night_payments" on public.night_payments;
create policy "organiser read night_payments" on public.night_payments for select to authenticated
  using (true);
grant select on public.night_payments to authenticated;

-- Player checks their own paid flag. Uses the 90-day sign-in token, same check as player_claim_paid.
create or replace function public.player_payment_status(p_token text, p_night text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_active boolean;
begin
  select s.id into v_id
  from public.player_sessions p join public.signups s on s.id = p.signup_id
  where p.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and p.expires_at > now()
  limit 1;
  if v_id is null then
    return json_build_object('ok', false, 'reason', 'signed-out');
  end if;
  select np.active into v_active
  from public.night_payments np
  where np.signup_id = v_id and np.night_id = p_night;
  return json_build_object('ok', true, 'paid', coalesce(v_active, false));
end $$;

revoke execute on function public.player_payment_status(text, text) from public;
grant execute on function public.player_payment_status(text, text) to anon, authenticated;
