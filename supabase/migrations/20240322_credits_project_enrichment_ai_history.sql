-- ============================================================
-- MusicForge Schema Migration: Credits, Project Enrichment, AI History
-- Migration: 20240322_credits_project_enrichment_ai_history
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- Enrich projects table
-- ============================================================
alter table public.projects
add column if not exists description text,
add column if not exists bpm integer,
add column if not exists genre text,
add column if not exists mood text,
add column if not exists status text not null default 'draft';

-- Update existing projects to have status if null
update public.projects set status = 'draft' where status is null;

-- ============================================================
-- Enrich ai_generations table
-- ============================================================
alter table public.ai_generations
add column if not exists project_id uuid references public.projects(id) on delete set null,
add column if not exists mode text not null default 'standard',
add column if not exists provider text default 'replicate',
add column if not exists model text,
add column if not exists input_params jsonb not null default '{}'::jsonb,
add column if not exists output_url text,
add column if not exists preview_url text,
add column if not exists error_message text,
add column if not exists credits_used integer not null default 0,
add column if not exists is_favorite boolean not null default false,
add column if not exists updated_at timestamptz not null default now();

-- Update existing ai_generations to have mode if null
update public.ai_generations set mode = 'standard' where mode is null;

-- ============================================================
-- Create credit_wallets table
-- ============================================================
create table if not exists public.credit_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  monthly_credits integer not null default 50,
  bonus_credits integer not null default 0,
  used_credits integer not null default 0,
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Create credit_events table
-- ============================================================
create table if not exists public.credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Create project_assets table
-- ============================================================
create table if not exists public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null,
  file_url text not null,
  filename text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Add indexes
-- ============================================================
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_ai_generations_user_id_created_at on public.ai_generations(user_id, created_at desc);
create index if not exists idx_ai_generations_project_id_created_at on public.ai_generations(project_id, created_at desc);
create index if not exists idx_ai_generations_status on public.ai_generations(status);
create index if not exists idx_credit_events_user_id_created_at on public.credit_events(user_id, created_at desc);
create index if not exists idx_project_assets_project_id_created_at on public.project_assets(project_id, created_at desc);

-- ============================================================
-- Enable RLS
-- ============================================================
alter table public.credit_wallets enable row level security;
alter table public.credit_events enable row level security;
alter table public.project_assets enable row level security;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Credit Wallets: users manage own wallet
create policy if not exists "Users can view own credit wallet"
  on public.credit_wallets for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert own credit wallet"
  on public.credit_wallets for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update own credit wallet"
  on public.credit_wallets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Credit Events: users view/insert own events
create policy if not exists "Users can view own credit events"
  on public.credit_events for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert own credit events"
  on public.credit_events for insert
  with check (auth.uid() = user_id);

-- Project Assets: users manage own assets
create policy if not exists "Users can view own project assets"
  on public.project_assets for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert own project assets"
  on public.project_assets for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update own project assets"
  on public.project_assets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "Users can delete own project assets"
  on public.project_assets for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Updated_at triggers
-- ============================================================
create trigger if not exists set_credit_wallets_updated_at
  before update on public.credit_wallets
  for each row execute function public.set_updated_at();

create trigger if not exists set_ai_generations_updated_at
  before update on public.ai_generations
  for each row execute function public.set_updated_at();

-- ============================================================
-- consume_credits function
-- ============================================================
create or replace function public.consume_credits(
  p_amount integer,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_wallet_id uuid;
  v_monthly_credits integer;
  v_bonus_credits integer;
  v_used_credits integer;
  v_remaining integer;
begin
  -- Get authenticated user
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Create wallet if missing
  insert into public.credit_wallets (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  -- Get wallet data
  select id, monthly_credits, bonus_credits, used_credits
  into v_wallet_id, v_monthly_credits, v_bonus_credits, v_used_credits
  from public.credit_wallets
  where user_id = v_user_id;

  -- Calculate remaining credits
  v_remaining := v_monthly_credits + v_bonus_credits - v_used_credits;

  -- Check if sufficient credits
  if v_remaining < p_amount then
    return jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'remaining', v_remaining,
      'requested', p_amount
    );
  end if;

  -- Update used credits
  update public.credit_wallets
  set used_credits = used_credits + p_amount,
      updated_at = now()
  where id = v_wallet_id;

  -- Insert credit event
  insert into public.credit_events (user_id, delta, reason, metadata)
  values (v_user_id, -p_amount, p_reason, p_metadata);

  -- Return success
  return jsonb_build_object(
    'success', true,
    'used', p_amount,
    'remaining', v_remaining - p_amount
  );
end;
$$;

-- Grant execute permission
grant execute on function public.consume_credits(integer, text, jsonb) to authenticated;

-- ============================================================
-- New user credit wallet trigger
-- ============================================================
create or replace function public.handle_new_user_credit_wallet()
returns trigger as $$
begin
  insert into public.credit_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_credit_wallet on auth.users;
create trigger on_auth_user_created_credit_wallet
  after insert on auth.users
  for each row execute function public.handle_new_user_credit_wallet();