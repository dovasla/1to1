-- 1TO1 player app: migration 6 (skill rating, 14 Nov 2026). Run once in the SQL Editor, AFTER migration-5.
-- NOT run yet. The coordinator's SQL thread runs it, after Jord approves in that thread.
-- Adds:
--   skill_score         the 1 to 1000 number teams are built on. Starts as a placeholder from the 1 to 30 pick.
--   skill_answers       the answers to the skill questions (kept for Jord's reference).
--   skill_done          true once the player has answered the questions. Locks both the 1 to 30 and the questions.
--   skill_by_organiser  true once Jord sets the number in the organiser. Player answers then never change the number.
-- Safe to run again. Existing players and their PINs are kept.

alter table public.signups
  add column if not exists skill_score int check (skill_score between 100 and 1000),
  add column if not exists skill_answers jsonb,
  add column if not exists skill_done boolean not null default false,
  add column if not exists skill_by_organiser boolean not null default false;

-- Existing players: placeholder from their 1 to 30 pick (level 1 = 100, level 30 = 1000, linear).
update public.signups
set skill_score = round(100 + (skill_level - 1) * 900.0 / 29)
where skill_score is null;

-- New sign-ups get the same placeholder automatically. Sign-up function itself is unchanged.
create or replace function public.signups_set_placeholder()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.skill_score is null then
    new.skill_score := round(100 + (new.skill_level - 1) * 900.0 / 29);
  end if;
  return new;
end $$;

drop trigger if exists signups_placeholder on public.signups;
create trigger signups_placeholder
  before insert on public.signups
  for each row execute function public.signups_set_placeholder();

-- The question score, 100 to 1000. Same maths as skill-score in player-app/rules.js (the tests check 796 for 10/8/7/5 at 69 inches).
-- Weights 40/20/15/15/10 (Fable 23:14). Height 53 to 84 inches maps to 1 to 10.
create or replace function public.skill_score_from_answers(p jsonb)
returns int
language plpgsql immutable set search_path = public as $$
declare
  v_h numeric := least(84, greatest(53, (p->>'height')::numeric));
  v_raw numeric;
begin
  v_raw := 0.40 * (p->>'exp')::numeric
         + 0.20 * (p->>'shoot')::numeric
         + 0.15 * (p->>'dribble')::numeric
         + 0.15 * (p->>'run')::numeric
         + 0.10 * (1 + (v_h - 53) * 9 / 31);
  return least(1000, greatest(100, round(v_raw * 100)))::int;
end $$;

-- Player: answer the skill questions once. Needs a signed-in phone (player_sessions token).
-- Answers: exp, shoot, dribble, run (each 1 to 10) and height (53 to 84 inches). Optional best (text, not scored).
-- Once answered, nothing can change it again. If Jord has already set the number, the answers are saved but the number stays.
create or replace function public.player_skill_answer(p_token text, p_answers jsonb)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_done boolean;
  v_org boolean;
  v_k text;
begin
  select p.signup_id into v_id from public.player_sessions p
  where p.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and p.expires_at > now()
  limit 1;
  if v_id is null then return json_build_object('ok', false, 'reason', 'not-signed-in'); end if;

  select s.skill_done, s.skill_by_organiser into v_done, v_org
  from public.signups s where s.id = v_id for update;
  if v_done then return json_build_object('ok', false, 'reason', 'already-done'); end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'bad-answers'; end if;
  foreach v_k in array array['exp', 'shoot', 'dribble', 'run'] loop
    if (p_answers->>v_k) is null or (p_answers->>v_k)::int not between 1 and 10 then
      raise exception 'bad-answers';
    end if;
  end loop;
  if (p_answers->>'height') is null or (p_answers->>'height')::int not between 53 and 84 then
    raise exception 'bad-answers';
  end if;
  if p_answers ? 'best' and char_length(p_answers->>'best') > 20 then raise exception 'bad-answers'; end if;

  update public.signups s set
    skill_answers = p_answers,
    skill_done = true,
    skill_score = case when v_org then s.skill_score else public.skill_score_from_answers(p_answers) end
  where s.id = v_id;

  -- The player never sees the number, only that the questions are done.
  return json_build_object('ok', true, 'done', true);
end $$;

-- Player: does this phone still owe the skill questions? Drives the yellow warning under Settings.
create or replace function public.player_skill_status(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_done boolean;
begin
  select s.skill_done into v_done from public.player_sessions p join public.signups s on s.id = p.signup_id
  where p.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and p.expires_at > now()
  limit 1;
  if not found then return json_build_object('ok', false); end if;
  return json_build_object('ok', true, 'done', v_done);
end $$;

-- Organiser only (Jord, signed in): set a player's 1 to 1000 number by hand. This always wins over player input.
create or replace function public.organiser_set_skill(p_id uuid, p_score int)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_score is null or p_score not between 100 and 1000 then raise exception 'bad-score'; end if;
  update public.signups set skill_score = p_score, skill_by_organiser = true where id = p_id;
  return found;
end $$;

-- Who may call what. Players call the two player_skill functions. Only Jord calls organiser_set_skill.
revoke all on function public.player_skill_answer(text, jsonb) from public;
revoke all on function public.player_skill_status(text) from public;
revoke all on function public.organiser_set_skill(uuid, int) from public;
grant execute on function public.player_skill_answer(text, jsonb) to anon, authenticated;
grant execute on function public.player_skill_status(text) to anon, authenticated;
grant execute on function public.organiser_set_skill(uuid, int) to authenticated;
