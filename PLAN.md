# Panel Komisowy — Plan Działania

Dokument: 2026-05-04 · Stan: AKCEPTOWANY (2026-05-04, design language: Revolut)

## Design language: Revolut

- **Tło:** głęboka czerń `#0A0B10` (lekkie wpadnięcie w niebieski)
- **Surface:** `#13141A` (cards), `#1B1D26` (elevated)
- **Border subtle:** `#252834`
- **Text:** primary `#F5F5F8`, soft `#A8AAB8`, mute `#6B6E7E`
- **Akcent #1 (primary CTA):** Revolut electric blue `#0066FF`
- **Akcent #2 (gradient feature):** vivid purple `#9358FF` → hot pink `#FF3D71`
- **Akcent #3 (success / Funds):** mint `#00D29F`
- **Akcent #4 (warning):** orange `#FF8A3D`
- **Typografia:** Inter Display (headlines, weights 500–800) + Inter (body) + Geist Mono (numerical, IDs)
- **Radius:** 16px na cardach, 12px na buttonach, 24px na hero
- **Style:** big bold numerical displays z tabular nums, gradient feature cards, mobile-first feel, generous touch targets (≥44px), płynne animacje (transform + opacity only)

Wszystkie 9 ekranów z brief'u dostają ten język.

---

## 0. Diagnoza — gdzie jesteśmy

**Co jest:**
- 9 stron HTML w `sites/panel-komisowy/` (landing, start, panel, panel/wallet, panel/submissions, panel/notifications, admin, admin/aqc, admin/pricing)
- Po ostatnim redesign'u landing ma czysty, profesjonalny design language (cream paper + deep forest green + Fraunces/Inter)

**Co NIE działa:**
- Buttony nigdzie nie prowadzą realnie (poza linkami między stronami)
- Formy nie zapisują niczego
- Filtry nie filtrują, sortowanie nie sortuje
- "Wypłać", "Akceptuj ofertę", "Wyślij wiadomość" — same buttonów, brak logiki
- Stan nie persystuje (odświeżenie = reset)
- Brak auth, brak DB, brak userów, brak ról, brak RLS
- Brak Autopay, Profil Zaufany, banku, DPD, VAT FV
- A&QC, Wallet, Notyfikacje, Statystyki — wszystko hard-coded mock data

**Wniosek:** To pokazówka designu, nie produkt. Czas pivot na realny stack.

---

## 1. Decyzja architektoniczna

**Pełen pivot na real stack: Next.js 15 (App Router) + Supabase.**

Folder `sites/panel-komisowy/` przestaje być static HTML — staje się Next.js'em. Stary kod zachowuję w gałęzi `static-prototype` jako referencja designu.

**Dlaczego ten stack:**
- **Next.js 15 App Router** — server components + server actions = mniej kodu, type-safe data fetching, streaming UI
- **Supabase** — Postgres + Auth + Storage + Realtime + RLS w jednym, zero ops, Polish friendly
- **Realtime Supabase** — kluczowy dla negocjacji Zerr (klient ↔ kupujący na żywo)
- **RLS** — egzekwuje "klient1 widzi tylko swoje submissions, admin widzi wszystko" na poziomie bazy
- **Storage signed URLs** — bezpieczny upload zdjęć produktów + skanów Umów K-S / FV
- **Same TS** — type-safe end-to-end, wsp. z DANIELOS

**Co zachowuję ze static:**
- Cały design system (paleta, typografia, layout, komponenty)
- Wszystkie ekrany jako visual reference do React komponentów

---

## 2. Stack

