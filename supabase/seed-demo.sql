-- ============================================================================
-- PREREQ 0/2 — esencja migracji 012 potrzebna seedowi (idempotentna):
-- kolumna products.sku + generator. (Pełną 012 — webhooki Fakturowni —
-- uruchom osobno, jeśli jeszcze nie była.)
-- ============================================================================
alter table public.products
  add column if not exists sku text,
  add column if not exists fakturownia_product_id bigint,
  add column if not exists fakturownia_pushed_at timestamptz;

create unique index if not exists products_sku_uniq on public.products(sku)
  where sku is not null;

create or replace function public.generate_product_sku(p_id uuid)
returns text language sql immutable as $f$
  select 'KCB-' || to_char(now(), 'YY') || '-' || upper(substr(replace(p_id::text,'-',''),1,6));
$f$;

-- ============================================================================
-- PREREQ 1/2 — migracja 013 (CMS: kickback_picks + demand_listings.sizes).
-- W tej bazie jeszcze jej nie było — całość jest idempotentna.
-- ============================================================================
-- ============================================================
-- 013 — CMS modules: "Co warto dodać" + Zapotrzebowanie enhance
-- ============================================================
-- Faza A: kickback_picks — manualnie kurowana lista wyświetlana
--          komisantom NAD heurystycznymi "Sugestiami Kickback".
-- Faza B: demand_listings.sizes — multi-rozmiar dla WTB,
--          oraz aktywne pole publication_status do reactivate flow.

-- ---------- Faza A: kickback_picks ----------
create table if not exists public.kickback_picks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,                    -- np. "Polskie kluby retro 90s"
  description    text,                             -- markdown-light, klient widzi jako body
  category       text,                             -- "Trend" | "Hot brand" | "Sezon" | "Rzadkość" | ...
  priority       int not null default 100,         -- desc sort, wyższy = wyżej
  image_url      text,                             -- opcjonalne tło / herb / zdjęcie
  cta_label      text,                             -- np. "Zobacz w zapotrzebowaniu"
  cta_href       text,                             -- np. "/panel/zapotrzebowanie?kind=club"
  active         boolean not null default true,
  published_at   timestamptz not null default now(),
  expires_at     timestamptz,                      -- jeśli nie null, pick znika po dacie
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists kickback_picks_active_priority_idx
  on public.kickback_picks(active, priority desc, published_at desc);

drop trigger if exists kickback_picks_set_updated_at on public.kickback_picks;
create trigger kickback_picks_set_updated_at
  before update on public.kickback_picks
  for each row execute function public.set_updated_at();

-- RLS: read for any authenticated, write only admin
alter table public.kickback_picks enable row level security;

drop policy if exists "picks_read_auth" on public.kickback_picks;
create policy "picks_read_auth"
  on public.kickback_picks for select
  to authenticated
  using (active = true and (expires_at is null or expires_at > now()));

drop policy if exists "picks_admin_all" on public.kickback_picks;
create policy "picks_admin_all"
  on public.kickback_picks for all using (public.is_admin());

-- ---------- Faza B: demand_listings.sizes (multi) ----------
alter table public.demand_listings
  add column if not exists sizes text[] not null default '{}',
  add column if not exists notes_admin text;

create index if not exists demand_listings_sizes_gin
  on public.demand_listings using gin (sizes);

comment on column public.demand_listings.sizes is
  'Rozmiary których szukamy. Pusty array = każdy rozmiar. Wartości: S/M/L/XL/XXL/One Size/...';
comment on column public.demand_listings.notes_admin is
  'Wewnętrzne notatki admina (nie widoczne klientom).';


