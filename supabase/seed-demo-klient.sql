-- ============================================================================
-- SEED DEMO v2 — historia dla KONTA KLIENTA (do testów każdej funkcjonalności)
-- ============================================================================
-- Cel: to samo bogactwo danych co u Daniela, ale na koncie klienckim.
--
-- WYBÓR KONTA: domyślnie skrypt sam bierze konto z rolą 'klient', które
-- logowało się OSTATNIO (czyli to, na którym właśnie siedzisz).
-- Chcesz wskazać konkretne? Wpisz email w v_email_override poniżej.
--
-- Idempotentny: własna przestrzeń ID (df00xx… / SUB-91xxx) — można odpalać
-- wielokrotnie; danych Daniela (de00xx… / SUB-90xxx) nie dotyka.
-- Wymaga wcześniejszego uruchomienia seed-demo.sql (prereq DDL 012/013)
-- LUB samych migracji — prereqy i tak są tu powtórzone (idempotentne).
-- ============================================================================

-- PREREQ (idempotentne — patrz seed-demo.sql)
alter table public.products
  add column if not exists sku text,
  add column if not exists fakturownia_product_id bigint,
  add column if not exists fakturownia_pushed_at timestamptz;
create unique index if not exists products_sku_uniq on public.products(sku) where sku is not null;
create or replace function public.generate_product_sku(p_id uuid)
returns text language sql immutable as $f$
  select 'KCB-' || to_char(now(), 'YY') || '-' || upper(substr(replace(p_id::text,'-',''),1,6));
$f$;
alter table public.demand_listings
  add column if not exists sizes text[] not null default '{}',
  add column if not exists notes_admin text;

do $$
declare
  v_email_override text := null;  -- ← np. 'moj@email.pl' żeby wskazać konto ręcznie
  v_klient uuid;
  v_email  text;
  p01 uuid := 'df000100-0000-4000-a000-000000000001'; -- Real Madryt 2011/12  listed
  p02 uuid := 'df000200-0000-4000-a000-000000000002'; -- FC Barcelona 2014/15 listed
  p03 uuid := 'df000300-0000-4000-a000-000000000003'; -- Legia 2019/20        listed (po obniżce)
  p04 uuid := 'df000400-0000-4000-a000-000000000004'; -- AC Milan 2006/07     offer (Zerr)
  p05 uuid := 'df000500-0000-4000-a000-000000000005'; -- Polska EURO 2016     aqc
  p06 uuid := 'df000600-0000-4000-a000-000000000006'; -- Juventus 2011/12     listed (pending price change)
  p07 uuid := 'df000700-0000-4000-a000-000000000007'; -- Real Madryt 2016/17  listed
  p08 uuid := 'df000800-0000-4000-a000-000000000008'; -- Borussia 1996/97     listed retro
  p09 uuid := 'df000900-0000-4000-a000-000000000009'; -- Man United 1999      SOLD 40d (rozliczona)
  p10 uuid := 'df001000-0000-4000-a000-000000000010'; -- Arsenal 2003/04      SOLD 10d (karencja)
  p11 uuid := 'df001100-0000-4000-a000-000000000011'; -- Inter 2009/10        SOLD 3d  (karencja)
  p12 uuid := 'df001200-0000-4000-a000-000000000012'; -- Ajax 1995            zwrot (decyzja klienta)
  p13 uuid := 'df001300-0000-4000-a000-000000000013'; -- Chelsea 2012         wycofana (odesłana)
  p14 uuid := 'df001400-0000-4000-a000-000000000014'; -- PSG 2020/21          draft
  p15 uuid := 'df001500-0000-4000-a000-000000000015'; -- Napoli 1987/88       draft
  ofr1 uuid := 'dfdddddd-0000-4000-b000-000000000001';
  ofr2 uuid := 'dfdddddd-0000-4000-b000-000000000002';
  v_bank uuid;
  demo_products uuid[];
  d int;
