-- ============================================================
-- 012 — Fakturownia integration
-- ============================================================
-- Dwustronna integracja Kickback ↔ Fakturownia:
-- 1) Push: Kickback wystawia produkt w magazynie komisanta po A&QC pass.
-- 2) Pull: Fakturownia wysyła webhook MM doc gdy towar przeszedł z magazynu
--    komisanta do głównego — to sygnał sprzedaży, ustawia products.status='sold'
--    (trigger handle_product_sold reszty domyka: wallet + notyfikacje).
--
-- SKU = KCB-{YY}-{6hex z product UUID}. Wymagany (NOT NULL) po backfill.
-- HMAC secret + service-role key trzymamy w env, nie w DB.

-- ---------- products: SKU + Fakturownia link ----------
alter table public.products
  add column if not exists sku                    text,
  add column if not exists fakturownia_product_id bigint,
  add column if not exists fakturownia_pushed_at  timestamptz;

-- Unique partial index (pozwala NULL przed backfillem; backfill + NOT NULL niżej).
create unique index if not exists products_sku_uniq
  on public.products(sku) where sku is not null;
create index if not exists products_fakt_id_idx
  on public.products(fakturownia_product_id);

-- SKU generator: KCB-{YY}-{6hex z UUID}.
create or replace function public.generate_product_sku(p_id uuid)
returns text
language sql
immutable
as $$
  select 'KCB-' || to_char(now(), 'YY') || '-' ||
         upper(substr(replace(p_id::text, '-', ''), 1, 6));
$$;

-- Backfill istniejących wierszy w jednej transakcji + ustaw NOT NULL.
update public.products
   set sku = public.generate_product_sku(id)
 where sku is null;

alter table public.products
  alter column sku set not null;

comment on column public.products.sku is
  'Globalny identyfikator produktu, format KCB-{YY}-{6hex}. Używany do '
  'matchowania z pozycjami w dokumentach Fakturownia (MM, FV).';

-- ============================================================
-- fakturownia_warehouse_map — klient → magazyn w Fakturowni
-- ============================================================
create table if not exists public.fakturownia_warehouse_map (
  klient_id                  uuid primary key references public.profiles(id) on delete cascade,
  fakturownia_warehouse_id   bigint not null,
  warehouse_name             text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create unique index if not exists fakt_wh_warehouse_uniq
  on public.fakturownia_warehouse_map(fakturownia_warehouse_id);

drop trigger if exists fakt_wh_set_updated_at on public.fakturownia_warehouse_map;
create trigger fakt_wh_set_updated_at
  before update on public.fakturownia_warehouse_map
  for each row execute function public.set_updated_at();

-- ============================================================
-- fakturownia_events — idempotent log of incoming webhooks
-- ============================================================
create table if not exists public.fakturownia_events (
  id                     uuid primary key default gen_random_uuid(),
  fakturownia_event_id   text not null unique,        -- z payloadu, anty-duplikat
  event_kind             text not null,               -- 'mm_sale','product_update',...
  payload                jsonb not null,              -- TOP-LEVEL only (redacted)
  signature_valid        boolean not null,
  status                 text not null check (status in ('processed','failed','skipped','replayed')),
  error_message          text,
  processed_at           timestamptz,
  received_at            timestamptz not null default now()
);

create index if not exists fakt_events_received_idx on public.fakturownia_events(received_at desc);
create index if not exists fakt_events_status_idx   on public.fakturownia_events(status);

-- ============================================================
-- fakturownia_push_queue — retry queue dla Kickback → Fakturownia
-- ============================================================
create table if not exists public.fakturownia_push_queue (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  attempts          int  not null default 0,
  last_error        text,
  status            text not null default 'pending' check (status in ('pending','done','failed')),
  next_attempt_at   timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists fakt_push_pending_idx
  on public.fakturownia_push_queue(status, next_attempt_at);

-- ============================================================
-- mark_product_sold_from_webhook — atomic + idempotent + audit-safe
-- ============================================================
-- Webhook nie ma sesji usera. Service-role client mógłby zrobić UPDATE
-- bezpośrednio, ale SECURITY DEFINER funkcja daje nam:
--   * walidację stanu (reject draft/returned/withdrawn)
--   * idempotency (jeśli już sold → return product_id bez exception)
--   * single point dla audit log
--   * commission_rate not null guard (defensywnie przed trigger crash)
create or replace function public.mark_product_sold_from_webhook(
  p_sku text,
  p_mm_doc_id text,
  p_event_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id    uuid;
  v_status        product_status;
  v_submission_id text;
  v_rate          numeric;
begin
  -- Lock produktu (race condition between duplicate webhook deliveries).
  select id, status, submission_id
    into v_product_id, v_status, v_submission_id
    from products
   where sku = p_sku
   for update;

  if v_product_id is null then
    raise exception 'sku_not_found:%', p_sku;
  end if;

  -- Idempotency: drugi wywołanie po sukcesie → po prostu OK.
  if v_status = 'sold' then
    return v_product_id;
  end if;

  if v_status <> 'listed' and v_status <> 'offer' then
    raise exception 'invalid_status_for_sale:%', v_status;
  end if;

  -- Defensywnie: handle_product_sold trigger używa commission_rate.
  select commission_rate into v_rate
    from submissions where id = v_submission_id;

  if v_rate is null then
    raise exception 'commission_rate_null:submission=%', v_submission_id;
  end if;

  update products
     set status = 'sold'
   where id = v_product_id;

  return v_product_id;
end $$;

revoke all on function public.mark_product_sold_from_webhook(text, text, uuid) from public;
-- Service-role client w webhooku ma rights na funkcje SECURITY DEFINER
-- bezpośrednio (bypass RLS), nie potrzebujemy explicit GRANT.

-- ============================================================
-- RLS — wszystkie nowe tabele = admin only
-- ============================================================
alter table public.fakturownia_warehouse_map enable row level security;
alter table public.fakturownia_events        enable row level security;
alter table public.fakturownia_push_queue    enable row level security;

drop policy if exists "fakt_wh_admin_all" on public.fakturownia_warehouse_map;
create policy "fakt_wh_admin_all"
  on public.fakturownia_warehouse_map for all using (public.is_admin());

drop policy if exists "fakt_events_admin_all" on public.fakturownia_events;
create policy "fakt_events_admin_all"
  on public.fakturownia_events for all using (public.is_admin());

drop policy if exists "fakt_push_admin_all" on public.fakturownia_push_queue;
create policy "fakt_push_admin_all"
  on public.fakturownia_push_queue for all using (public.is_admin());