| Warstwa | Technologia | Po co |
|---|---|---|
| Framework | Next.js 15 App Router | SSR + RSC + server actions + file-based routing |
| Język | TypeScript strict | type safety |
| DB / Auth / Storage / Realtime | Supabase | wszystko w jednym, Postgres + RLS |
| Styling | Tailwind CSS v4 + custom tokens | spójność z aktualnym redesign'em |
| UI primitives | shadcn/ui (Radix + Tailwind) | dostępność + customizacja |
| Forms | React Hook Form + Zod | walidacja, type-safe |
| Email transakcyjne | Resend | sygnup, sale, payout, return |
| PDF | @react-pdf/renderer | etykiety nadania DPD, Umowy Komisowe, Umowy K-S, FV |
| QR codes | qrcode | metki produktów (Zerr scan) |
| Realtime negocjacje | Supabase Realtime channels | offer thread klient ↔ buyer |
| Schedule jobs | Supabase Edge Functions (cron) | sugestie redukcji ceny, 14d karencja |
| Deploy | Vercel + Supabase Cloud | preview per PR, prod deploy |
| Testy E2E | Playwright | flow kompletna od signup do wypłaty |

---

## 3. Schemat bazy (high-level)

```
auth.users (Supabase managed)
└── profiles (1:1)
    ├── role: 'klient' | 'admin' | 'super_admin'
    ├── account_type: 'individual' | 'business'
    ├── individual: {first_name, last_name, pesel/dowod, phone, address}
    └── business:   {company, nip, vat_id, regon, address}

submissions (= Umowa Komisowa)
├── id (format SUB-XXXXX, jednoczesnie numer umowy)
├── klient_id → profiles
├── status: draft|signed|in_transit|aqc|listed|sold|payout|withdrawn|returned
├── signed_at, signed_method (autopay|pz|admin), signed_ip
├── shipping_label_url (Storage)
├── contract_pdf_url (Storage)
├── commission_rate (default 0.20)
└── created_by (klient lub admin który stworzył w imieniu)

products (1:N submissions)
├── submission_id, brand, model, category, size, condition (1-10)
├── description
├── expected_price_cents, min_price_cents, listing_price_cents
├── status: draft|aqc|listed|offer|sold|withdrawn|returned
├── photos[] (Storage refs)
└── current_listing_started_at

aqc_audits (1:1 product)
├── product_id, inspector_id (admin)
├── score_total (0-120), verdict: pass|warn|fail
├── scores: jsonb {stitching, leather, hardware, logo, lining, heat_stamp, strap, box, tags, dust_bag, accessories, congruence}
├── notes, recommended_price_cents
└── decided_at

listings (channel × product)
├── product_id, channel, current_price_cents, deactivated_at

offers (Zerr negotiations)
├── listing_id, buyer_anon_id (cookie token), seller_id (klient), admin_id (jeśli targuje za klienta)
├── amount_cents, message, status: pending|accepted|countered|rejected|expired
├── parent_offer_id (chain)
└── expires_at

sales
├── product_id, listing_id, buyer_id (klient2 lub anon), final_price_cents
├── sold_at, vat_invoice_url
└── settlement_due_at (sold_at + 14d karencja)

wallet_transactions (append-only ledger)
├── klient_id, type: sale_pending|sale_unlocked|payout_request|payout_done|return_fee|deposit_topup
├── amount_cents (signed: + wpływ, − wypłata)
├── reference_id (SUB-/SALE-/PAY-)
├── available_at (gdy karencja kończy)
└── created_at

documents
├── klient_id, sale_id (opcjonalny), type: umowa_komisowa|umowa_ks|faktura
├── file_url (Storage signed)
├── signed_at, signed_method
└── uploaded_by (klient lub admin)

notifications
├── user_id, type: sale|valuation_ready|offer|payout|return|reduction_suggestion|...
├── ref_id (SUB-/PROD-/OFFER-/...)
├── read_at, payload jsonb (np. cena, kupujący)
└── channels: email|push|sms|in_app

payouts
├── klient_id, amount_cents, bank_iban, status: requested|authorized|executing|done|failed
├── requested_at, authorized_by (admin), authorized_at
└── santander_ref (gdy real bank)

returns
├── product_id, reason: not_authentic|damaged|below_standards|client_rejection|withdraw_<3m|withdraw_>3m
├── fee_cents, decision_deadline
└── resolution: pickup_paid|disposal_free|escalated

qr_codes
├── product_id, slug (URL-safe), scans_count
└── last_scanned_at
```

