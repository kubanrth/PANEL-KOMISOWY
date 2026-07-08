-- ============================================================
-- 015 — Fulfillment requests (klient zleca wysyłkę z magazynu)
-- ============================================================
-- Klient przesyła własny list przewozowy (label_provided) ALBO
-- podaje dane odbiorcy, z których Kickback generuje list
-- (generate_label). Rozszerzamy fulfillment_orders (migracja 010)
-- o dane zlecenia + prywatny bucket na etykiety.

alter table public.fulfillment_orders
  add column if not exists request_type text check (request_type in ('label_provided', 'generate_label'));
alter table public.fulfillment_orders
  add column if not exists label_url text;
alter table public.fulfillment_orders
  add column if not exists recipient_name text;
alter table public.fulfillment_orders
  add column if not exists recipient_phone text;
alter table public.fulfillment_orders
  add column if not exists recipient_address_line text;
alter table public.fulfillment_orders
  add column if not exists recipient_postal_code text;
alter table public.fulfillment_orders
  add column if not exists recipient_city text;
alter table public.fulfillment_orders
  add column if not exists notes text;
alter table public.fulfillment_orders
  add column if not exists requested_by uuid references public.profiles(id);

create index if not exists fulfillment_klient_idx on public.fulfillment_orders(klient_id);
create index if not exists fulfillment_product_idx on public.fulfillment_orders(product_id);

-- Jedno otwarte zlecenie per produkt — constraint w DB zamiast
-- polegania wyłącznie na checku w server action (race dwóch submitów).
create unique index if not exists fulfillment_one_open_per_product
  on public.fulfillment_orders(product_id)
  where status in ('pending', 'shipped');

-- ============================================================
-- RLS — klient tworzy własne zlecenia (tylko pending, z typem)
-- ============================================================
drop policy if exists "fulfillment_insert_own" on public.fulfillment_orders;
create policy "fulfillment_insert_own"
  on public.fulfillment_orders for insert
  with check (klient_id = auth.uid() and request_type is not null and status = 'pending');

-- ============================================================
-- notifications — nowy typ powiadomienia
-- ============================================================
-- PG 12+: add value w transakcji migracji jest OK, dopóki wartość
-- nie jest UŻYWANA w tej samej transakcji (nie jest).
alter type notification_type add value if not exists 'fulfillment_requested';

-- ============================================================
-- Storage bucket dla listów przewozowych (PRYWATNY — wzorzec z 003)
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('shipping-labels', 'shipping-labels', false)
  on conflict (id) do nothing;

drop policy if exists "shipping_labels_insert_own_storage" on storage.objects;
create policy "shipping_labels_insert_own_storage" on storage.objects for insert to authenticated with check (
  bucket_id = 'shipping-labels' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "shipping_labels_select_own_storage" on storage.objects;
create policy "shipping_labels_select_own_storage" on storage.objects for select to authenticated using (
  bucket_id = 'shipping-labels' and (storage.foldername(name))[1] = auth.uid()::text
);
