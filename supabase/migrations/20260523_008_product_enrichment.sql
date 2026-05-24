-- ============================================================
-- 008 — Product enrichment + price change requests
-- ============================================================
-- Adds metadata needed for Magazyn/Sprzedaże full column spec
-- (VAT rate, sold/settlement timestamps) and the price-change
-- approval workflow (klient suggests new price, admin approves).
-- All NULLABLE/defaults so existing data stays valid.

alter table public.products
  add column if not exists vat_rate          numeric(4,3) not null default 0.230,
  add column if not exists published_at      timestamptz,
  add column if not exists sold_at           timestamptz,
  add column if not exists settlement_at     timestamptz;

-- Backfill: published_at = created_at for already-listed products
update public.products
   set published_at = created_at
 where published_at is null
   and status in ('listed', 'offer', 'sold');

comment on column public.products.vat_rate is
  '0.000 (zw), 0.050, 0.080, 0.230 — wybierane per pozycja. UI mapuje na "zw"/"5%"/"8%"/"23%".';

comment on column public.products.published_at is
  'Kiedy produkt został opublikowany na sprzedaż (przejście do status=listed). NULL dla draft/aqc.';

comment on column public.products.sold_at is 'Trigger ustawia gdy status → sold.';
comment on column public.products.settlement_at is 'sold_at + 14d karencji.';

-- Trigger: status=sold → set sold_at + settlement_at automatically
create or replace function public.handle_product_sold_timestamps()
returns trigger language plpgsql as $$
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') then
    new.sold_at = coalesce(new.sold_at, now());
    new.settlement_at = coalesce(new.settlement_at, new.sold_at + interval '14 days');
  end if;
  if new.status = 'listed' and (old.status is distinct from 'listed') then
    new.published_at = coalesce(new.published_at, now());
  end if;
  return new;
end $$;

drop trigger if exists products_sold_timestamps on public.products;
create trigger products_sold_timestamps
  before update on public.products
  for each row execute function public.handle_product_sold_timestamps();

-- ============================================================
-- Price change requests — klient suggests, admin decides
-- ============================================================
do $$ begin
  create type price_change_status as enum ('pending', 'accepted', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.price_change_requests (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  requested_by      uuid not null references public.profiles(id),
  current_price_cents int,
  suggested_price_cents int not null check (suggested_price_cents > 0),
  status            price_change_status not null default 'pending',
  decided_by        uuid references public.profiles(id),
  decided_at        timestamptz,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists price_changes_product_idx on public.price_change_requests(product_id);
create index if not exists price_changes_status_idx on public.price_change_requests(status);
create index if not exists price_changes_requester_idx on public.price_change_requests(requested_by);

alter table public.price_change_requests enable row level security;

drop policy if exists "price_changes_select_own" on public.price_change_requests;
create policy "price_changes_select_own"
  on public.price_change_requests for select
  using (requested_by = auth.uid());

drop policy if exists "price_changes_insert_own" on public.price_change_requests;
create policy "price_changes_insert_own"
  on public.price_change_requests for insert
  with check (requested_by = auth.uid());

drop policy if exists "price_changes_update_own_cancel" on public.price_change_requests;
create policy "price_changes_update_own_cancel"
  on public.price_change_requests for update
  using (requested_by = auth.uid() and status = 'pending')
  with check (status in ('pending', 'cancelled'));

drop policy if exists "price_changes_admin_all" on public.price_change_requests;
create policy "price_changes_admin_all"
  on public.price_change_requests for all using (public.is_admin());
