-- ============================================================
-- 004 admin: aqc_audits, listings, offers, returns, qr_codes
-- ============================================================

do $$ begin
  create type aqc_verdict as enum ('pass', 'warn', 'fail');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type offer_status as enum ('pending', 'accepted', 'countered', 'rejected', 'expired', 'withdrawn');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type return_reason as enum (
    'not_authentic',
    'damaged_irreparable',
    'below_standards',
    'client_rejection',
    'withdraw_short_term',  -- < 3 msc
    'withdraw_long_term'    -- > 3 msc
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type return_resolution as enum ('pending', 'pickup_paid', 'disposal_free', 'returned', 'cancelled');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- aqc_audits (1:1 z product)
-- ============================================================
create table if not exists public.aqc_audits (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null unique references public.products(id) on delete cascade,
  inspector_id            uuid references public.profiles(id),
  scores                  jsonb not null default '{}'::jsonb,  -- { stitching: 10, leather: 10, ... }
  score_total             int,
  verdict                 aqc_verdict,
  notes                   text,
  recommended_price_cents int,
  decided_at              timestamptz,
  created_at              timestamptz not null default now()
);

alter table public.aqc_audits enable row level security;
-- Klient widzi audyty SWOICH produktów
drop policy if exists "aqc_audits_select_via_product" on public.aqc_audits;
create policy "aqc_audits_select_via_product" on public.aqc_audits for select using (
  exists (
    select 1 from public.products pr
    join public.submissions s on s.id = pr.submission_id
    where pr.id = aqc_audits.product_id and s.klient_id = auth.uid()
  )
);
drop policy if exists "aqc_audits_admin_all" on public.aqc_audits;
create policy "aqc_audits_admin_all" on public.aqc_audits for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);

-- ============================================================
-- listings
-- ============================================================
create table if not exists public.listings (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products(id) on delete cascade,
  channel             text not null default 'kickback',
  current_price_cents int not null,
  live_at             timestamptz not null default now(),
  deactivated_at      timestamptz,
  views_count         int not null default 0
);
create index if not exists listings_product_idx on public.listings(product_id);

alter table public.listings enable row level security;
drop policy if exists "listings_select_via_product" on public.listings;
create policy "listings_select_via_product" on public.listings for select using (
  exists (
    select 1 from public.products pr
    join public.submissions s on s.id = pr.submission_id
    where pr.id = listings.product_id and s.klient_id = auth.uid()
  )
);
drop policy if exists "listings_admin_all" on public.listings;
create policy "listings_admin_all" on public.listings for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);

-- ============================================================
-- offers (Zerr negotiations)
-- ============================================================
create table if not exists public.offers (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  listing_id        uuid references public.listings(id) on delete set null,
  buyer_token       text,                        -- anonymous cookie/session id
  buyer_name        text,
  amount_cents      int not null check (amount_cents > 0),
  message           text,
  status            offer_status not null default 'pending',
  parent_offer_id   uuid references public.offers(id),
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  responded_at      timestamptz,
  responded_by      uuid references public.profiles(id),
  is_seller_message boolean not null default false  -- true if posted by seller (counter)
);
create index if not exists offers_product_idx on public.offers(product_id);
create index if not exists offers_status_idx on public.offers(status);

alter table public.offers enable row level security;
drop policy if exists "offers_select_seller" on public.offers;
create policy "offers_select_seller" on public.offers for select using (
  exists (
    select 1 from public.products pr
    join public.submissions s on s.id = pr.submission_id
    where pr.id = offers.product_id and s.klient_id = auth.uid()
  )
);
drop policy if exists "offers_update_seller" on public.offers;
create policy "offers_update_seller" on public.offers for update using (
  exists (
    select 1 from public.products pr
    join public.submissions s on s.id = pr.submission_id
    where pr.id = offers.product_id and s.klient_id = auth.uid()
  )
);
drop policy if exists "offers_insert_seller" on public.offers;
create policy "offers_insert_seller" on public.offers for insert with check (
  exists (
    select 1 from public.products pr
    join public.submissions s on s.id = pr.submission_id
    where pr.id = offers.product_id and s.klient_id = auth.uid()
  )
);
drop policy if exists "offers_admin_all" on public.offers;
create policy "offers_admin_all" on public.offers for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);

-- ============================================================
-- returns (polityka 6 powodów)
-- ============================================================
create table if not exists public.returns (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null unique references public.products(id) on delete cascade,
  reason              return_reason not null,
  fee_cents           int not null default 0,
  decision_deadline   timestamptz,
  resolution          return_resolution not null default 'pending',
  notes               text,
  initiated_by        uuid references public.profiles(id),
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.returns enable row level security;
drop policy if exists "returns_select_via_product" on public.returns;
create policy "returns_select_via_product" on public.returns for select using (
  exists (
    select 1 from public.products pr
    join public.submissions s on s.id = pr.submission_id
    where pr.id = returns.product_id and s.klient_id = auth.uid()
  )
);
drop policy if exists "returns_insert_via_product" on public.returns;
create policy "returns_insert_via_product" on public.returns for insert with check (
  exists (
    select 1 from public.products pr
    join public.submissions s on s.id = pr.submission_id
    where pr.id = returns.product_id and s.klient_id = auth.uid()
  )
);
drop policy if exists "returns_admin_all" on public.returns;
create policy "returns_admin_all" on public.returns for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);

-- ============================================================
-- qr_codes
-- ============================================================
create table if not exists public.qr_codes (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null unique references public.products(id) on delete cascade,
  slug            text not null unique,
  scans_count     int not null default 0,
  last_scanned_at timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists qr_codes_slug_idx on public.qr_codes(slug);

alter table public.qr_codes enable row level security;
-- Public read by slug (dla /q/[slug] route)
drop policy if exists "qr_codes_public_read" on public.qr_codes;
create policy "qr_codes_public_read" on public.qr_codes for select using (true);
drop policy if exists "qr_codes_admin_all" on public.qr_codes;
create policy "qr_codes_admin_all" on public.qr_codes for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);

-- ============================================================
-- Triggers / helpers
-- ============================================================

-- Auto-create wallet_transactions(sale_pending) when product status flips to 'sold'
create or replace function public.handle_product_sold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  klient uuid;
  rate numeric;
  amount int;
  take_home int;
  available_when timestamptz;
begin
  if old.status is distinct from 'sold' and new.status = 'sold' then
    select s.klient_id, s.commission_rate
      into klient, rate
      from public.submissions s
      where s.id = new.submission_id;
    amount := coalesce(new.listing_price_cents, new.expected_price_cents, 0);
    take_home := round(amount * (1 - rate));
    available_when := now() + interval '14 days';

    insert into public.wallet_transactions (klient_id, type, amount_cents, reference_id, available_at, description)
    values (klient, 'sale_pending', take_home, 'PROD-' || new.id::text, available_when,
            new.brand || ' ' || new.model || ' (po prowizji ' || (rate * 100)::text || '%)');

    insert into public.notifications (user_id, type, title, body, ref_id, payload)
    values (klient, 'sale', 'Sprzedaż: ' || new.brand || ' ' || new.model,
            'Środki ' || (take_home / 100.0) || ' zł trafią do Wallet po 14d karencji.',
            'PROD-' || new.id::text,
            jsonb_build_object('amount_cents', take_home, 'available_at', available_when));
  end if;
  return new;
end;
$$;

drop trigger if exists products_sold_to_wallet on public.products;
create trigger products_sold_to_wallet
  after update on public.products
  for each row execute function public.handle_product_sold();
