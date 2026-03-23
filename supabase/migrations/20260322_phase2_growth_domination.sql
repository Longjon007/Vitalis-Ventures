-- ============================================================
-- MusicForge Schema Migration: Phase 2 Growth Domination Systems
-- Migration: 20260322_phase2_growth_domination
-- ============================================================

alter table public.ai_generations
add column if not exists play_count integer not null default 0,
add column if not exists like_count integer not null default 0,
add column if not exists share_count integer not null default 0,
add column if not exists parent_generation_id uuid references public.ai_generations(id) on delete set null,
add column if not exists is_public boolean not null default true,
add column if not exists is_featured boolean not null default false;

update public.ai_generations
set play_count = coalesce(play_count, 0),
    like_count = coalesce(like_count, 0),
    share_count = coalesce(share_count, 0)
where play_count is null
   or like_count is null
   or share_count is null;

create index if not exists idx_ai_generations_parent_generation_id
  on public.ai_generations(parent_generation_id);

create index if not exists idx_ai_generations_public_created_at
  on public.ai_generations(is_public, created_at desc);

create index if not exists idx_ai_generations_public_engagement
  on public.ai_generations(is_public, like_count desc, share_count desc, play_count desc, created_at desc);

create table if not exists public.generation_likes (
  generation_id uuid not null references public.ai_generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (generation_id, user_id)
);

create index if not exists idx_generation_likes_user_id
  on public.generation_likes(user_id);

create index if not exists idx_generation_likes_generation_id
  on public.generation_likes(generation_id);

alter table public.generation_likes enable row level security;

drop policy if exists "Users can view own generation likes" on public.generation_likes;
create policy "Users can view own generation likes"
  on public.generation_likes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own generation likes" on public.generation_likes;
create policy "Users can insert own generation likes"
  on public.generation_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own generation likes" on public.generation_likes;
create policy "Users can delete own generation likes"
  on public.generation_likes for delete
  using (auth.uid() = user_id);

create or replace function public.toggle_generation_like(p_generation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_generation_exists boolean;
  v_already_liked boolean;
  v_like_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'not_authenticated',
      'liked', false
    );
  end if;

  select exists(
    select 1
    from public.ai_generations g
    where g.id = p_generation_id
      and g.status = 'completed'
      and coalesce(g.is_public, true) = true
  )
  into v_generation_exists;

  if not v_generation_exists then
    return jsonb_build_object(
      'success', false,
      'error', 'generation_not_found',
      'liked', false
    );
  end if;

  select exists(
    select 1
    from public.generation_likes gl
    where gl.generation_id = p_generation_id
      and gl.user_id = v_user_id
  )
  into v_already_liked;

  if v_already_liked then
    delete from public.generation_likes
    where generation_id = p_generation_id
      and user_id = v_user_id;
  else
    insert into public.generation_likes(generation_id, user_id)
    values (p_generation_id, v_user_id)
    on conflict do nothing;
  end if;

  select count(*)::integer
  into v_like_count
  from public.generation_likes
  where generation_id = p_generation_id;

  update public.ai_generations
  set like_count = coalesce(v_like_count, 0),
      updated_at = now()
  where id = p_generation_id;

  return jsonb_build_object(
    'success', true,
    'liked', not v_already_liked,
    'like_count', coalesce(v_like_count, 0)
  );
end;
$$;

grant execute on function public.toggle_generation_like(uuid) to authenticated;

