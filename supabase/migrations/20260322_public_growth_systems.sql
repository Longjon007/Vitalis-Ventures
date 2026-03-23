-- ============================================================
-- MusicForge Schema Migration: Public Growth Systems Foundation
-- Migration: 20260322_public_growth_systems
-- ============================================================

alter table public.profiles
add column if not exists username text,
add column if not exists bio text,
add column if not exists referral_code text,
add column if not exists referred_by uuid references public.profiles(id) on delete set null;

-- Normalize username values and ensure every profile has one.
update public.profiles
set username = lower(trim(username))
where username is not null;

update public.profiles
set username = regexp_replace(username, '[^a-z0-9_]+', '_', 'g')
where username is not null;

update public.profiles
set username = trim(both '_' from username)
where username is not null;

update public.profiles
set username = null
where coalesce(username, '') = '';

update public.profiles
set username = 'creator_' || substr(replace(id::text, '-', ''), 1, 10)
where username is null;

with duplicate_usernames as (
  select
    id,
    lower(username) as normalized_username,
    row_number() over (partition by lower(username) order by id) as rn
  from public.profiles
)
update public.profiles p
set username = d.normalized_username || '_' || d.rn::text
from duplicate_usernames d
where p.id = d.id
  and d.rn > 1;

-- Normalize referral codes and ensure every profile has one.
update public.profiles
set referral_code = lower(trim(referral_code))
where referral_code is not null;

update public.profiles
set referral_code = regexp_replace(referral_code, '[^a-z0-9]+', '', 'g')
where referral_code is not null;

update public.profiles
set referral_code = null
where coalesce(referral_code, '') = '';

update public.profiles
set referral_code = substr(md5(id::text || '-musicforge-ref'), 1, 10)
where referral_code is null;

with duplicate_referrals as (
  select
    id,
    lower(referral_code) as normalized_code,
    row_number() over (partition by lower(referral_code) order by id) as rn
  from public.profiles
)
update public.profiles p
set referral_code = substr(d.normalized_code || d.rn::text, 1, 16)
from duplicate_referrals d
where p.id = d.id
  and d.rn > 1;

alter table public.profiles
alter column username set not null,
alter column referral_code set not null;

create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username));

create unique index if not exists idx_profiles_referral_code_unique
  on public.profiles (lower(referral_code));

create index if not exists idx_profiles_referred_by
  on public.profiles (referred_by);

-- Apply referral relationship for current authenticated user.
create or replace function public.apply_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_referrer_id uuid;
  v_updated_count integer := 0;
  v_normalized_code text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  v_normalized_code := lower(trim(coalesce(p_code, '')));
  if v_normalized_code = '' then
    return jsonb_build_object('success', false, 'error', 'invalid_code');
  end if;

  select id
  into v_referrer_id
  from public.profiles
  where lower(referral_code) = v_normalized_code
  limit 1;

  if v_referrer_id is null then
    return jsonb_build_object('success', false, 'error', 'referrer_not_found');
  end if;

  if v_referrer_id = v_user_id then
    return jsonb_build_object('success', false, 'error', 'self_referral');
  end if;

  update public.profiles
  set referred_by = v_referrer_id,
      updated_at = now()
  where id = v_user_id
    and referred_by is null;

  get diagnostics v_updated_count = row_count;

  return jsonb_build_object(
    'success', v_updated_count > 0,
    'already_referred', v_updated_count = 0,
    'referrer_id', v_referrer_id
  );
end;
$$;

grant execute on function public.apply_referral_code(text) to authenticated;

-- Public generation endpoint (completed generations only).
create or replace function public.get_public_generation(p_generation_id uuid)
returns table (
  id uuid,
  prompt text,
  mode text,
  input_params jsonb,
  output_url text,
  preview_url text,
  created_at timestamptz,
  creator_username text,
  creator_display_name text,
  creator_bio text,
  creator_referral_code text
)
language sql
security definer
set search_path = public
as $$
  select
    g.id,
    g.prompt,
    g.mode,
    g.input_params,
    g.output_url,
    g.preview_url,
    g.created_at,
    p.username as creator_username,
    p.display_name as creator_display_name,
    p.bio as creator_bio,
    p.referral_code as creator_referral_code
  from public.ai_generations g
  join public.profiles p on p.id = g.user_id
  where g.id = p_generation_id
    and g.status = 'completed'
  limit 1;
$$;

grant execute on function public.get_public_generation(uuid) to anon, authenticated;

-- Public explore/profile listing (completed generations only).
create or replace function public.list_public_generations(
  p_limit integer default 24,
  p_offset integer default 0,
  p_username text default null
)
returns table (
  id uuid,
  prompt text,
  mode text,
  input_params jsonb,
  output_url text,
  preview_url text,
  created_at timestamptz,
  creator_username text,
  creator_display_name text,
  creator_bio text,
  creator_referral_code text
)
language sql
security definer
set search_path = public
as $$
  select
    g.id,
    g.prompt,
    g.mode,
    g.input_params,
    g.output_url,
    g.preview_url,
    g.created_at,
    p.username as creator_username,
    p.display_name as creator_display_name,
    p.bio as creator_bio,
    p.referral_code as creator_referral_code
  from public.ai_generations g
  join public.profiles p on p.id = g.user_id
  where g.status = 'completed'
    and (
      p_username is null
      or lower(p.username) = lower(trim(p_username))
    )
  order by g.created_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.list_public_generations(integer, integer, text) to anon, authenticated;

-- Public creator profile summary.
create or replace function public.get_public_profile(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  referral_code text,
  generation_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.referral_code,
    count(g.id)::bigint as generation_count
  from public.profiles p
  left join public.ai_generations g
    on g.user_id = p.id
   and g.status = 'completed'
  where lower(p.username) = lower(trim(p_username))
  group by p.id, p.username, p.display_name, p.bio, p.referral_code
  limit 1;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;
