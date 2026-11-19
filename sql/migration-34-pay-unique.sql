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