**Pieniądze:** wszystko jako `*_cents` (integer, grosze PLN). Wallet balance to suma `wallet_transactions.amount_cents` per `klient_id` (materialized view albo computed).

**Numer Submission = Numer Umowy:** tożsame, używane w UI wszędzie. Format `SUB-08412`.

---

## 4. Mapa brief → deliverables

Każdy podpunkt z brief'u Kickback → konkretny ekran / flow / feature:

### Panel komisowy (entry + flows)

| Brief | Deliverable |
|---|---|
| Przejście z głównej do panelu via "Sell with us / Sprzedawaj z nami" + baner | Landing `/` z primary CTA + dedykowany banner section. Klik → `/start` (lub `/login` jeśli nie zalogowany) |
| Podpis Umowy Komisowej via Autopay (Numer Submission = Numer umowy) | `/start/contract` z mock Autopay flow (sesja 2). Real OAuth Autopay w Phase 4. Każda submission = nowy `submissions` rekord, `id` formatu `SUB-XXXXX` używany w UI jako numer umowy |
| Wypełnienie + auto-gen Submission + etykiety Ship to us | `/start/products` (multi-product form RHF + Zod). Server action: zapisuje do DB, generuje PDF etykiety DPD (`@react-pdf/renderer`), generuje contract PDF, wysyła email |
| Submissions w panelu klienta | `/panel/submissions` — lista z DB, status timeline, filtr po statusie |
| My Sales w panelu — statusy operacyjne + uzasadnienia A&QC + posprzedażowe | `/panel/my-sales` — produkty ze wszystkich submission. Drilldown `/panel/products/[id]` pokazuje pełen A&QC raport (12 punktów + verdict + notatka inspektora), historię ofert, sprzedaż |
| Submission tworzona przez admina dla klienta | `/admin/submissions/new?klient=X` — admin role pobiera dane klienta i tworzy submission w jego imieniu (audit log: `created_by = admin_id`) |
| Akceptacja wyceny | Server action `accept_valuation(product_id)` — zmienia status `aqc → listed`, ustawia `listing_price = recommended_price` |
| Redukcja ceny przez klienta | Server action `reduce_price(product_id, new_price)` — walidacja: nie poniżej `min_price`. Notyfikacja kupujących z watchlisty |
| Statystyki sprzedaży + cena po prowizji | View `client_stats` agreguje sprzedaż / wycena / czas. Per-row computed `take_home = listing_price * (1 - commission_rate)` widoczny obok listing_price |
| Sugestie redukcji (algorytm + email) | Edge Function cron co 24h: produkty `listed` > 21d bez ofert → tworzy notyfikację z sugestią P50 z porównywalnych. Email via Resend |
| Targowanie z kupującym (Zerr) | `/panel/offers/[id]` — Realtime thread (Supabase channel `offer:${id}`). Buyer widzi `/o/[token]` (anonimowo, cookie). Przyciski: Akceptuj / Kontruj (z polem kwoty) / Odrzuć |
| Wyciągnięcie rzeczy na żądanie | `/panel/products/[id]/withdraw` — wybór z 6 powodów polityki, kalkulator opłaty, server action tworzy `returns` rekord, lock produktu |

### Panel klienta

| Brief | Deliverable |
|---|---|
| Panel komisowy (ogólne) | Layout `/panel/*` z left rail (Submissions / My Sales / Wallet / Notyfikacje / Statystyki / Ustawienia) |
| Submissions | `/panel/submissions` — lista + drilldown |
| Wallet | `/panel/wallet` — balance + ledger + withdrawal flow |
| Powiadomienia o statusach | `/panel/notifications` — DB-backed, real-time append, mark-as-read, kanały (email/SMS/push/in-app) |
| Statystyki sprzedaży | `/panel/stats` — agregaty (GMV, % konwersji, średni czas, top brands) |

