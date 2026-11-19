-- JORD-PASTE-ICON-SAVE.sql
-- Second small paste, after JORD-PASTE-PHOTOS-FULL.sql. Saves each player's chosen Phosphor icon and lets
-- other players see approved photos and chosen icons (by public_id only, never names or internal ids).
-- Safe to run many times. NOT RUN on live. Run only after Jord's yes.

alter table public.signups add column if not exists photo_icon text;
alter table public.signups drop constraint if exists signups_photo_icon_check;
alter table public.signups add constraint signups_photo_icon_check check (
  photo_icon is null or photo_icon in ('basketball','sneaker','sneaker-move','person-simple-run','trophy','flame','crown',
    'crown-simple','medal','lightning','lightning-a','rocket','barbell','star','fire','target','hand-fist',
    'shooting-star','smiley-sticker','heart'));

-- Player picks (or clears) their icon. Needs a valid sign-in token. Declined players cannot.
create or replace function public.player_set_photo_icon(p_token text, p_icon text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_status text;
begin
  select p.signup_id, s.status into v_id, v_status
  from public.player_sessions p join public.signups s on s.id = p.signup_id
  where p.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and p.expires_at > now()
  limit 1;
  if not found then return json_build_object('ok', false, 'reason', 'signed-out'); end if;
  if v_status = 'declined' then return json_build_object('ok', false, 'reason', 'not-allowed'); end if;
  if p_icon is not null and p_icon <> '' and p_icon not in ('basketball','sneaker','sneaker-move','person-simple-run','trophy','flame','crown',
    'crown-simple','medal','lightning','lightning-a','rocket','barbell','star','fire','target','hand-fist',
    'shooting-star','smiley-sticker','heart') then
    return json_build_object('ok', false, 'reason', 'bad-icon');
  end if;
  update public.signups set photo_icon = nullif(p_icon, '') where id = v_id;
  return json_build_object('ok', true, 'icon', nullif(p_icon, ''));
end $$;

-- What other players may see on the board and in a player card: public_id, chosen icon, and the photo only when approved.
-- Hidden players (visible = false) are left out completely. No names, no internal ids.
create or replace function public.player_public_looks()
returns table (public_id text, photo_icon text, image_data text)
language sql stable security definer set search_path = public as $$
  select s.public_id, s.photo_icon,
         (select p.image_data from public.player_photos p where p.signup_id = s.id and p.status = 'approved')
  from public.signups s
  where s.public_id is not null
    and s.visible is not false
    and (s.photo_icon is not null or exists (select 1 from public.player_photos p where p.signup_id = s.id and p.status = 'approved'))
  limit 500;
$$;

revoke execute on function public.player_set_photo_icon(text, text) from public;
revoke execute on function public.player_public_looks() from public;
grant execute on function public.player_set_photo_icon(text, text) to anon, authenticated;
grant execute on function public.player_public_looks() to anon, authenticated;

-- The player's own status, photo and chosen icon (replaces the version in PHOTOS-FULL, same behaviour plus icon).
create or replace function public.player_my_photo(p_token text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_row public.player_photos%rowtype;
  v_icon text;
begin
  select p.signup_id into v_id from public.player_sessions p
  where p.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and p.expires_at > now()
  limit 1;
  if not found then return json_build_object('ok', false, 'reason', 'signed-out'); end if;
  select photo_icon into v_icon from public.signups where id = v_id;
  select * into v_row from public.player_photos where signup_id = v_id;
  if not found then return json_build_object('ok', true, 'status', 'none', 'icon', v_icon); end if;
  return json_build_object('ok', true, 'status', v_row.status, 'image_data', v_row.image_data, 'icon', v_icon);
end $$;

revoke execute on function public.player_my_photo(text) from public;
grant execute on function public.player_my_photo(text) to anon, authenticated;
