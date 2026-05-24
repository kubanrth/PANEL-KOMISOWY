-- ============================================================
-- 009 — Klient invoices upload (Faktury VAT / UKS)
-- ============================================================
-- Klient uploaduje fakturę albo UKS dla zamkniętych sprzedaży.
-- Admin weryfikuje i akceptuje → Funds odblokowane w wallet.

do $$ begin
  create type invoice_type as enum ('faktura_vat', 'uks', 'inne');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type invoice_status as enum ('uploaded', 'verified', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  klient_id       uuid not null references public.profiles(id) on delete cascade,
  type            invoice_type not null default 'faktura_vat',
  file_url        text not null,
  invoice_number  text,
  issued_at       date,
  amount_cents    int,
  -- Sprzedaże których faktura dotyczy (UI łączy po user request).
  sale_product_ids uuid[] not null default '{}',
  status          invoice_status not null default 'uploaded',
  uploaded_at     timestamptz not null default now(),
  verified_at     timestamptz,
  verified_by     uuid references public.profiles(id),
  rejection_reason text
);

create index if not exists invoices_klient_idx on public.invoices(klient_id);
create index if not exists invoices_status_idx on public.invoices(status);

alter table public.invoices enable row level security;

drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices for select using (klient_id = auth.uid());

drop policy if exists "invoices_insert_own" on public.invoices;
create policy "invoices_insert_own" on public.invoices for insert with check (klient_id = auth.uid());

drop policy if exists "invoices_admin_all" on public.invoices;
create policy "invoices_admin_all" on public.invoices for all using (public.is_admin());

-- ============================================================
-- Storage bucket: invoices/ (klient uid prefix)
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('invoices', 'invoices', false)
  on conflict (id) do nothing;

drop policy if exists "invoices_insert_own" on storage.objects;
create policy "invoices_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "invoices_select_own" on storage.objects;
create policy "invoices_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'invoices'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "invoices_delete_own" on storage.objects;
create policy "invoices_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