### Wallet (depozyt środków)

| Brief | Deliverable |
|---|---|
| Środki za sprzedane → bezpośrednio do Wallet | Trigger DB: insert do `sales` → insert do `wallet_transactions(type=sale_pending)`. Po 14d edge function flips do `sale_unlocked` |
| Funds = ekwiwalent PLN do wypłaty | Display: balance dostępny vs. pending |
| Historia wpływów + wypłat | `/panel/wallet/history` — pełna ledger z filtrem |
| Klient sam decyduje o wypłacie | `/panel/wallet/withdraw` — kwota slider/input + wybór konta z `bank_accounts`, walidacja przeciw available |
| Upload Umowy K-S (osoba fizyczna) → odblokowanie Funds | `/panel/sales/[id]/document` — Supabase Storage signed upload, `documents.signed_at` ustawiane (mock auto-sign w Phase 1; real Autopay/PZ w Phase 4). Trigger: insert do `wallet_transactions(type=sale_unlocked)` |
| Upload FV (firma) → odblokowanie Funds | jw. ale `documents.type=faktura`. Pole NIP weryfikowane |
| Środki na subkoncie banku, wypłaty na konto klienta | Phase 1: metadata only (`subaccount_balance` lustro). Phase 4: Santander Multibanking API |

### Dodatkowe funkcjonalności

| Brief | Deliverable |
|---|---|
| Autoryzacja Umów / Aneksów / K-S przez Autopay/PZ | Wszędzie gdzie umowa: mock dialog "Wybierz metodę: Autopay / Profil zaufany" → 3-sec spinner → `signed_at` ustawiane (Phase 1). Phase 4: real OAuth |
| Konta indywidualne i biznesowe | Onboarding step "Wybierz typ konta", warunkowe pola (PESEL vs NIP) |
| Redukcja ceny przez komisanta | `/admin/products/[id]/price` — admin może redukować bez konsultacji klienta (z notyfikacją) |
| Wyciąganie rzeczy za opłatą — 6 polityk | enum `return_reason` + cennik (wbudowany lub konfigurowany w `/admin/config`) |
| Sugestie redukcji ceny (web + email) | jw. cron edge function |
| Authentication & QC | `/admin/aqc/[id]` — 12-punktowy form, photo annotator (canvas + markers), score calculator, verdict button |
| Zerr — panel licytowania | `/panel/offers/[id]` + `/admin/offers` — dwustronny widok |
| Generator QR do ceny na metce | `/admin/products/[id]/qr` — generuje PNG (200×200 + label) + PDF (A6 etykieta drukowalna). Link `kickback.pl/q/[slug]` → `/q/[slug]/page.tsx` (klient2 widzi produkt + button "Złóż ofertę" otwierający Zerr flow) |
| Panel komunikacyjny powiadomień admin (Payout/Wycena/Sprzedaż/Wyciągnięcie/Zwrot) | `/admin/inbox` — agreguje wszystkie typy notifications dla admin role |
| Numer Submission = Numer umowy | jw. — `submissions.id` jako contract number |
| Administracja każdej funkcji | Admin role + RLS bypass policy + dedykowane `/admin/...` endpoints + audit log |

### Model konsygnacji (z brief'u)

| Brief | Implementacja |
|---|---|
| Klient1 powierza, własność klient1, magazyn Kickback | `submissions.status` flow: signed → in_transit → aqc → listed |
| Kickback fiskalizuje sprzedaż klient2 (B2C, nie P2P) | `sales.buyer_id` może być klient lub anon, zawsze faktura wystawiana przez Kickback |
| 14 dni karencja po sprzedaży | `sales.settlement_due_at = sold_at + 14d`, edge function flips wallet_transactions |
| Odblokowanie środków po Umowie K-S / FV | Trigger po `documents.signed_at` set |
| Wypłata na konto lub depozyt | Klient decyduje w `/panel/wallet/withdraw` — wypłaca część/całość, reszta zostaje |
| Klient indywidualny → tylko PESEL/Dowód · Biznesowy → NIP/VAT | walidacja w onboardingu i przy podpisie |

