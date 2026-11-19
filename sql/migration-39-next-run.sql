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
