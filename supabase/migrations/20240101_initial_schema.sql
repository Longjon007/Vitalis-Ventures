-- ============================================================
-- MusicForge Schema Migration: Initial Schema
-- Migration: 20240101_initial_schema
-- Creates the foundational tables: profiles, projects, ai_generations
-- and core functions/triggers required by all subsequent migrations.
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- Utility: set_updated_at trigger function
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- Profiles table (extends Supabase auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro', 'studio')),
  subscription_status text,
  subscription_expires_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  billing_updated_at timestamptz,
  ai_generations_used integer not null default 0,
  ai_generations_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_stripe_customer_id on public.profiles(stripe_customer_id);
create index if not exists idx_profiles_stripe_subscription_id on public.profiles(stripe_subscription_id);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Projects table
-- ============================================================
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  bpm integer,
  genre text,
  mood text,
  status text not null default 'draft',
  tempo integer not null default 120,
  time_signature jsonb not null default '[4, 4]',
  key text not null default 'C major',
  tracks jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_updated_at on public.projects(updated_at desc);

-- ============================================================
-- AI Generation History
-- ============================================================
create table if not exists public.ai_generations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  prompt text not null,
  model text default 'musicgen',
  duration integer not null default 15,
  audio_url text,
  stems jsonb,
  status text not null default 'pending',
  project_id uuid references public.projects(id) on delete set null,
  mode text not null default 'standard',
  provider text default 'replicate',
  input_params jsonb not null default '{}'::jsonb,
  output_url text,
  preview_url text,
  error_message text,
  credits_used integer not null default 0,
  is_favorite boolean not null default false,
  is_public boolean not null default true,
  is_featured boolean not null default false,
  play_count integer not null default 0,
  like_count integer not null default 0,
  share_count integer not null default 0,
  parent_generation_id uuid references public.ai_generations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_generations_user_id on public.ai_generations(user_id);
create index if not exists idx_ai_generations_user_id_created_at on public.ai_generations(user_id, created_at desc);
create index if not exists idx_ai_generations_project_id_created_at on public.ai_generations(project_id, created_at desc);
create index if not exists idx_ai_generations_status on public.ai_generations(status);
create index if not exists idx_ai_generations_parent_generation_id on public.ai_generations(parent_generation_id);
create index if not exists idx_ai_generations_public_created_at on public.ai_generations(is_public, created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Profiles: users can only read/update their own profile
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Projects: users can CRUD their own projects
alter table public.projects enable row level security;

drop policy if exists "Users can view own projects" on public.projects;
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own projects" on public.projects;
create policy "Users can create own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- AI Generations: users can view/create their own
alter table public.ai_generations enable row level security;

drop policy if exists "Users can view own generations" on public.ai_generations;
create policy "Users can view own generations"
  on public.ai_generations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own generations" on public.ai_generations;
create policy "Users can create own generations"
  on public.ai_generations for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Updated_at triggers
-- ============================================================
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();
