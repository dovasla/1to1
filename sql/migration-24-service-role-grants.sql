-- 1TO1 player app: server-side grants for the Square auto-pay Edge Functions (migration 24).
-- The Edge Functions use the service role key (server only; players never use it).
-- Without these, create-pay-link and square-webhook get "db-403" when reading player_sessions and signups.
-- Only adds privileges to service_role. Nothing is deleted or changed in existing data. Safe to run again.
grant select, insert, update, delete on public.player_sessions, public.signups, public.pay_orders, public.night_payments to service_role;