begin
  -- ── wybór konta ──────────────────────────────────────────────────────────
  if v_email_override is not null then
    select u.id, u.email into v_klient, v_email
      from auth.users u where u.email = v_email_override;
  else
    select u.id, u.email into v_klient, v_email
      from auth.users u
      join public.profiles p on p.id = u.id
     where coalesce(p.role, 'klient') = 'klient'
     order by u.last_sign_in_at desc nulls last
     limit 1;
  end if;
  if v_klient is null then
    raise exception 'Nie znaleziono konta klienta. Ustaw v_email_override.';
  end if;
  raise notice 'Seeduje konto: % (%)', v_email, v_klient;

  -- konto musi być po onboardingu, inaczej panel przekieruje na /onboarding
  update public.profiles
     set onboarded_at = coalesce(onboarded_at, now() - interval '75 days'),
         account_type = coalesce(account_type, 'individual'),
         first_name   = coalesce(first_name, 'Klient'),
         last_name    = coalesce(last_name, 'Testowy')
   where id = v_klient;

  -- konto bankowe do wypłat (jeśli brak)
  select id into v_bank from public.bank_accounts where klient_id = v_klient limit 1;
  if v_bank is null then
    insert into public.bank_accounts (klient_id, bank_name, iban, is_default)
    values (v_klient, 'mBank', 'PL61109010140000071219812874', true)
    returning id into v_bank;
  end if;

  demo_products := array[p01,p02,p03,p04,p05,p06,p07,p08,p09,p10,p11,p12,p13,p14,p15];

  -- ── CLEANUP poprzedniego przebiegu v2 ────────────────────────────────────
  delete from public.wallet_transactions
   where (reference_id like 'PROD-df00%' or reference_id like 'DEMO2-%');
  delete from public.notifications
   where (ref_id like 'PROD-df00%' or ref_id like 'DEMO2-%' or payload @> '{"demo2":true}');
  delete from public.payouts   where notes = '[DEMO2]';
  delete from public.invoices  where invoice_number like 'DEMO2/%';
  delete from public.documents where file_url like 'https://demo2.kickback.pl/%';
  delete from public.fulfillment_orders where tracking_number like 'DEMO2%';
  delete from public.inventory_snapshots where klient_id = v_klient;
  delete from public.products    where id = any(demo_products);
  delete from public.submissions where id in ('SUB-91001','SUB-91002','SUB-91003');

  -- ── SUBMISSIONS ──────────────────────────────────────────────────────────
  insert into public.submissions (id, klient_id, status, signed_at, signed_method, commission_rate, created_by, created_at, updated_at) values
    ('SUB-91001', v_klient, 'listed',     now() - interval '70 days', 'autopay', 0.20, v_klient, now() - interval '70 days', now() - interval '3 days'),
    ('SUB-91002', v_klient, 'listed',     now() - interval '30 days', 'pz',      0.20, v_klient, now() - interval '30 days', now() - interval '5 days'),
    ('SUB-91003', v_klient, 'in_transit', now() - interval '3 days',  'autopay', 0.20, v_klient, now() - interval '3 days',  now() - interval '1 day');

  -- ── PRODUCTS ─────────────────────────────────────────────────────────────
  insert into public.products
    (id, submission_id, brand, model, category, size, condition, description,
     expected_price_cents, min_price_cents, listing_price_cents, status, photos,
     vat_rate, published_at, sku, created_at, updated_at) values
    (p01,'SUB-91001','Real Madryt','Home 2011/12','koszulka','L',9,'Ronaldo era. Oryginalne loty, stan bardzo dobry.',
     250000,200000,240000,'listed','[]',0.230, now()-interval '58 days', public.generate_product_sku(p01), now()-interval '70 days', now()-interval '6 days'),
    (p02,'SUB-91001','FC Barcelona','Home 2014/15','koszulka','M',8,'Tripleta MSN. Drobne zmechacenia.',
     200000,160000,189000,'listed','[]',0.230, now()-interval '55 days', public.generate_product_sku(p02), now()-interval '70 days', now()-interval '12 days'),
    (p03,'SUB-91001','Legia Warszawa','Home 2019/20','koszulka','XL',7,'Edycja mistrzowska.',
     80000,55000,64000,'listed','[]',0.080, now()-interval '52 days', public.generate_product_sku(p03), now()-interval '70 days', now()-interval '20 days'),
    (p04,'SUB-91001','AC Milan','Home 2006/07','koszulka','S',9,'Kaka #22, finał Aten. Rzadki rozmiar.',
     330000,280000,320000,'offer','[]',0.230, now()-interval '50 days', public.generate_product_sku(p04), now()-interval '70 days', now()-interval '2 days'),
    (p05,'SUB-91002','Polska','EURO 2016','koszulka','M',6,'Wymaga weryfikacji stanu C.',
     50000,35000,null,'aqc','[]',0.000, null, public.generate_product_sku(p05), now()-interval '30 days', now()-interval '7 days'),
    (p06,'SUB-91001','Juventus','Home 2011/12','koszulka','L',8,'Del Piero, ostatni sezon.',
     160000,120000,145000,'listed','[]',0.230, now()-interval '48 days', public.generate_product_sku(p06), now()-interval '70 days', now()-interval '4 days'),
    (p07,'SUB-91002','Real Madryt','Away 2016/17','koszulka','M',9,'La Duodécima.',
     220000,180000,210000,'listed','[]',0.230, now()-interval '25 days', public.generate_product_sku(p07), now()-interval '30 days', now()-interval '25 days'),
    (p08,'SUB-91002','Borussia Dortmund','Home 1996/97','koszulka','L',8,'Retro, era Sammera. Kolekcjonerska.',
     300000,240000,275000,'listed','[]',0.230, now()-interval '22 days', public.generate_product_sku(p08), now()-interval '30 days', now()-interval '22 days'),
    (p09,'SUB-91001','Manchester United','Home 1999','koszulka','XL',9,'Treble. Beckham #7.',
     210000,170000,200000,'listed','[]',0.230, now()-interval '65 days', public.generate_product_sku(p09), now()-interval '70 days', now()-interval '65 days'),
    (p10,'SUB-91001','Arsenal','Home 2003/04','koszulka','M',9,'Invincibles. Henry #14.',
     230000,190000,220000,'listed','[]',0.230, now()-interval '60 days', public.generate_product_sku(p10), now()-interval '70 days', now()-interval '60 days'),
    (p11,'SUB-91002','Inter Mediolan','Home 2009/10','koszulka','L',8,'Potrójna korona Mourinho.',
     170000,130000,160000,'listed','[]',0.230, now()-interval '24 days', public.generate_product_sku(p11), now()-interval '30 days', now()-interval '24 days'),
    (p12,'SUB-91002','Ajax','Home 1995','koszulka','M',7,'Finał Wiednia. Zwrot od kupującego — do decyzji.',
     310000,250000,290000,'returned','[]',0.230, now()-interval '20 days', public.generate_product_sku(p12), now()-interval '30 days', now()-interval '4 days'),
    (p13,'SUB-91001','Chelsea','Home 2012','koszulka','S',8,'Monachium. Wycofana na życzenie klienta.',
     110000,80000,98000,'withdrawn','[]',0.230, now()-interval '45 days', public.generate_product_sku(p13), now()-interval '70 days', now()-interval '15 days'),
    (p14,'SUB-91003','PSG','Home 2020/21','koszulka','M',9,'Nowa oferta — w drodze do magazynu.',
     140000,100000,null,'draft','[]',0.230, null, public.generate_product_sku(p14), now()-interval '3 days', now()-interval '3 days'),
    (p15,'SUB-91003','Napoli','Home 1987/88','koszulka','L',7,'Era Maradony — do wyceny.',
     420000,350000,null,'draft','[]',0.230, null, public.generate_product_sku(p15), now()-interval '3 days', now()-interval '3 days');

  -- ── SPRZEDAŻE przez UPDATE (produkcyjne triggery) ────────────────────────
  update public.products set status='sold', sold_at=now()-interval '40 days' where id=p09;
  update public.products set status='sold', sold_at=now()-interval '10 days' where id=p10;
  update public.products set status='sold', sold_at=now()-interval '3 days'  where id=p11;

  update public.wallet_transactions set created_at=now()-interval '40 days', available_at=now()-interval '26 days', type='sale_unlocked'
   where klient_id=v_klient and reference_id='PROD-'||p09::text;
  update public.wallet_transactions set created_at=now()-interval '10 days', available_at=now()+interval '4 days'
   where klient_id=v_klient and reference_id='PROD-'||p10::text;
  update public.wallet_transactions set created_at=now()-interval '3 days',  available_at=now()+interval '11 days'
   where klient_id=v_klient and reference_id='PROD-'||p11::text;
  update public.notifications set created_at=now()-interval '40 days' where user_id=v_klient and ref_id='PROD-'||p09::text;
  update public.notifications set created_at=now()-interval '10 days' where user_id=v_klient and ref_id='PROD-'||p10::text;
  update public.notifications set created_at=now()-interval '3 days'  where user_id=v_klient and ref_id='PROD-'||p11::text;

  -- ── WYPŁATA zrealizowana ─────────────────────────────────────────────────
  insert into public.wallet_transactions (klient_id, type, amount_cents, reference_id, description, created_at)
  values (v_klient,'payout_done',-100000,'DEMO2-PAYOUT-1','Wypłata na konto •••• 2874', now()-interval '20 days');
  insert into public.payouts (klient_id, amount_cents, bank_account_id, status, requested_at, authorized_at, executed_at, bank_ref, notes)
  values (v_klient, 100000, v_bank, 'done', now()-interval '21 days', now()-interval '20 days', now()-interval '20 days', 'ELIXIR-DEMO2-829102','[DEMO2]');

  -- ── A&QC ─────────────────────────────────────────────────────────────────
  insert into public.aqc_audits (product_id, inspector_id, scores, score_total, verdict, notes, recommended_price_cents, decided_at) values
    (p01, null, '{"crest":10,"stitching":9,"tag":10,"fabric":9}', 38, 'pass', 'Pełna zgodność. Rekomendacja ceny wg rynku.', 235000, now()-interval '59 days'),
    (p04, null, '{"crest":10,"stitching":10,"tag":9,"fabric":9}', 38, 'pass', 'Autentyk, rzadki rozmiar S.', 315000, now()-interval '51 days'),
    (p12, null, '{"crest":9,"stitching":8,"tag":7,"fabric":7}',  31, 'warn', 'Ślady użytkowania większe niż w opisie kupującego.', null, now()-interval '4 days'),
    (p05, null, '{}', null, null, null, null, null);

  -- ── LISTINGS + QR ────────────────────────────────────────────────────────
  insert into public.listings (product_id, current_price_cents, live_at, views_count)
  select id, listing_price_cents, published_at, (50 + (random()*400)::int)
    from public.products where id = any(array[p01,p02,p03,p04,p06,p07,p08]) and listing_price_cents is not null;
  insert into public.qr_codes (product_id, slug, scans_count, last_scanned_at) values
    (p01,'demo2-real-1112', 34, now()-interval '2 days'),
    (p04,'demo2-milan-0607',61, now()-interval '6 hours'),
    (p08,'demo2-bvb-9697',  12, now()-interval '5 days');

  -- ── ZERR ─────────────────────────────────────────────────────────────────
  insert into public.offers (id, product_id, buyer_token, buyer_name, amount_cents, message, status, expires_at, created_at, is_seller_message) values
    (ofr1, p04, 'demo2-buyer-1', 'Marco B.', 260000, 'Interesuje mnie od ręki, wysyłka do Mediolanu.', 'countered', now()+interval '5 days', now()-interval '2 days', false);
  insert into public.offers (id, product_id, buyer_token, buyer_name, amount_cents, message, status, parent_offer_id, expires_at, created_at, responded_at, responded_by, is_seller_message) values
    (ofr2, p04, 'demo2-buyer-1', 'Marco B.', 290000, 'Możemy zejść do 2 900 — finałowa cena.', 'pending', ofr1, now()+interval '5 days', now()-interval '1 day', now()-interval '1 day', v_klient, true);

  -- ── ZWROTY / WYCOFANIA ───────────────────────────────────────────────────
  insert into public.returns (product_id, reason, fee_cents, decision_deadline, resolution, notes, initiated_by, created_at) values
    (p12, 'below_standards', 0, now()+interval '10 days', 'pending', 'Kupujący odesłał — stan niezgodny z aukcją. Wybierz: odbiór płatny albo utylizacja.', v_klient, now()-interval '4 days'),
    (p13, 'withdraw_short_term', 4900, null, 'returned', 'Wycofanie <60 dni — opłata 5%. Odesłano kurierem.', v_klient, now()-interval '15 days');
  insert into public.wallet_transactions (klient_id, type, amount_cents, reference_id, description, created_at)
  values (v_klient,'return_fee',-4900,'PROD-'||p13::text,'Opłata za wycofanie: Chelsea Home 2012', now()-interval '15 days');

  -- ── UKS + FAKTURA ────────────────────────────────────────────────────────
  insert into public.documents (klient_id, submission_id, type, file_url, signed_at, signed_method, created_at) values
    (v_klient,'SUB-91001','umowa_komisowa','https://demo2.kickback.pl/docs/umowa-SUB-91001.pdf', now()-interval '70 days','autopay', now()-interval '70 days'),
    (v_klient,'SUB-91001','umowa_ks','https://demo2.kickback.pl/docs/uks-mu99.pdf', now()-interval '38 days','autopay', now()-interval '39 days'),
    (v_klient,'SUB-91001','umowa_ks','https://demo2.kickback.pl/docs/uks-arsenal.pdf', null, null, now()-interval '9 days');
  insert into public.invoices (klient_id, type, file_url, invoice_number, issued_at, amount_cents, sale_product_ids, status, uploaded_at, verified_at, verified_by) values
    (v_klient,'uks','https://demo2.kickback.pl/docs/uks-mu99.pdf','DEMO2/UKS/09', (now()-interval '38 days')::date, 160000, array[p09], 'verified', now()-interval '38 days', now()-interval '37 days', null),
    (v_klient,'uks','https://demo2.kickback.pl/docs/uks-arsenal.pdf','DEMO2/UKS/10', (now()-interval '9 days')::date, 176000, array[p10], 'uploaded', now()-interval '9 days', null, null);

  -- ── FULFILLMENT ──────────────────────────────────────────────────────────
  insert into public.fulfillment_orders (klient_id, product_id, buyer_name, tracking_number, carrier, shipping_cost_cents, status, shipped_at, delivered_at, created_at) values
    (v_klient, p09, 'Jan K. (Warszawa)',  'DEMO20012345678', 'DPD',    1599, 'delivered', now()-interval '39 days', now()-interval '37 days', now()-interval '40 days'),
    (v_klient, p10, 'Tomasz W. (Kraków)', 'DEMO20098765432', 'InPost', 1299, 'shipped',   now()-interval '8 days',  null,                    now()-interval '10 days'),
    (v_klient, p11, 'Piotr M. (Gdańsk)',  null,              null,     null, 'pending',   null,                     null,                    now()-interval '3 days');

  -- ── ZMIANY CEN ───────────────────────────────────────────────────────────
  insert into public.price_change_requests (product_id, requested_by, current_price_cents, suggested_price_cents, status, decided_by, decided_at, notes, created_at) values
    (p03, v_klient, 80000, 64000, 'accepted', null, now()-interval '20 days', 'Obniżka po 30 dniach bez sprzedaży.', now()-interval '21 days'),
    (p06, v_klient, 145000, 130000, 'pending', null, null, 'Chcę przyspieszyć rotację.', now()-interval '2 days');

  -- ── POWIADOMIENIA ────────────────────────────────────────────────────────
  insert into public.notifications (user_id, type, title, body, ref_id, payload, read_at, created_at) values
    (v_klient,'aqc_complete','A&QC zakończone: Real Madryt Home 2011/12','Werdykt: PASS. Rekomendowana cena 2 350 zł.','PROD-'||p01::text,'{"demo2":true}', now()-interval '58 days', now()-interval '59 days'),
    (v_klient,'offer_received','Nowa oferta: AC Milan 2006/07','Kupujący proponuje 2 600 zł (listing 3 200 zł). Odpowiedz w Zerr.','PROD-'||p04::text,'{"demo2":true}', null, now()-interval '2 days'),
    (v_klient,'payout_done','Wypłata zrealizowana','1 000 zł wysłane na konto •••• 2874 (ELIXIR).','DEMO2-PAYOUT-1','{"demo2":true}', now()-interval '19 days', now()-interval '20 days'),
    (v_klient,'return_decision','Zwrot do decyzji: Ajax Home 1995','Kupujący odesłał produkt. Wybierz: odbiór płatny lub utylizacja (10 dni).','PROD-'||p12::text,'{"demo2":true}', null, now()-interval '4 days'),
    (v_klient,'valuation_ready','Wycena gotowa: PSG i Napoli w drodze','Paczka SUB-91003 odebrana przez kuriera — wycena po dostawie.','DEMO2-SUB-91003','{"demo2":true}', null, now()-interval '1 day');

  -- ── SNAPSHOTY MAGAZYNU ───────────────────────────────────────────────────
  for d in 0..29 loop
    insert into public.inventory_snapshots (klient_id, day, total_value_cents, item_count)
    values (v_klient, (now() - (d || ' days')::interval)::date,
            1200000 + (29-d) * 21000 + (random()*40000)::int,
            7 + ((29-d)/6)::int)
    on conflict (klient_id, day) do nothing;
  end loop;

  raise notice 'Seed v2 OK — konto % (%)', v_email, v_klient;
end $$;

-- Weryfikacja: na jakie konto poszło + liczby
select 'konto' as co, (select u.email from auth.users u join public.submissions s on s.klient_id=u.id where s.id='SUB-91001') as ile
union all select 'produkty', count(*)::text from public.products where id::text like 'df00%'
union all select 'wallet tx', count(*)::text from public.wallet_transactions where reference_id like 'PROD-df00%' or reference_id like 'DEMO2-%'
union all select 'zwroty', count(*)::text from public.returns where product_id::text like 'df00%'
union all select 'dokumenty', count(*)::text from public.documents where file_url like 'https://demo2.kickback.pl/%';
