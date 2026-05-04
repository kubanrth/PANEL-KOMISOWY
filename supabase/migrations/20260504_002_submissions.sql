-- ============================================================
-- 002 submissions: submissions + products + storage policies
-- ============================================================

-- Submission lifecycle
do $$ begin
  create type submission_status as enum (
    'draft',         -- klient w trakcie wypełniania
    'signed',        -- umowa podpisana, oczekuje na pakunek
    'in_transit',    -- pakunek w drodze do Kickback
    'aqc',           -- Authentication & Quality Control
    'listed',        -- wystawione na sprzedaż
    'sold',          -- sprzedane (oczekuje karencji 14d)
    'payout',        -- środki odblokowane / wypłacone
    'withdrawn',     -- wycofane przez klienta
    'returned'       -- zwrot (A&QC fail / klient odrzucił)
  );
exception when duplicate_object then null;
end $$;

-- Product lifecycle (per produkt, bo różne produkty w jednej submission mogą mieć różne statusy)
do $$ begin
  create type product_status as enum (
    'draft', 'aqc', 'listed', 'offer', 'sold', 'withdrawn', 'returned'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- submissions = Umowy Komisowe (Numer Submission = Numer Umowy)
-- ============================================================
create table if not exists public.submissions (
  id                  text primary key,                   -- format: SUB-XXXXX
  klient_id           uuid not null references public.profiles(id) on delete cascade,
  status              submission_status not null default 'draft',

  signed_at           timestamptz,
  signed_method       text,                               -- 'autopay' | 'pz' | 'admin'
  signed_ip           text,

  shipping_label_url  text,
  contract_pdf_url    text,
  commission_rate     numeric(4,3) not null default 0.20,

  created_by          uuid references public.profiles(id), -- klient lub admin
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists submissions_klient_idx on public.submissions(klient_id);
create index if not exists submissions_status_idx on public.submissions(status);
create index if not exists submissions_created_idx on public.submissions(created_at desc);

-- Sequence dla numerów submissions (start od 8000, żeby od razu wyglądało serio)
create sequence if not exists public.submissions_id_seq start with 8000;

-- Generator numeru SUB-XXXXX. SECURITY DEFINER bo klient ma RLS i nie widzi
-- całej tabeli — sequence pozwala wygenerować unikalny ID bez naruszania RLS.
create or replace function public.generate_submission_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return 'SUB-' || lpad(nextval('public.submissions_id_seq')::text, 5, '0');
end;
$$;

-- Klienci muszą móc wywołać RPC do wygenerowania ID przy tworzeniu submission
grant execute on function public.generate_submission_id() to authenticated;

-- ============================================================
-- products
-- ============================================================
create table if not exists public.products (
  id                    uuid primary key default gen_random_uuid(),
  submission_id         text not null references public.submissions(id) on delete cascade,

  brand                 text not null,
  model                 text not null,
  category              text,
  size                  text,
  condition             int check (condition between 1 and 10),
  description           text,

  expected_price_cents  int,                              -- cena oczekiwana (klient)
  min_price_cents       int,                              -- cena minimalna (klient)
  listing_price_cents   int,                              -- cena listowa (po A&QC)

  status                product_status not null default 'draft',
  photos                jsonb not null default '[]'::jsonb, -- [{url, name, size}]

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists products_submission_idx on public.products(submission_id);
create index if not exists products_status_idx on public.products(status);

-- Triggers for updated_at
drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.submissions enable row level security;
alter table public.products    enable row level security;

-- Klient: widzi i modyfikuje TYLKO swoje submissions
drop policy if exists "submissions_select_own" on public.submissions;
create policy "submissions_select_own"
  on public.submissions for select
  using (auth.uid() = klient_id);

drop policy if exists "submissions_insert_own" on public.submissions;
create policy "submissions_insert_own"
  on public.submissions for insert
  with check (auth.uid() = klient_id);

drop policy if exists "submissions_update_own" on public.submissions;
create policy "submissions_update_own"
  on public.submissions for update
  using (auth.uid() = klient_id)
  with check (auth.uid() = klient_id);

-- Admin: widzi wszystkie + może modyfikować
drop policy if exists "submissions_admin_all" on public.submissions;
create policy "submissions_admin_all"
  on public.submissions for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
  );

-- Products RLS via submission ownership
drop policy if exists "products_select_via_submission" on public.products;
create policy "products_select_via_submission"
  on public.products for select
  using (
    exists (select 1 from public.submissions s where s.id = products.submission_id and s.klient_id = auth.uid())
  );

drop policy if exists "products_insert_via_submission" on public.products;
create policy "products_insert_via_submission"
  on public.products for insert
  with check (
    exists (select 1 from public.submissions s where s.id = products.submission_id and s.klient_id = auth.uid())
  );

drop policy if exists "products_update_via_submission" on public.products;
create policy "products_update_via_submission"
  on public.products for update
  using (
    exists (select 1 from public.submissions s where s.id = products.submission_id and s.klient_id = auth.uid())
  );

drop policy if exists "products_delete_via_submission" on public.products;
create policy "products_delete_via_submission"
  on public.products for delete
  using (
    exists (
      select 1 from public.submissions s
      where s.id = products.submission_id
      and s.klient_id = auth.uid()
      and s.status = 'draft'  -- delete only allowed on draft submissions
    )
  );

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
  on public.products for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
  );

-- ============================================================
-- Storage bucket: product-photos
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('product-photos', 'product-photos', true)
  on conflict (id) do nothing;

-- Storage RLS: każdy zalogowany może uploadować TYLKO do swojego folderu (auth.uid()/...)
drop policy if exists "product_photos_insert_own" on storage.objects;
create policy "product_photos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_photos_select_own" on storage.objects;
create policy "product_photos_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_photos_delete_own" on storage.objects;
create policy "product_photos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read (bucket is public, ale dla pewności — anyone can read URL)
drop policy if exists "product_photos_public_read" on storage.objects;
create policy "product_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'product-photos');