create or replace function public.increment_generation_play_count(p_generation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_play_count integer;
begin
  update public.ai_generations
  set play_count = coalesce(play_count, 0) + 1,
      updated_at = now()
  where id = p_generation_id
    and status = 'completed'
    and coalesce(is_public, true) = true
  returning play_count into v_play_count;

  if v_play_count is null then
    return jsonb_build_object(
      'success', false,
      'error', 'generation_not_found'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'play_count', v_play_count
  );
end;
$$;

grant execute on function public.increment_generation_play_count(uuid) to anon, authenticated;

create or replace function public.increment_generation_share_count(p_generation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share_count integer;
begin
  update public.ai_generations
  set share_count = coalesce(share_count, 0) + 1,
      updated_at = now()
  where id = p_generation_id
    and status = 'completed'
    and coalesce(is_public, true) = true
  returning share_count into v_share_count;

  if v_share_count is null then
    return jsonb_build_object(
      'success', false,
      'error', 'generation_not_found'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'share_count', v_share_count
  );
end;
$$;

grant execute on function public.increment_generation_share_count(uuid) to anon, authenticated;

drop function if exists public.get_public_generation(uuid);
create function public.get_public_generation(p_generation_id uuid)
returns table (
  id uuid,
  prompt text,
  mode text,
  input_params jsonb,
  output_url text,
  preview_url text,
  created_at timestamptz,
  parent_generation_id uuid,
  parent_prompt text,
  parent_creator_username text,
  play_count integer,
  like_count integer,
  share_count integer,
  viewer_has_liked boolean,
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
    g.parent_generation_id,
    parent.prompt as parent_prompt,
    parent_profile.username as parent_creator_username,
    coalesce(g.play_count, 0) as play_count,
    coalesce(g.like_count, 0) as like_count,
    coalesce(g.share_count, 0) as share_count,
    (
      auth.uid() is not null
      and exists (
        select 1
        from public.generation_likes gl
        where gl.generation_id = g.id
          and gl.user_id = auth.uid()
      )
    ) as viewer_has_liked,
    p.username as creator_username,
    p.display_name as creator_display_name,
    p.bio as creator_bio,
    p.referral_code as creator_referral_code
  from public.ai_generations g
  join public.profiles p on p.id = g.user_id
  left join public.ai_generations parent on parent.id = g.parent_generation_id
  left join public.profiles parent_profile on parent_profile.id = parent.user_id
  where g.id = p_generation_id
    and g.status = 'completed'
    and coalesce(g.is_public, true) = true
  limit 1;
$$;

grant execute on function public.get_public_generation(uuid) to anon, authenticated;

drop function if exists public.list_public_generations(integer, integer, text);
create function public.list_public_generations(
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
  parent_generation_id uuid,
  play_count integer,
  like_count integer,
  share_count integer,
  viewer_has_liked boolean,
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
    g.parent_generation_id,
    coalesce(g.play_count, 0) as play_count,
    coalesce(g.like_count, 0) as like_count,
    coalesce(g.share_count, 0) as share_count,
    (
      auth.uid() is not null
      and exists (
        select 1
        from public.generation_likes gl
        where gl.generation_id = g.id
          and gl.user_id = auth.uid()
      )
    ) as viewer_has_liked,
    p.username as creator_username,
    p.display_name as creator_display_name,
    p.bio as creator_bio,
    p.referral_code as creator_referral_code
  from public.ai_generations g
  join public.profiles p on p.id = g.user_id
  where g.status = 'completed'
    and coalesce(g.is_public, true) = true
    and (
      p_username is null
      or lower(p.username) = lower(trim(p_username))
    )
  order by g.created_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.list_public_generations(integer, integer, text) to anon, authenticated;

drop function if exists public.get_public_profile(text);
create function public.get_public_profile(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  referral_code text,
  generation_count bigint,
  total_likes bigint,
  total_plays bigint
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
    count(g.id)::bigint as generation_count,
    coalesce(sum(g.like_count), 0)::bigint as total_likes,
    coalesce(sum(g.play_count), 0)::bigint as total_plays
  from public.profiles p
  left join public.ai_generations g
    on g.user_id = p.id
   and g.status = 'completed'
   and coalesce(g.is_public, true) = true
  where lower(p.username) = lower(trim(p_username))
  group by p.id, p.username, p.display_name, p.bio, p.referral_code
  limit 1;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;
