-- ============================================================
-- 001 init: profiles, RLS basics
-- Run in Supabase SQL editor (or via supabase CLI: supabase db push)
-- ============================================================

-- Account types (Postgres doesn't support IF NOT EXISTS on CREATE TYPE,
-- so we wrap in DO blocks that swallow duplicate_object errors).
do $$ begin
  create type account_type as enum ('individual', 'business');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type user_role as enum ('klient', 'admin', 'super_admin');
exception when duplicate_object then null;
end $$;

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'klient',
  account_type    account_type,
  first_name      text,
  last_name       text,
  phone           text,
  pesel_or_id     text,           -- only for individual
  company_name    text,           -- only for business
  nip             text,           -- only for business
  vat_id          text,           -- optional
  address_line    text,
  postal_code     text,
  city            text,
  country         text default 'Polska',
  onboarded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;

-- Klient widzi/edytuje TYLKO swój profil
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Admin widzi wszystkie profile (jeśli sam ma role 'admin' lub 'super_admin')
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
    )
  );

-- ============================================================
-- Helper view: current user's profile (handy for client)
-- ============================================================
create or replace view public.me as
select * from public.profiles where id = auth.uid();
