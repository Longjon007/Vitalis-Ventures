-- ============================================================
-- MusicForge Schema Migration: Phase 4 Category Domination
-- Migration: 20260322_phase4_category_domination
-- ============================================================

create extension if not exists pgcrypto;

alter table public.profiles
add column if not exists stripe_account_id text,
add column if not exists payouts_enabled boolean not null default false;

create unique index if not exists idx_profiles_stripe_account_id
  on public.profiles(stripe_account_id)
  where stripe_account_id is not null;

alter table public.marketplace_listings
add column if not exists license_type text not null default 'personal',
add column if not exists usage_rights text not null default 'Personal use license.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'marketplace_listings_license_type_check'
  ) then
    alter table public.marketplace_listings
    add constraint marketplace_listings_license_type_check
    check (license_type in ('personal', 'commercial'));
  end if;
end
$$;

create table if not exists public.marketplace_sales (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  generation_id uuid not null references public.ai_generations(id) on delete cascade,
  seller_user_id uuid not null references public.profiles(id) on delete cascade,
  buyer_user_id uuid references public.profiles(id) on delete set null,
  stripe_payment_intent_id text not null,
  gross_amount_cents integer not null check (gross_amount_cents > 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  creator_share_cents integer not null check (creator_share_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'completed', 'refunded', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists idx_marketplace_sales_payment_intent
  on public.marketplace_sales(stripe_payment_intent_id);

create index if not exists idx_marketplace_sales_seller_status
  on public.marketplace_sales(seller_user_id, status, created_at desc);

create index if not exists idx_marketplace_sales_buyer_created
  on public.marketplace_sales(buyer_user_id, created_at desc);

alter table public.marketplace_sales enable row level security;

drop policy if exists "Users can view own marketplace sales" on public.marketplace_sales;
create policy "Users can view own marketplace sales"
  on public.marketplace_sales for select
  using (auth.uid() = seller_user_id or auth.uid() = buyer_user_id);

drop policy if exists "Service role can manage marketplace sales" on public.marketplace_sales;
create policy "Service role can manage marketplace sales"
  on public.marketplace_sales for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  label text,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_user_id
  on public.api_keys(user_id, created_at desc);

alter table public.api_keys enable row level security;

drop policy if exists "Users can view own api keys" on public.api_keys;
create policy "Users can view own api keys"
  on public.api_keys for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own api keys" on public.api_keys;
create policy "Users can insert own api keys"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own api keys" on public.api_keys;
create policy "Users can update own api keys"
  on public.api_keys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own api keys" on public.api_keys;
create policy "Users can delete own api keys"
  on public.api_keys for delete
  using (auth.uid() = user_id);

create table if not exists public.user_style_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_genres text[] not null default '{}',
  bpm_min integer,
  bpm_max integer,
  prompt_patterns jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_style_profiles enable row level security;

drop policy if exists "Users can view own style profile" on public.user_style_profiles;
create policy "Users can view own style profile"
  on public.user_style_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own style profile" on public.user_style_profiles;
create policy "Users can insert own style profile"
  on public.user_style_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own style profile" on public.user_style_profiles;
create policy "Users can update own style profile"
  on public.user_style_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_user_style_profiles_updated_at on public.user_style_profiles;
create trigger set_user_style_profiles_updated_at
  before update on public.user_style_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  generation_complete boolean not null default true,
  track_liked boolean not null default true,
  track_sold boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Users can view own notification preferences" on public.notification_preferences;
create policy "Users can view own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('generation_complete', 'track_liked', 'track_sold')),
  generation_id uuid references public.ai_generations(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notification_events_user_created
  on public.notification_events(user_id, created_at desc);

alter table public.notification_events enable row level security;

drop policy if exists "Users can view own notification events" on public.notification_events;
create policy "Users can view own notification events"
  on public.notification_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notification events" on public.notification_events;
create policy "Users can update own notification events"
  on public.notification_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Service role can insert notification events" on public.notification_events;
create policy "Service role can insert notification events"
  on public.notification_events for insert
  with check (auth.role() = 'service_role');

create table if not exists public.generation_reports (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.ai_generations(id) on delete cascade,
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_generation_reports_generation
  on public.generation_reports(generation_id, created_at desc);

alter table public.generation_reports enable row level security;

drop policy if exists "Users can create generation reports" on public.generation_reports;
create policy "Users can create generation reports"
  on public.generation_reports for insert
  with check (auth.uid() = reporter_user_id);

drop policy if exists "Users can view own generation reports" on public.generation_reports;
create policy "Users can view own generation reports"
  on public.generation_reports for select
  using (auth.uid() = reporter_user_id or auth.role() = 'service_role');

create or replace function public.create_api_key(p_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_raw_key text;
  v_hash text;
  v_prefix text;
  v_key_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  v_raw_key := 'mfk_live_' || encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_raw_key, 'sha256'), 'hex');
  v_prefix := substring(v_raw_key from 1 for 14);

  insert into public.api_keys(user_id, key_hash, key_prefix, label)
  values (v_user_id, v_hash, v_prefix, nullif(trim(coalesce(p_label, '')), ''))
  returning id into v_key_id;

  return jsonb_build_object(
    'success', true,
    'id', v_key_id,
    'key', v_raw_key,
    'prefix', v_prefix
  );
end;
$$;

grant execute on function public.create_api_key(text) to authenticated;

create or replace function public.refresh_user_style_profile(
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_genres text[];
  v_bpm_min integer;
  v_bpm_max integer;
  v_prompt_patterns jsonb;
begin
  v_user_id := coalesce(p_user_id, auth.uid());
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  with scoped as (
    select g.prompt, g.input_params
    from public.ai_generations g
    where g.user_id = v_user_id
      and g.status = 'completed'
    order by g.created_at desc
    limit 100
  ), genre_counts as (
    select lower(trim(input_params ->> 'genre')) as genre, count(*) as count
    from scoped
    where nullif(trim(input_params ->> 'genre'), '') is not null
    group by lower(trim(input_params ->> 'genre'))
    order by count desc, genre asc
    limit 5
  )
  select
    coalesce(array_agg(genre), '{}')
  into v_genres
  from genre_counts;

  with scoped as (
    select (input_params ->> 'bpm')::integer as bpm
    from public.ai_generations g
    where g.user_id = v_user_id
      and g.status = 'completed'
      and nullif(trim(g.input_params ->> 'bpm'), '') is not null
      and (g.input_params ->> 'bpm') ~ '^[0-9]+$'
    order by g.created_at desc
    limit 100
  )
  select min(bpm), max(bpm)
  into v_bpm_min, v_bpm_max
  from scoped;

  with scoped as (
    select prompt
    from public.ai_generations g
    where g.user_id = v_user_id
      and g.status = 'completed'
      and nullif(trim(g.prompt), '') is not null
    order by g.created_at desc
    limit 50
  )
  select jsonb_build_object(
    'avg_prompt_length', coalesce(round(avg(length(prompt))), 0),
    'sample_count', count(*)
  )
  into v_prompt_patterns
  from scoped;

  insert into public.user_style_profiles(user_id, preferred_genres, bpm_min, bpm_max, prompt_patterns, updated_at)
  values (
    v_user_id,
    coalesce(v_genres, '{}'),
    v_bpm_min,
    v_bpm_max,
    coalesce(v_prompt_patterns, '{}'::jsonb),
    now()
  )
  on conflict (user_id)
  do update
    set preferred_genres = excluded.preferred_genres,
        bpm_min = excluded.bpm_min,
        bpm_max = excluded.bpm_max,
        prompt_patterns = excluded.prompt_patterns,
        updated_at = now();

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'preferred_genres', coalesce(v_genres, '{}'),
    'bpm_min', v_bpm_min,
    'bpm_max', v_bpm_max
  );
end;
$$;

grant execute on function public.refresh_user_style_profile(uuid) to authenticated;

create or replace function public.calculate_marketplace_split(
  p_gross_amount_cents integer,
  p_creator_share_bps integer default 8000
)
returns table (
  platform_fee_cents integer,
  creator_share_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_bps integer;
  v_creator_share integer;
  v_platform_fee integer;
begin
  if p_gross_amount_cents is null or p_gross_amount_cents <= 0 then
    return query select 0::integer, 0::integer;
    return;
  end if;

  v_creator_bps := least(greatest(coalesce(p_creator_share_bps, 8000), 1000), 9500);
  v_creator_share := floor((p_gross_amount_cents::numeric * v_creator_bps::numeric) / 10000)::integer;
  v_platform_fee := p_gross_amount_cents - v_creator_share;

  return query select v_platform_fee, v_creator_share;
end;
$$;

grant execute on function public.calculate_marketplace_split(integer, integer) to anon, authenticated;

create or replace function public.record_marketplace_sale(
  p_listing_id uuid,
  p_stripe_payment_intent_id text,
  p_buyer_user_id uuid default auth.uid(),
  p_status text default 'completed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_platform_fee integer;
  v_creator_share integer;
  v_sale_id uuid;
  v_status text;
begin
  select
    l.id,
    l.generation_id,
    l.user_id,
    l.price_cents
  into v_listing
  from public.marketplace_listings l
  where l.id = p_listing_id
  limit 1;

  if v_listing.id is null then
    return jsonb_build_object('success', false, 'error', 'listing_not_found');
  end if;

  if nullif(trim(coalesce(p_stripe_payment_intent_id, '')), '') is null then
    return jsonb_build_object('success', false, 'error', 'missing_payment_intent');
  end if;

  select platform_fee_cents, creator_share_cents
  into v_platform_fee, v_creator_share
  from public.calculate_marketplace_split(v_listing.price_cents, 8000)
  limit 1;

  v_status := lower(trim(coalesce(p_status, 'completed')));
  if v_status not in ('pending', 'completed', 'refunded', 'failed') then
    v_status := 'completed';
  end if;

  insert into public.marketplace_sales(
    listing_id,
    generation_id,
    seller_user_id,
    buyer_user_id,
    stripe_payment_intent_id,
    gross_amount_cents,
    platform_fee_cents,
    creator_share_cents,
    status,
    completed_at
  )
  values (
    v_listing.id,
    v_listing.generation_id,
    v_listing.user_id,
    p_buyer_user_id,
    trim(p_stripe_payment_intent_id),
    v_listing.price_cents,
    coalesce(v_platform_fee, 0),
    coalesce(v_creator_share, 0),
    v_status,
    case when v_status = 'completed' then now() else null end
  )
  on conflict (stripe_payment_intent_id)
  do update set
    status = excluded.status,
    completed_at = excluded.completed_at
  returning id into v_sale_id;

  if v_status = 'completed' then
    update public.profiles
    set
      total_sales = coalesce(total_sales, 0) + 1,
      total_revenue = coalesce(total_revenue, 0) + coalesce(v_creator_share, 0),
      updated_at = now()
    where id = v_listing.user_id;

    insert into public.notification_events(user_id, event_type, generation_id, payload)
    values (
      v_listing.user_id,
      'track_sold',
      v_listing.generation_id,
      jsonb_build_object(
        'listing_id', v_listing.id,
        'sale_id', v_sale_id,
        'gross_amount_cents', v_listing.price_cents,
        'creator_share_cents', coalesce(v_creator_share, 0)
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'platform_fee_cents', coalesce(v_platform_fee, 0),
    'creator_share_cents', coalesce(v_creator_share, 0)
  );
end;
$$;

grant execute on function public.record_marketplace_sale(uuid, text, uuid, text) to authenticated, anon;

create or replace function public.touch_api_key_use(p_api_key_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.api_keys
  set last_used_at = now()
  where id = p_api_key_id;
end;
$$;

grant execute on function public.touch_api_key_use(uuid) to anon, authenticated;

create or replace function public.resolve_api_key_owner(p_key_hash text)
returns table (
  api_key_id uuid,
  user_id uuid,
  is_active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    k.id,
    k.user_id,
    k.is_active
  from public.api_keys k
  where k.key_hash = p_key_hash
  limit 1;
$$;

grant execute on function public.resolve_api_key_owner(text) to anon, authenticated;

drop function if exists public.create_marketplace_listing(uuid, integer);
create or replace function public.create_marketplace_listing(
  p_generation_id uuid,
  p_price_cents integer,
  p_license_type text default 'personal',
  p_usage_rights text default null
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
  v_license_type text;
  v_usage_rights text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  if p_price_cents is null or p_price_cents < 99 or p_price_cents > 100000 then
    return jsonb_build_object('success', false, 'error', 'invalid_price');
  end if;

  v_license_type := lower(trim(coalesce(p_license_type, 'personal')));
  if v_license_type not in ('personal', 'commercial') then
    return jsonb_build_object('success', false, 'error', 'invalid_license_type');
  end if;

  v_usage_rights := nullif(trim(coalesce(p_usage_rights, '')), '');
  if v_usage_rights is null then
    if v_license_type = 'commercial' then
      v_usage_rights := 'Commercial use license. Attribution optional unless otherwise stated by creator.';
    else
      v_usage_rights := 'Personal use license. Contact creator for commercial rights.';
    end if;
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
    insert into public.marketplace_listings(
      generation_id,
      user_id,
      price_cents,
      is_active,
      license_type,
      usage_rights
    )
    values (
      p_generation_id,
      v_user_id,
      p_price_cents,
      true,
      v_license_type,
      left(v_usage_rights, 1000)
    )
    returning id into v_listing_id;
  else
    update public.marketplace_listings
    set
      price_cents = p_price_cents,
      is_active = true,
      license_type = v_license_type,
      usage_rights = left(v_usage_rights, 1000),
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
    'price_cents', p_price_cents,
    'license_type', v_license_type,
    'usage_rights', left(v_usage_rights, 1000)
  );
end;
$$;

grant execute on function public.create_marketplace_listing(uuid, integer, text, text) to authenticated;

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
  license_type text,
  usage_rights text,
  creator_share_bps integer,
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
    l.license_type,
    l.usage_rights,
    8000 as creator_share_bps,
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
  active_listing_license_type text,
  active_listing_usage_rights text,
  active_listing_creator_share_bps integer,
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
    listing.license_type as active_listing_license_type,
    listing.usage_rights as active_listing_usage_rights,
    8000 as active_listing_creator_share_bps,
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

create or replace function public.on_generation_completed_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and coalesce(old.status, '') <> 'completed' then
    insert into public.notification_events(user_id, event_type, generation_id, payload)
    values (
      new.user_id,
      'generation_complete',
      new.id,
      jsonb_build_object('generation_id', new.id, 'mode', new.mode)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_generation_completed_notify on public.ai_generations;
create trigger trg_generation_completed_notify
  after update on public.ai_generations
  for each row execute function public.on_generation_completed_notify();

create or replace function public.on_generation_liked_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select g.user_id
  into v_owner_id
  from public.ai_generations g
  where g.id = new.generation_id
  limit 1;

  if v_owner_id is not null and v_owner_id <> new.user_id then
    insert into public.notification_events(user_id, event_type, generation_id, payload)
    values (
      v_owner_id,
      'track_liked',
      new.generation_id,
      jsonb_build_object('generation_id', new.generation_id, 'liked_by', new.user_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_generation_liked_notify on public.generation_likes;
create trigger trg_generation_liked_notify
  after insert on public.generation_likes
  for each row execute function public.on_generation_liked_notify();

