-- ============================================================
-- MusicForge Schema Migration: Phase 3 Platform Scale Systems
-- Migration: 20260322_phase3_platform_scale
-- ============================================================

alter table public.profiles
add column if not exists total_sales bigint not null default 0,
add column if not exists total_revenue bigint not null default 0,
add column if not exists creator_score integer not null default 0;

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.ai_generations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  price_cents integer not null check (price_cents >= 99 and price_cents <= 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_marketplace_generation_active_unique
  on public.marketplace_listings(generation_id)
  where is_active = true;

create index if not exists idx_marketplace_user_id
  on public.marketplace_listings(user_id);

create index if not exists idx_marketplace_active_created_at
  on public.marketplace_listings(is_active, created_at desc);

alter table public.marketplace_listings enable row level security;

drop policy if exists "Users can view marketplace listings" on public.marketplace_listings;
create policy "Users can view marketplace listings"
  on public.marketplace_listings for select
  using (is_active = true or auth.uid() = user_id);

drop policy if exists "Users can insert own marketplace listings" on public.marketplace_listings;
create policy "Users can insert own marketplace listings"
  on public.marketplace_listings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own marketplace listings" on public.marketplace_listings;
create policy "Users can update own marketplace listings"
  on public.marketplace_listings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own marketplace listings" on public.marketplace_listings;
create policy "Users can delete own marketplace listings"
  on public.marketplace_listings for delete
  using (auth.uid() = user_id);

drop trigger if exists set_marketplace_listings_updated_at on public.marketplace_listings;
create trigger set_marketplace_listings_updated_at
  before update on public.marketplace_listings
  for each row execute function public.set_updated_at();

create or replace function public.create_marketplace_listing(
  p_generation_id uuid,
  p_price_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_generation_owner uuid;
  v_generation_status text;
  v_listing_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  if p_price_cents is null or p_price_cents < 99 or p_price_cents > 100000 then
    return jsonb_build_object('success', false, 'error', 'invalid_price');
  end if;

  select g.user_id, g.status
  into v_generation_owner, v_generation_status
  from public.ai_generations g
  where g.id = p_generation_id
  limit 1;

  if v_generation_owner is null then
    return jsonb_build_object('success', false, 'error', 'generation_not_found');
  end if;

  if v_generation_owner <> v_user_id then
    return jsonb_build_object('success', false, 'error', 'not_owner');
  end if;

  if v_generation_status <> 'completed' then
    return jsonb_build_object('success', false, 'error', 'generation_not_completed');
  end if;

  select id
  into v_listing_id
  from public.marketplace_listings
  where generation_id = p_generation_id
    and user_id = v_user_id
  order by created_at desc
  limit 1;

  if v_listing_id is null then
    insert into public.marketplace_listings(generation_id, user_id, price_cents, is_active)
    values (p_generation_id, v_user_id, p_price_cents, true)
    returning id into v_listing_id;
  else
    update public.marketplace_listings
    set price_cents = p_price_cents,
        is_active = true,
        updated_at = now()
    where id = v_listing_id;
  end if;

  update public.ai_generations
  set is_public = true,
      updated_at = now()
  where id = p_generation_id;

  return jsonb_build_object(
    'success', true,
    'listing_id', v_listing_id,
    'price_cents', p_price_cents
  );
end;
$$;

grant execute on function public.create_marketplace_listing(uuid, integer) to authenticated;

drop function if exists public.list_marketplace_listings(integer, integer);
create or replace function public.list_marketplace_listings(
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  generation_id uuid,
  user_id uuid,
  price_cents integer,
  is_active boolean,
  created_at timestamptz,
  prompt text,
  mode text,
  output_url text,
  preview_url text,
  play_count integer,
  like_count integer,
  share_count integer,
  creator_username text,
  creator_display_name text,
  creator_score integer
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.generation_id,
    l.user_id,
    l.price_cents,
    l.is_active,
    l.created_at,
    g.prompt,
    g.mode,
    g.output_url,
    g.preview_url,
    coalesce(g.play_count, 0) as play_count,
    coalesce(g.like_count, 0) as like_count,
    coalesce(g.share_count, 0) as share_count,
    p.username as creator_username,
    p.display_name as creator_display_name,
    (
      coalesce(g.like_count, 0) * 3
      + coalesce(g.play_count, 0)
      + coalesce(p.total_sales, 0)::integer * 10
    ) as creator_score
  from public.marketplace_listings l
  join public.ai_generations g on g.id = l.generation_id
  join public.profiles p on p.id = l.user_id
  where l.is_active = true
    and g.status = 'completed'
    and coalesce(g.is_public, true) = true
  order by l.created_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.list_marketplace_listings(integer, integer) to anon, authenticated;

create or replace function public.get_creator_marketplace_summary()
returns table (
  listing_count bigint,
  active_listing_count bigint,
  total_sales bigint,
  total_revenue bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_total_sales bigint := 0;
  v_total_revenue bigint := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return query
    select 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  select
    coalesce(p.total_sales, 0),
    coalesce(p.total_revenue, 0)
  into v_total_sales, v_total_revenue
  from public.profiles p
  where p.id = v_user_id;

  return query
  select
    count(*)::bigint as listing_count,
    count(*) filter (where l.is_active)::bigint as active_listing_count,
    v_total_sales as total_sales,
    v_total_revenue as total_revenue
  from public.marketplace_listings l
  where l.user_id = v_user_id;
end;
$$;

grant execute on function public.get_creator_marketplace_summary() to authenticated;

create table if not exists public.project_collaborators (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  role text not null default 'editor' check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_project_collaborators_user_id
  on public.project_collaborators(user_id);

create table if not exists public.project_collaboration_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_collaboration_invites_project_id
  on public.project_collaboration_invites(project_id);

alter table public.project_collaborators enable row level security;
alter table public.project_collaboration_invites enable row level security;

drop policy if exists "Users can view project collaborators they belong to" on public.project_collaborators;
create policy "Users can view project collaborators they belong to"
  on public.project_collaborators for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Project owners can add collaborators" on public.project_collaborators;
create policy "Project owners can add collaborators"
  on public.project_collaborators for insert
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Project owners can update collaborators" on public.project_collaborators;
create policy "Project owners can update collaborators"
  on public.project_collaborators for update
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Project owners or collaborator can remove collaborator" on public.project_collaborators;
create policy "Project owners or collaborator can remove collaborator"
  on public.project_collaborators for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can view own project invites" on public.project_collaboration_invites;
create policy "Users can view own project invites"
  on public.project_collaboration_invites for select
  using (
    invited_by = auth.uid()
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Project owners can create invites" on public.project_collaboration_invites;
create policy "Project owners can create invites"
  on public.project_collaboration_invites for insert
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Project owners can update invites" on public.project_collaboration_invites;
create policy "Project owners can update invites"
  on public.project_collaboration_invites for update
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Project owners can delete invites" on public.project_collaboration_invites;
create policy "Project owners can delete invites"
  on public.project_collaboration_invites for delete
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

create or replace function public.list_accessible_projects()
returns table (
  id uuid,
  user_id uuid,
  title text,
  description text,
  bpm integer,
  genre text,
  mood text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  is_owner boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.user_id,
    p.title,
    p.description,
    p.bpm,
    p.genre,
    p.mood,
    p.status,
    p.created_at,
    p.updated_at,
    (p.user_id = auth.uid()) as is_owner
  from public.projects p
  where auth.uid() is not null
    and (
      p.user_id = auth.uid()
      or exists (
        select 1
        from public.project_collaborators c
        where c.project_id = p.id
          and c.user_id = auth.uid()
      )
    )
  order by p.updated_at desc;
$$;

grant execute on function public.list_accessible_projects() to authenticated;

create or replace function public.get_project_collaborators(p_project_id uuid)
returns table (
  user_id uuid,
  display_name text,
  username text,
  role text,
  is_owner boolean
)
language sql
security definer
set search_path = public
as $$
  with access_check as (
    select 1
    from public.projects p
    where p.id = p_project_id
      and (
        p.user_id = auth.uid()
        or exists (
          select 1
          from public.project_collaborators c
          where c.project_id = p.id
            and c.user_id = auth.uid()
        )
      )
    limit 1
  )
  select
    p.user_id as user_id,
    owner_profile.display_name,
    owner_profile.username,
    'owner'::text as role,
    true as is_owner
  from public.projects p
  join public.profiles owner_profile on owner_profile.id = p.user_id
  where p.id = p_project_id
    and exists (select 1 from access_check)

  union all

  select
    c.user_id,
    collaborator_profile.display_name,
    collaborator_profile.username,
    c.role,
    false as is_owner
  from public.project_collaborators c
  join public.profiles collaborator_profile on collaborator_profile.id = c.user_id
  where c.project_id = p_project_id
    and exists (select 1 from access_check);
$$;

grant execute on function public.get_project_collaborators(uuid) to authenticated;

create or replace function public.create_project_invite(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_has_access boolean;
  v_invite_code text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select exists(
    select 1
    from public.projects p
    where p.id = p_project_id
      and (
        p.user_id = v_user_id
        or exists (
          select 1
          from public.project_collaborators c
          where c.project_id = p.id
            and c.user_id = v_user_id
            and c.role = 'editor'
        )
      )
  )
  into v_has_access;

  if not v_has_access then
    return jsonb_build_object('success', false, 'error', 'not_authorized');
  end if;

  v_invite_code := upper(substr(md5(random()::text || clock_timestamp()::text || p_project_id::text), 1, 10));

  insert into public.project_collaboration_invites(project_id, invited_by, invite_code)
  values (p_project_id, v_user_id, v_invite_code);

  return jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'invite_code', v_invite_code
  );
end;
$$;

grant execute on function public.create_project_invite(uuid) to authenticated;

create or replace function public.join_project_invite(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_project_id uuid;
  v_invited_by uuid;
  v_normalized_code text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  v_normalized_code := upper(trim(coalesce(p_invite_code, '')));
  if v_normalized_code = '' then
    return jsonb_build_object('success', false, 'error', 'invalid_code');
  end if;

  select i.project_id, i.invited_by
  into v_project_id, v_invited_by
  from public.project_collaboration_invites i
  where upper(i.invite_code) = v_normalized_code
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;

  if v_project_id is null then
    return jsonb_build_object('success', false, 'error', 'invite_not_found');
  end if;

  insert into public.project_collaborators(project_id, user_id, invited_by, role)
  values (v_project_id, v_user_id, v_invited_by, 'editor')
  on conflict (project_id, user_id) do nothing;

  update public.project_collaboration_invites
  set used_count = used_count + 1,
      last_used_at = now()
  where upper(invite_code) = v_normalized_code;

  return jsonb_build_object(
    'success', true,
    'project_id', v_project_id
  );
end;
$$;

grant execute on function public.join_project_invite(text) to authenticated;

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
  active_listing_id uuid,
  active_listing_price_cents integer,
  viewer_has_liked boolean,
  viewer_is_owner boolean,
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
    listing.id as active_listing_id,
    listing.price_cents as active_listing_price_cents,
    (
      auth.uid() is not null
      and exists (
        select 1
        from public.generation_likes gl
        where gl.generation_id = g.id
          and gl.user_id = auth.uid()
      )
    ) as viewer_has_liked,
    (auth.uid() is not null and g.user_id = auth.uid()) as viewer_is_owner,
    p.username as creator_username,
    p.display_name as creator_display_name,
    p.bio as creator_bio,
    p.referral_code as creator_referral_code
  from public.ai_generations g
  join public.profiles p on p.id = g.user_id
  left join public.ai_generations parent on parent.id = g.parent_generation_id
  left join public.profiles parent_profile on parent_profile.id = parent.user_id
  left join public.marketplace_listings listing
    on listing.generation_id = g.id
   and listing.is_active = true
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
  creator_referral_code text,
  creator_score integer
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
    p.referral_code as creator_referral_code,
    (
      coalesce(g.like_count, 0) * 3
      + coalesce(g.play_count, 0)
      + coalesce(p.total_sales, 0)::integer * 10
    ) as creator_score
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
  total_plays bigint,
  creator_score integer,
  active_listing_count bigint
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
    coalesce(sum(g.play_count), 0)::bigint as total_plays,
    (
      coalesce(sum(g.like_count), 0)::integer * 3
      + coalesce(sum(g.play_count), 0)::integer
      + coalesce(p.total_sales, 0)::integer * 10
    ) as creator_score,
    count(l.id) filter (where l.is_active)::bigint as active_listing_count
  from public.profiles p
  left join public.ai_generations g
    on g.user_id = p.id
   and g.status = 'completed'
   and coalesce(g.is_public, true) = true
  left join public.marketplace_listings l
    on l.user_id = p.id
  where lower(p.username) = lower(trim(p_username))
  group by p.id, p.username, p.display_name, p.bio, p.referral_code, p.total_sales
  limit 1;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;