---

## 5. Plan po sesjach (10 sesji, każda = działający feature)

Każda sesja kończy się commitem i deploy preview na Vercel. Możesz testować inkrementalnie.

### Sesja 1 — Foundation (Next.js + Supabase + auth + landing)
- `npx create-next-app@latest` w `sites/panel-komisowy` (przebudowuję ten folder)
- Tailwind v4 + design tokens (cream + forest) + Inter/Fraunces
- Supabase project (cloud) + types codegen
- Schema migration: `profiles`, RLS policies bazowe
- Auth: signup, login, logout, password reset (UI + Supabase Auth)
- Onboarding: typ konta + dane osobowe/firmowe → `profiles` insert
- Port landing page jako React/RSC (zachowuję obecny design)
- `/login`, `/register`, `/onboarding` routes
- Vercel deploy preview link
- `gh repo` aktualizacja README z dev workflow
- **Test:** zarejestruj konto, zaloguj się, wypełnij profil, wyloguj. Wszystko persystuje w DB.

### Sesja 2 — Submission flow E2E
- `/start` multi-step form (Wybór konta jeśli nie z onboardingu → Dane → Mock Autopay/PZ → Produkty → Potwierdzenie)
- React Hook Form + Zod walidacja każdego kroku
- Multi-product subform z Storage upload (zdjęcia)
- Server action: `create_submission()` — generuje SUB-XXXXX, zapisuje do DB
- Server action: `generate_shipping_label(submission_id)` — `@react-pdf/renderer` generuje PDF DPD
- Server action: `generate_contract(submission_id)` — PDF Umowy Komisowej z danymi klienta
- Resend email: "Twoja Submission SUB-08412 jest gotowa"
- **Test:** wypełnij submission z 2 produktami, zdjęciami, dostań numer + dwa PDFy, email.

### Sesja 3 — Client panel: Submissions + My Sales
- Layout `/panel` z left rail (real component)
- `/panel/submissions` — lista z DB, filtr per status
- `/panel/submissions/[id]` — drilldown z timeline progress
- `/panel/my-sales` — wszystkie produkty (across submissions), filtr (Listed/Sold/A&QC/Offer)
- `/panel/products/[id]` — pełen detal produktu + A&QC raport
- Prawdziwe filtry po DB (URL params + RSC)
- **Test:** widzę swoje submissions ze statusami, klikam produkt — szczegóły działają.

### Sesja 4 — Wallet + Notifications + Stats
- `/panel/wallet` — balance (server-computed) + ledger transactions
- `/panel/wallet/withdraw` — flow: kwota + bank_account → tworzy `payouts(status=requested)` + lock dostępnego balance
- `/panel/sales/[id]/document` — upload Umowy K-S / FV (Storage signed URL) + mock auto-sign trigger → odblok Funds
- `/panel/notifications` — DB-backed list, mark-as-read, filtry, preferencje (kanały)
- `/panel/stats` — agregaty per klient (GMV, średnia cena, konwersja)
- Realtime subscription: nowe notyfikacje pojawiają się bez refresh
- **Test:** widzę 7 240 zł, klikam wypłać — flow zaczyna się, upload FV — Funds odblokowane.