-- ============================================================================
-- 2/2 — WŁAŚCIWY SEED
-- ============================================================================
-- ============================================================================
-- SEED DEMO — realistyczna historia konta daniel@theholdone.com
-- ============================================================================
-- Uruchom w Supabase SQL Editor. Skrypt jest IDEMPOTENTNY: najpierw kasuje
-- poprzedni seed (stałe ID z przestrzeni dddddddd-… i SUB-9000x), potem
-- wstawia wszystko od nowa. Można odpalać wielokrotnie.
--
-- Co tworzy:
--   3 oferty (SUB-90001 sprzed 70 dni, SUB-90002 sprzed 30 dni, SUB-90003 w transporcie)
--   14 koszulek: 6 w sprzedaży, 1 w negocjacji Zerr, 1 w A&QC, 2 drafty,
--                3 sprzedane (1 rozliczona+wypłata, 2 w karencji), 1 zwrot, 1 wycofana
--   Portfel: 600 zł dostępne, 3 040 zł w karencji, wypłata 1 000 zł zrealizowana
--   A&QC audyty, oferty Zerr (kupujący + kontra), zwroty, UKS, faktura,
--   fulfillment (dostarczone/wysłane/pakowane), QR, zmiany cen, powiadomienia,
--   zapotrzebowanie (3), Co warto dodać (3), snapshoty magazynu (30 dni)
-- ============================================================================

do $$
declare
  v_klient uuid;
  -- produkty (stałe ID → idempotencja)
  p01 uuid := 'de000100-0000-4000-a000-000000000001'; -- Real Madryt 2011/12  listed
  p02 uuid := 'de000200-0000-4000-a000-000000000002'; -- FC Barcelona 2014/15 listed
  p03 uuid := 'de000300-0000-4000-a000-000000000003'; -- Legia 2019/20        listed (po obniżce)
  p04 uuid := 'de000400-0000-4000-a000-000000000004'; -- AC Milan 2006/07     offer (Zerr)
  p05 uuid := 'de000500-0000-4000-a000-000000000005'; -- Polska EURO 2016     aqc
  p06 uuid := 'de000600-0000-4000-a000-000000000006'; -- Juventus 2011/12     listed (pending price change)
  p07 uuid := 'de000700-0000-4000-a000-000000000007'; -- Real Madryt 2016/17  listed
  p08 uuid := 'de000800-0000-4000-a000-000000000008'; -- Borussia 1996/97     listed retro
  p09 uuid := 'de000900-0000-4000-a000-000000000009'; -- Man United 1999      SOLD 40d (rozliczona)
  p10 uuid := 'de001000-0000-4000-a000-000000000010'; -- Arsenal 2003/04      SOLD 10d (karencja)
  p11 uuid := 'de001100-0000-4000-a000-000000000011'; -- Inter 2009/10        SOLD 3d  (karencja)
  p12 uuid := 'de001200-0000-4000-a000-000000000012'; -- Ajax 1995            zwrot (decyzja klienta)
  p13 uuid := 'de001300-0000-4000-a000-000000000013'; -- Chelsea 2012         wycofana (odesłana)
  p14 uuid := 'de001400-0000-4000-a000-000000000014'; -- PSG 2020/21          draft (nowa oferta)
  p15 uuid := 'de001500-0000-4000-a000-000000000015'; -- Napoli Maradona      draft (nowa oferta)
  -- pozostałe stałe ID
  ofr1 uuid := 'dddddddd-0000-4000-b000-000000000001';
  ofr2 uuid := 'dddddddd-0000-4000-b000-000000000002';
  dem1 uuid := 'dddddddd-0000-4000-c000-000000000001';
  dem2 uuid := 'dddddddd-0000-4000-c000-000000000002';
  dem3 uuid := 'dddddddd-0000-4000-c000-000000000003';
  pick1 uuid := 'dddddddd-0000-4000-d000-000000000001';
  pick2 uuid := 'dddddddd-0000-4000-d000-000000000002';
  pick3 uuid := 'dddddddd-0000-4000-d000-000000000003';
  demo_products uuid[];
  d int;
