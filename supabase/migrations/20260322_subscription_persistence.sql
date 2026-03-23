-- ============================================================
-- MusicForge Schema Migration: Stripe Subscription Persistence
-- Migration: 20260322_subscription_persistence
-- ============================================================

alter table public.profiles
add column if not exists subscription_tier text not null default 'free',
add column if not exists subscription_status text,
add column if not exists subscription_expires_at timestamptz,
add column if not exists stripe_customer_id text,
add column if not exists stripe_subscription_id text,
add column if not exists billing_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_subscription_tier_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_subscription_tier_check
      check (subscription_tier in ('free', 'pro', 'studio'));
  end if;
exception
  when duplicate_object then
    null;
end
$$;

create index if not exists idx_profiles_stripe_customer_id
  on public.profiles(stripe_customer_id);

create index if not exists idx_profiles_stripe_subscription_id
  on public.profiles(stripe_subscription_id);