### Sesja 5 — Admin panel: Queue + Submissions + Klienci
- Layout `/admin` z role-gate (admin only)
- `/admin` — operacyjny queue (SLA pillami) z agregowanych źródeł (A&QC pending, oferty czekające, payouts do autoryzacji, zwroty)
- `/admin/submissions` — wszystkie z filtr per status, search po SUB-/marka/klient
- `/admin/submissions/new` — kreator submission per klient (wybór klienta z autocomplete)
- `/admin/klienci` — lista, drilldown profilu, historia
- Audit log table + każda admin action loguje się
- **Test:** loguje się jako admin, widzę queue 42 sprawy, otwieram klienta, tworzę submission w jego imieniu.

### Sesja 6 — A&QC inspekcja + Pricing reduction + Polityka zwrotów
- `/admin/aqc/[id]` — 12-punktowy form z scoringiem, verdict (pass/warn/fail), notatka
- Photo annotator (canvas + click to drop marker, save jako jsonb)
- Server action: `complete_aqc(product_id, scores, verdict, recommended_price)` → notyfikacja klienta
- `/admin/products/[id]/price` — admin redukuje cenę, log + notyfikacja
- `/admin/returns` — lista czekających, drilldown z formularzem decyzji (6 powodów + opłata)
- Server action `decide_return()` → flow: lock produkt, wystaw fakturę za opłatę (jeśli jest), notyfikacja klienta
- **Test:** admin robi A&QC z 12 ocenami, wystawia werdykt, klient dostaje notyfikację z wyceną.

### Sesja 7 — Zerr negotiations + Realtime
- Tabela `offers` + flow buyera (anonimowy z cookie token via `/o/[token]`)
- `/panel/offers/[id]` — thread klient ↔ buyer z Realtime (Supabase channel)
- `/admin/offers/[id]` — admin może targować w imieniu klienta
- Server actions: `accept_offer`, `counter_offer`, `reject_offer`
- Walidacja: klient nie może akceptować poniżej `min_price`
- Auto-expire po 24h (edge function)
- **Test:** klient ↔ buyer wymieniają oferty real-time, akceptacja prowadzi do `sales` insert i flow karencji.

### Sesja 8 — QR codes + Sugestie redukcji + Wyciągnięcia
- `/admin/products/[id]/qr` — generator QR (qrcode lib): PNG 600×600 + PDF A6 etykieta z marka/model/cena
- `/q/[slug]` (publiczny) — landing po skanie: zdjęcie produktu + cena + button "Złóż ofertę" (otwiera offers flow)
- Edge Function (cron co 24h): produkty listed > 21d bez offer → notyfikacja + email z sugestią P50
- `/panel/products/[id]/withdraw` — flow wyciągnięcia: wybór powodu (6) → kalkulacja opłaty → potwierdzenie → `returns` insert
- **Test:** generuje QR, skan przekierowuje, klient składa ofertę. Po 21 dniach dostaję email z sugestią.

### Sesja 9 — Email automation + Admin inbox + Stats admin
- Resend templates: signup, sale, valuation_ready, offer, payout_requested, payout_done, return, reduction_suggestion
- Trigger DB: insert do `notifications` → webhook → Resend send (asynchronously via edge function)
- `/admin/inbox` — agreguje wszystkie typy z filter (per type, per klient)
- `/admin/stats` — GMV miesiąc/rok, prowizje brutto, średnie czasy A&QC/wycena/wypłata, top klienci, top marki
- **Test:** każda akcja triggeruje email do klienta, admin widzi wszystkie metryki.

### Sesja 10 — Polish + Testing + Production-readiness
- E2E testy Playwright:
  - signup → onboarding → submission z 1 produktem → A&QC pass → listed → offer → sold → upload K-S → withdraw → payout
  - admin: tworzy submission per klient, robi A&QC, decyduje zwrot
- Empty states, error states, loading states, 404/500 pages
- Form validation messages (Polish)
- SEO meta + OG images
- Performance audit (Lighthouse target 90+)
- Security review: każda RLS policy przemyślana, audit log dla wrażliwych operacji
- Documentation: ENV vars, deploy steps, runbook
- **Test:** pełen flow E2E przechodzi automatycznie, smoke test na prod.

