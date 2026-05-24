-- ============================================================
-- 011 — Analytics snapshots + Sales plans
-- ============================================================
-- inventory_snapshots: dzienny snapshot wartości magazynu per klient,
-- żeby narysować wykres "wartość magazynu w czasie" w analityce.
-- W produkcji uzupełniane przez pg_cron daily job. W demo: ręczna
-- inserta + UI degraduje gracefully gdy brak danych.

create table if not exists public.inventory_snapshots (
  klient_id          uuid not null references public.profiles(id) on delete cascade,
  day                date not null,
  total_value_cents  bigint not null default 0,
  item_count         int not null default 0,
  primary key (klient_id, day)
);

create index if not exists snapshots_klient_day_idx on public.inventory_snapshots(klient_id, day desc);

alter table public.inventory_snapshots enable row level security;

drop policy if exists "snapshots_select_own" on public.inventory_snapshots;
create policy "snapshots_select_own" on public.inventory_snapshots for select using (klient_id = auth.uid());

drop policy if exists "snapshots_admin_all" on public.inventory_snapshots;
create policy "snapshots_admin_all" on public.inventory_snapshots for all using (public.is_admin());

-- RPC do wzbudzania snapshotu (admin / cron):
create or replace function public.capture_inventory_snapshot()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory_snapshots (klient_id, day, total_value_cents, item_count)
  select
    s.klient_id,
    current_date,
    coalesce(sum(p.listing_price_cents), 0)::bigint,
    count(p.id)
  from public.products p
  join public.submissions s on s.id = p.submission_id
  where p.status in ('aqc', 'listed', 'offer')
  group by s.klient_id
  on conflict (klient_id, day) do update
  set total_value_cents = excluded.total_value_cents,
      item_count        = excluded.item_count;
end $$;

grant execute on function public.capture_inventory_snapshot() to authenticated;

-- ============================================================
-- sales_plans — klient deklaruje budżet marketingowy + planowane pozycje
-- ============================================================
create table if not exists public.sales_plans (
  id                       uuid primary key default gen_random_uuid(),
  klient_id                uuid not null references public.profiles(id) on delete cascade,
  marketing_budget_cents   int not null default 0,
  planned_items_text       text,
  expected_value_cents     int,
  submitted_at             timestamptz not null default now(),
  status                   text not null default 'submitted', -- submitted / reviewed / accepted / rejected
  admin_notes              text
);

create index if not exists sales_plans_klient_idx on public.sales_plans(klient_id, submitted_at desc);

alter table public.sales_plans enable row level security;

drop policy if exists "sales_plans_select_own" on public.sales_plans;
create policy "sales_plans_select_own" on public.sales_plans for select using (klient_id = auth.uid());

drop policy if exists "sales_plans_insert_own" on public.sales_plans;
create policy "sales_plans_insert_own" on public.sales_plans for insert with check (klient_id = auth.uid());

drop policy if exists "sales_plans_admin_all" on public.sales_plans;
create policy "sales_plans_admin_all" on public.sales_plans for all using (public.is_admin());