begin
  -- ── konto ────────────────────────────────────────────────────────────────
  select u.id into v_klient from auth.users u where u.email = 'daniel@theholdone.com';
  if v_klient is null then
    raise exception 'Brak konta daniel@theholdone.com — najpierw utwórz usera.';
  end if;

  demo_products := array[p01,p02,p03,p04,p05,p06,p07,p08,p09,p10,p11,p12,p13,p14,p15];

  -- ── CLEANUP poprzedniego seeda ───────────────────────────────────────────
  -- wallet/notifications nie mają FK do produktów — kasujemy po reference_id
  delete from public.wallet_transactions
   where klient_id = v_klient
     and (reference_id like 'PROD-de00%' or reference_id like 'DEMO-%');
  delete from public.notifications
   where user_id = v_klient
     and (ref_id like 'PROD-de00%' or ref_id like 'DEMO-%' or payload @> '{"demo":true}');
  delete from public.payouts   where klient_id = v_klient and notes = '[DEMO]';
  delete from public.invoices  where klient_id = v_klient and invoice_number like 'DEMO/%';
  delete from public.documents where klient_id = v_klient and file_url like 'https://demo.kickback.pl/%';
  delete from public.fulfillment_orders where klient_id = v_klient and (tracking_number like 'DEMO%'
    or product_id = any(demo_products));  -- pending (tracking NULL) też musi zniknąć przed delete products (FK SET NULL)
  delete from public.inventory_snapshots where klient_id = v_klient;
  delete from public.demand_listings where id = any(array[dem1,dem2,dem3]);
  delete from public.kickback_picks  where id = any(array[pick1,pick2,pick3]);
  -- produkty + zależności (offers/returns/aqc/qr/listings/price_changes) przez CASCADE
  delete from public.products    where id = any(demo_products);
  delete from public.submissions where id in ('SUB-90001','SUB-90002','SUB-90003');

  -- ── SUBMISSIONS ──────────────────────────────────────────────────────────
  insert into public.submissions (id, klient_id, status, signed_at, signed_method, commission_rate, created_by, created_at, updated_at) values
    ('SUB-90001', v_klient, 'listed',     now() - interval '70 days', 'autopay', 0.20, v_klient, now() - interval '70 days', now() - interval '3 days'),
    ('SUB-90002', v_klient, 'listed',     now() - interval '30 days', 'pz',      0.20, v_klient, now() - interval '30 days', now() - interval '5 days'),
    ('SUB-90003', v_klient, 'in_transit', now() - interval '3 days',  'autopay', 0.20, v_klient, now() - interval '3 days',  now() - interval '1 day');

  -- ── PRODUCTS ─────────────────────────────────────────────────────────────
  -- Uwaga: sold wstawiamy jako 'listed' i przełączamy UPDATE-em, żeby odpaliły
  -- się produkcyjne triggery (wallet + notyfikacja + sold_at/settlement_at).
  insert into public.products
    (id, submission_id, brand, model, category, size, condition, description,
     expected_price_cents, min_price_cents, listing_price_cents, status, photos,
     vat_rate, published_at, sku, created_at, updated_at) values
    (p01,'SUB-90001','Real Madryt','Home 2011/12','koszulka','L',9,'Ronaldo era. Oryginalne loty, stan bardzo dobry.',
     250000,200000,240000,'listed','[]',0.230, now()-interval '58 days', public.generate_product_sku(p01), now()-interval '70 days', now()-interval '6 days'),
    (p02,'SUB-90001','FC Barcelona','Home 2014/15','koszulka','M',8,'Tripleta MSN. Drobne zmechacenia.',
     200000,160000,189000,'listed','[]',0.230, now()-interval '55 days', public.generate_product_sku(p02), now()-interval '70 days', now()-interval '12 days'),
    (p03,'SUB-90001','Legia Warszawa','Home 2019/20','koszulka','XL',7,'Edycja mistrzowska.',
     80000,55000,64000,'listed','[]',0.080, now()-interval '52 days', public.generate_product_sku(p03), now()-interval '70 days', now()-interval '20 days'),
    (p04,'SUB-90001','AC Milan','Home 2006/07','koszulka','S',9,'Kaka #22, finał Aten. Rzadki rozmiar.',
     330000,280000,320000,'offer','[]',0.230, now()-interval '50 days', public.generate_product_sku(p04), now()-interval '70 days', now()-interval '2 days'),
    (p05,'SUB-90002','Polska','EURO 2016','koszulka','M',6,'Wymaga weryfikacji stanu C.',
     50000,35000,null,'aqc','[]',0.000, null, public.generate_product_sku(p05), now()-interval '30 days', now()-interval '7 days'),
    (p06,'SUB-90001','Juventus','Home 2011/12','koszulka','L',8,'Del Piero, ostatni sezon.',
     160000,120000,145000,'listed','[]',0.230, now()-interval '48 days', public.generate_product_sku(p06), now()-interval '70 days', now()-interval '4 days'),
    (p07,'SUB-90002','Real Madryt','Away 2016/17','koszulka','M',9,'La Duodécima.',
     220000,180000,210000,'listed','[]',0.230, now()-interval '25 days', public.generate_product_sku(p07), now()-interval '30 days', now()-interval '25 days'),
    (p08,'SUB-90002','Borussia Dortmund','Home 1996/97','koszulka','L',8,'Retro, era Sammera. Kolekcjonerska.',
     300000,240000,275000,'listed','[]',0.230, now()-interval '22 days', public.generate_product_sku(p08), now()-interval '30 days', now()-interval '22 days'),
    (p09,'SUB-90001','Manchester United','Home 1999','koszulka','XL',9,'Treble. Beckham #7.',
     210000,170000,200000,'listed','[]',0.230, now()-interval '65 days', public.generate_product_sku(p09), now()-interval '70 days', now()-interval '65 days'),
    (p10,'SUB-90001','Arsenal','Home 2003/04','koszulka','M',9,'Invincibles. Henry #14.',
     230000,190000,220000,'listed','[]',0.230, now()-interval '60 days', public.generate_product_sku(p10), now()-interval '70 days', now()-interval '60 days'),
    (p11,'SUB-90002','Inter Mediolan','Home 2009/10','koszulka','L',8,'Potrójna korona Mourinho.',
     170000,130000,160000,'listed','[]',0.230, now()-interval '24 days', public.generate_product_sku(p11), now()-interval '30 days', now()-interval '24 days'),
    (p12,'SUB-90002','Ajax','Home 1995','koszulka','M',7,'Finał Wiednia. Zwrot od kupującego — do decyzji.',
     310000,250000,290000,'returned','[]',0.230, now()-interval '20 days', public.generate_product_sku(p12), now()-interval '30 days', now()-interval '4 days'),
    (p13,'SUB-90001','Chelsea','Home 2012','koszulka','S',8,'Monachium. Wycofana na życzenie klienta.',
     110000,80000,98000,'withdrawn','[]',0.230, now()-interval '45 days', public.generate_product_sku(p13), now()-interval '70 days', now()-interval '15 days'),
    (p14,'SUB-90003','PSG','Home 2020/21','koszulka','M',9,'Nowa oferta — w drodze do magazynu.',
     140000,100000,null,'draft','[]',0.230, null, public.generate_product_sku(p14), now()-interval '3 days', now()-interval '3 days'),
    (p15,'SUB-90003','Napoli','Home 1987/88','koszulka','L',7,'Era Maradony — do wyceny.',
     420000,350000,null,'draft','[]',0.230, null, public.generate_product_sku(p15), now()-interval '3 days', now()-interval '3 days');

  -- ── SPRZEDAŻE (UPDATE → triggery produkcyjne robią wallet + notyfikacje) ─
  update public.products set status='sold', sold_at=now()-interval '40 days' where id=p09;
  update public.products set status='sold', sold_at=now()-interval '10 days' where id=p10;
  update public.products set status='sold', sold_at=now()-interval '3 days'  where id=p11;

  -- urealnij wiersze portfela utworzone przez trigger (daty karencji od sold_at)
  update public.wallet_transactions set created_at=now()-interval '40 days', available_at=now()-interval '26 days', type='sale_unlocked'
   where klient_id=v_klient and reference_id='PROD-'||p09::text;
  update public.wallet_transactions set created_at=now()-interval '10 days', available_at=now()+interval '4 days'
   where klient_id=v_klient and reference_id='PROD-'||p10::text;
  update public.wallet_transactions set created_at=now()-interval '3 days',  available_at=now()+interval '11 days'
   where klient_id=v_klient and reference_id='PROD-'||p11::text;
  -- notyfikacje sprzedażowe z triggera — te same daty
  update public.notifications set created_at=now()-interval '40 days' where user_id=v_klient and ref_id='PROD-'||p09::text;
  update public.notifications set created_at=now()-interval '10 days' where user_id=v_klient and ref_id='PROD-'||p10::text;
  update public.notifications set created_at=now()-interval '3 days'  where user_id=v_klient and ref_id='PROD-'||p11::text;

  -- ── WYPŁATA 1 000 zł (zrealizowana 20 dni temu) ──────────────────────────
  insert into public.wallet_transactions (klient_id, type, amount_cents, reference_id, description, created_at)
  values (v_klient,'payout_done',-100000,'DEMO-PAYOUT-1','Wypłata na konto •••• 4921', now()-interval '20 days');
  insert into public.payouts (klient_id, amount_cents, status, requested_at, authorized_at, executed_at, bank_ref, notes)
  values (v_klient, 100000, 'done', now()-interval '21 days', now()-interval '20 days', now()-interval '20 days', 'ELIXIR-DEMO-829102','[DEMO]');

  -- ── A&QC AUDYTY ──────────────────────────────────────────────────────────
  insert into public.aqc_audits (product_id, inspector_id, scores, score_total, verdict, notes, recommended_price_cents, decided_at) values
    (p01, v_klient, '{"crest":10,"stitching":9,"tag":10,"fabric":9}', 38, 'pass', 'Pełna zgodność. Rekomendacja ceny wg rynku.', 235000, now()-interval '59 days'),
    (p04, v_klient, '{"crest":10,"stitching":10,"tag":9,"fabric":9}', 38, 'pass', 'Autentyk, rzadki rozmiar S.', 315000, now()-interval '51 days'),
    (p12, v_klient, '{"crest":9,"stitching":8,"tag":7,"fabric":7}',  31, 'warn', 'Ślady użytkowania większe niż w opisie kupującego.', null, now()-interval '4 days'),
    (p05, v_klient, '{}', null, null, null, null, null);

  -- ── LISTINGS + QR ────────────────────────────────────────────────────────
  insert into public.listings (product_id, current_price_cents, live_at, views_count)
  select id, listing_price_cents, published_at, (50 + (random()*400)::int)
    from public.products where id = any(array[p01,p02,p03,p04,p06,p07,p08]) and listing_price_cents is not null;
  insert into public.qr_codes (product_id, slug, scans_count, last_scanned_at) values
    (p01,'demo-real-1112', 34, now()-interval '2 days'),
    (p04,'demo-milan-0607',61, now()-interval '6 hours'),
    (p08,'demo-bvb-9697',  12, now()-interval '5 days');

  -- ── ZERR: negocjacja na AC Milan ─────────────────────────────────────────
  insert into public.offers (id, product_id, buyer_token, buyer_name, amount_cents, message, status, expires_at, created_at, is_seller_message) values
    (ofr1, p04, 'demo-buyer-1', 'Marco B.', 260000, 'Interesuje mnie od ręki, wysyłka do Mediolanu.', 'countered', now()+interval '5 days', now()-interval '2 days', false);
  insert into public.offers (id, product_id, buyer_token, buyer_name, amount_cents, message, status, parent_offer_id, expires_at, created_at, responded_at, responded_by, is_seller_message) values
    (ofr2, p04, 'demo-buyer-1', 'Marco B.', 290000, 'Możemy zejść do 2 900 — finałowa cena.', 'pending', ofr1, now()+interval '5 days', now()-interval '1 day', now()-interval '1 day', v_klient, true);

  -- ── ZWROTY / WYCOFANIA ───────────────────────────────────────────────────
  insert into public.returns (product_id, reason, fee_cents, decision_deadline, resolution, notes, initiated_by, created_at) values
    (p12, 'below_standards', 0, now()+interval '10 days', 'pending', 'Kupujący odesłał — stan niezgodny z aukcją. Czekamy na Twoją decyzję: odbiór płatny albo utylizacja.', v_klient, now()-interval '4 days'),
    (p13, 'withdraw_short_term', 4900, null, 'returned', 'Wycofanie <60 dni — opłata 5%. Odesłano kurierem.', v_klient, now()-interval '15 days');
  insert into public.wallet_transactions (klient_id, type, amount_cents, reference_id, description, created_at)
  values (v_klient,'return_fee',-4900,'PROD-'||p13::text,'Opłata za wycofanie: Chelsea Home 2012', now()-interval '15 days');

  -- ── UKS + FAKTURA ────────────────────────────────────────────────────────
  insert into public.documents (klient_id, submission_id, type, file_url, signed_at, signed_method, created_at) values
    (v_klient,'SUB-90001','umowa_komisowa','https://demo.kickback.pl/docs/umowa-SUB-90001.pdf', now()-interval '70 days','autopay', now()-interval '70 days'),
    (v_klient,'SUB-90001','umowa_ks','https://demo.kickback.pl/docs/uks-mu99.pdf', now()-interval '38 days','autopay', now()-interval '39 days'),
    (v_klient,'SUB-90001','umowa_ks','https://demo.kickback.pl/docs/uks-arsenal.pdf', null, null, now()-interval '9 days');
  insert into public.invoices (klient_id, type, file_url, invoice_number, issued_at, amount_cents, sale_product_ids, status, uploaded_at, verified_at, verified_by) values
    (v_klient,'uks','https://demo.kickback.pl/docs/uks-mu99.pdf','DEMO/UKS/09', (now()-interval '38 days')::date, 160000, array[p09], 'verified', now()-interval '38 days', now()-interval '37 days', v_klient),
    (v_klient,'uks','https://demo.kickback.pl/docs/uks-arsenal.pdf','DEMO/UKS/10', (now()-interval '9 days')::date, 176000, array[p10], 'uploaded', now()-interval '9 days', null, null);

  -- ── FULFILLMENT ──────────────────────────────────────────────────────────
  insert into public.fulfillment_orders (klient_id, product_id, buyer_name, tracking_number, carrier, shipping_cost_cents, status, shipped_at, delivered_at, created_at) values
    (v_klient, p09, 'Jan K. (Warszawa)',  'DEMO0012345678', 'DPD',    1599, 'delivered', now()-interval '39 days', now()-interval '37 days', now()-interval '40 days'),
    (v_klient, p10, 'Tomasz W. (Kraków)', 'DEMO0098765432', 'InPost', 1299, 'shipped',   now()-interval '8 days',  null,                    now()-interval '10 days'),
    (v_klient, p11, 'Piotr M. (Gdańsk)',  null,             null,     null, 'pending',   null,                     null,                    now()-interval '3 days');

  -- ── ZMIANY CEN ───────────────────────────────────────────────────────────
  insert into public.price_change_requests (product_id, requested_by, current_price_cents, suggested_price_cents, status, decided_by, decided_at, notes, created_at) values
    (p03, v_klient, 80000, 64000, 'accepted', v_klient, now()-interval '20 days', 'Obniżka po 30 dniach bez sprzedaży.', now()-interval '21 days'),
    (p06, v_klient, 145000, 130000, 'pending', null, null, 'Chcę przyspieszyć rotację.', now()-interval '2 days');

  -- ── POWIADOMIENIA (dodatkowe, poza trigger-owymi) ────────────────────────
  insert into public.notifications (user_id, type, title, body, ref_id, payload, read_at, created_at) values
    (v_klient,'aqc_complete','A&QC zakończone: Real Madryt Home 2011/12','Werdykt: PASS. Rekomendowana cena 2 350 zł.','PROD-'||p01::text,'{"demo":true}', now()-interval '58 days', now()-interval '59 days'),
    (v_klient,'offer_received','Nowa oferta: AC Milan 2006/07','Kupujący proponuje 2 600 zł (listing 3 200 zł). Odpowiedz w Zerr.','PROD-'||p04::text,'{"demo":true}', null, now()-interval '2 days'),
    (v_klient,'payout_done','Wypłata zrealizowana','1 000 zł wysłane na konto •••• 4921 (ELIXIR).','DEMO-PAYOUT-1','{"demo":true}', now()-interval '19 days', now()-interval '20 days'),
    (v_klient,'return_decision','Zwrot do decyzji: Ajax Home 1995','Kupujący odesłał produkt. Wybierz: odbiór płatny lub utylizacja (10 dni).','PROD-'||p12::text,'{"demo":true}', null, now()-interval '4 days'),
    (v_klient,'valuation_ready','Wycena gotowa: PSG i Napoli w drodze','Paczka SUB-90003 odebrana przez kuriera — wycena po dostawie.','DEMO-SUB-90003','{"demo":true}', null, now()-interval '1 day');

  -- ── ZAPOTRZEBOWANIE (widoczne dla wszystkich klientów) ───────────────────
  insert into public.demand_listings (id, kind, raw_label, season, retro, sizes, target_price_cents, notes, notes_admin, active, published_at) values
    (dem1,'club','Real Madryt','2002/03', true,  array['M','L'],      280000, 'Era Galacticos — Zidane, Ronaldo, Figo.', '[DEMO]', true, now()-interval '6 days'),
    (dem2,'national_team','Polska','EURO 2012', false, array['S','M','L','XL'], 90000, 'Gospodarze EURO — duży popyt lokalny.', '[DEMO]', true, now()-interval '3 days'),
    (dem3,'player','Robert Lewandowski','2019/20', false, array['M','L'], 150000, 'Sezon 41 goli, Bayern lub reprezentacja.', '[DEMO]', true, now()-interval '1 day');

  -- ── CO WARTO DODAĆ (picks) ───────────────────────────────────────────────
  insert into public.kickback_picks (id, title, description, category, priority, cta_label, cta_href, active, published_at, expires_at, created_by) values
    (pick1,'Polskie kluby retro 90s','Legia, Widzew, Górnik z lat 90. — rotacja poniżej 20 dni, ceny rosną.','Trend',3,'Zobacz zapotrzebowanie','/panel/zapotrzebowanie?kind=club', true, now()-interval '5 days', now()+interval '20 days', v_klient),
    (pick2,'Finały Ligi Mistrzów','Koszulki z sezonów finałowych (Milan 07, Inter 10, Chelsea 12) schodzą najszybciej.','Rzadkość',2,'Dodaj do oferty','/start', true, now()-interval '3 days', now()+interval '30 days', v_klient),
    (pick3,'Rozmiar S — deficyt','Małe rozmiary klasyków osiągają +15% vs M/L.','Sezon',1,null,null, true, now()-interval '1 day', null, v_klient);

  -- ── SNAPSHOTY MAGAZYNU (wykres analityki, 30 dni) ────────────────────────
  for d in 0..29 loop
    insert into public.inventory_snapshots (klient_id, day, total_value_cents, item_count)
    values (v_klient, (now() - (d || ' days')::interval)::date,
            1200000 + (29-d) * 21000 + (random()*40000)::int,
            7 + ((29-d)/6)::int)
    on conflict (klient_id, day) do nothing;
  end loop;

  raise notice 'Seed demo OK — klient %', v_klient;
end $$;

-- Szybka weryfikacja:
select 'produkty' as co, count(*) from public.products where id::text like 'de00%'
union all select 'wallet tx', count(*) from public.wallet_transactions where reference_id like 'PROD-de00%' or reference_id like 'DEMO-%'
union all select 'oferty Zerr', count(*) from public.offers where id::text like 'de00%'
union all select 'zwroty', count(*) from public.returns where product_id::text like 'dddddddd-%'
union all select 'dokumenty', count(*) from public.documents where file_url like 'https://demo.kickback.pl/%'
union all select 'notyfikacje', count(*) from public.notifications where ref_id like 'PROD-de00%' or ref_id like 'DEMO-%';