---

## 6. Out of scope (poza MVP)

Te wymagają zewnętrznych umów / integracji — osobne sesje po zatwierdzeniu od strony Kickback / partnerów:

| Feature | Co potrzebne |
|---|---|
| **Autopay real OAuth** | Umowa z Autopay, sandbox keys, prod keys, audyt PSD2 |
| **Profil zaufany** | Rejestracja w gov.pl jako dostawca usług, certyfikaty SAML, audyt MC |
| **Subkonto Santander API** | Umowa Multibanking API z Santanderem, certyfikaty, KYC |
| **DPD/InPost shipping API** | Konto firmowe, API key, integracja w `generate_shipping_label` |
| **VAT FV generation (KSeF)** | Integracja z KSeF (Krajowy System e-Faktur), księgowa |
| **Banner na głównym sajcie Kickback** | Koordynacja z `sites/kickback` (sister repo) — embed + auth handoff |

W każdej z tych integracji obecny mock zostaje zastąpiony real call. Reszta aplikacji nie wymaga zmian (interface stays).

---

## 7. Ryzyka

1. **Mock Autopay/PZ przez długi czas** → Solution: explicit "Tryb demo" badge w UI, blokada produkcyjnego użycia (env flag) do czasu real integration
2. **Pieniądze "udawane"** → Solution: explicit "Saldo testowe" baner w Wallet do czasu integracji subkonta
3. **GDPR (PESEL, NIP, adresy)** → Solution: Supabase RLS + audit log + szyfrowanie at-rest. Finalnie wymaga DPA z Supabase, polityki retention, prawa do wglądu / usunięcia
4. **Czas — 10 sesji = ~6-10 tygodni** → Solution: traktuj sesje 1-4 jako MVP-demo (klient testuje signup + submission + my sales + wallet), sesje 5-7 jako MVP-full, 8-10 polish
5. **Realtime skalowanie** (offers thread) → Supabase Realtime ma limity. Na MVP bez problemu. Optymalizacja w Phase 4.
6. **VAT i fakturowanie** → wystawianie FV przez Kickback (klient2 → Kickback) wymaga księgowej integracji. Phase 4.

---

## 8. Pierwsze kroki — Sesja 1 (po akceptacji)

Wykonam w tej kolejności (każdy krok = potwierdzenie):

1. Utworzę gałąź `static-prototype` i zachowam tam aktualny stan (jako referencja designu)
2. Wymaże zawartość `sites/panel-komisowy/` na `main`
3. `npx create-next-app@latest sites/panel-komisowy --typescript --tailwind --app --src-dir --import-alias '@/*'`
4. Skonfiguruje Tailwind v4 + custom tokens (cream/forest paleta z aktualnego landing)
5. Dodaje fonty Fraunces + Inter
6. Setup Supabase: `npx supabase init`, project create (cloud), env vars w `.env.local`
7. Migracja `001_init.sql`: `profiles` + RLS
8. `lib/supabase/{client,server,types}.ts` — typed clients
9. Auth pages: `/login`, `/register`, `/forgot-password` z design system
10. Onboarding: `/onboarding` (typ konta + dane → insert do profiles)
11. Port landing page (`app/page.tsx`) — zachowuję polished design w React
12. CTA na landing → `/start` (jeśli logged in) lub `/register` (jeśli nie)
13. Vercel deploy + env vars + preview URL
14. Update `README.md` z dev workflow (cd, npm install, supabase, env vars, npm run dev)

**Output Sesji 1:** działający Next.js app z auth + onboarding + portem polished landingu, deploy na Vercel, można się zarejestrować i zalogować.

---

## Akceptacja

Jeżeli ten plan OK — w następnej wiadomości zaczynam Sesję 1 i lecę. Jeżeli chcesz zmienić cokolwiek (stack, kolejność, scope, więcej/mniej rzeczy w sesji) — powiedz przed startem.
