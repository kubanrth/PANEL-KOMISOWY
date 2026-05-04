# Panel Komisowy — Kickback

Konsygnacyjna platforma sprzedażowa dla Kickback sp. z o. o. — Next.js 16 + Supabase + Tailwind v4.

Live: **https://panel-komisowy.vercel.app/**
Repo: [github.com/kubanrth/PANEL-KOMISOWY](https://github.com/kubanrth/PANEL-KOMISOWY)

---

## Stack

- **Next.js 16** (App Router, Turbopack default, async params/cookies, `proxy` zamiast middleware)
- **TypeScript** strict
- **Tailwind v4** (CSS-first config przez `@theme` w `globals.css`)
- **Supabase** — Postgres + Auth + RLS + Storage + RPC
- **React 19.2** — server components + server actions
- **qrcode** — generator QR (server-side data URL)

---

## Design language: Revolut

- Bg `#0A0B10` · cards `#13141A` · elev `#1B1D26`
- Accent: electric blue `#0066FF` · gradients purple→pink, blue→mint
- Inter Display + Geist Mono
- Radius 16px cards / 12px buttons / 24px hero
- Tabular nums (`.num`) na pieniądzach i ID

---

## Setup

### 1. Sklonuj i zainstaluj

```bash
git clone https://github.com/kubanrth/PANEL-KOMISOWY.git
cd PANEL-KOMISOWY
npm install
```

### 2. Supabase

Utwórz projekt na **https://supabase.com**, potem:

1. `cp .env.example .env.local`
2. Wartości z **Project Settings → API Keys**:
   - `NEXT_PUBLIC_SUPABASE_URL` — np. `https://xyz.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — `sb_publishable_...`
3. **Migracje** (Supabase → SQL Editor → New query → wklej każdą po kolei i Run):
   - [supabase/migrations/20260504_001_init.sql](supabase/migrations/20260504_001_init.sql) — `profiles`, RLS, account types
   - [supabase/migrations/20260504_002_submissions.sql](supabase/migrations/20260504_002_submissions.sql) — `submissions`, `products`, Storage `product-photos`
   - [supabase/migrations/20260505_003_wallet.sql](supabase/migrations/20260505_003_wallet.sql) — `wallet_transactions`, `payouts`, `documents`, `notifications`, `bank_accounts`, `audit_log`
   - [supabase/migrations/20260505_004_admin.sql](supabase/migrations/20260505_004_admin.sql) — `aqc_audits`, `listings`, `offers`, `returns`, `qr_codes`
   - [supabase/migrations/20260505_005_helpers.sql](supabase/migrations/20260505_005_helpers.sql) — `increment_qr_scan`, `set_user_role`
4. **Authentication → URL Configuration:**
   - Site URL: `https://panel-komisowy.vercel.app` (lub `http://localhost:3001` lokalnie)
   - Redirect URLs: dodaj `https://panel-komisowy.vercel.app/auth/callback`
5. **Authentication → Providers → Email** → wyłącz `Confirm email` (na demo, włącz w produkcji)

### 3. Promuj swoje konto na admina

Po założeniu konta w aplikacji, w Supabase **SQL Editor**:

```sql
select public.set_user_role('twoj@email.com', 'admin');
```

Po tym możesz wejść w `/admin` i widzieć panel administratora.

### 4. Dev server

```bash
npm run dev    # → http://localhost:3001
```

(Port 3001 by nie konfliktować z `serve.mjs` workspace root.)

---

## Architektura

### Routes

| Route | Dostęp | Opis |
|---|---|---|
| `/` | publiczny | Marketing landing |
| `/register`, `/login`, `/auth/callback` | publiczny | Auth |
| `/onboarding` | login | Wybór typu konta + dane |
| `/start` | login + onboarding | Multi-step Submission flow (sign → produkty → review) |
| `/panel` | login | Dashboard klienta |
| `/panel/submissions` | login | Lista Submissions |
| `/panel/submissions/[id]` | login | Detal z drukowalną etykietą Ship to us |
| `/panel/my-sales` | login | Produkty cross-submission z filtrami |
| `/panel/products/[id]` | login | Szczegół produktu z galerią |
| `/panel/products/[id]/withdraw` | login | Wycofanie produktu (6 powodów) |
| `/panel/offers/[productId]` | login | Negocjacje Zerr (klient view) |
| `/panel/wallet` | login | Saldo + historia + withdraw + dokumenty |
| `/panel/notifications` | login | Inbox |
| `/panel/stats` | login | Statystyki klienta |
| `/admin` | admin | Operacyjny queue |
| `/admin/submissions` | admin | Lista all submissions |
| `/admin/klienci` | admin | Lista klientów + drilldown |
| `/admin/aqc` | admin | Kolejka A&QC |
| `/admin/aqc/[id]` | admin | 12-punktowy audit form |
| `/admin/offers` | admin | Negocjacje Zerr (admin view) + symulacja oferty |
| `/admin/offers/[id]` | admin | Wątek + kontroferta w imieniu klienta |
| `/admin/returns` | admin | Decyzje zwrotów (6 polityk) |
| `/admin/payouts` | admin | Autoryzacja wypłat |
| `/admin/qr` | admin | Generator QR + lista |
| `/admin/qr/[id]` | admin | QR jako data-URL + drukowalna etykieta |
| `/admin/inbox` | admin | Wszystkie powiadomienia (cross-klient) |
| `/admin/stats` | admin | GMV, prowizje, top klienci |
| `/admin/audit` | admin | Audit log akcji administratorów |
| `/q/[slug]` | publiczny (anonim) | Landing po skanie QR — kupujący składa ofertę |
| `/q/[slug]/sent` | publiczny | Potwierdzenie oferty |

### DB schema (5 migracji)

```
profiles (1:1 auth.users) — role, account_type, onboarded
submissions — SUB-XXXXX, status, signed_method
products — brand, model, prices_cents, photos jsonb, status
aqc_audits (1:1 product) — scores jsonb, verdict, recommended_price
listings — channel, current_price, deactivated_at
offers — buyer_token, amount_cents, parent (chain), status
returns (1:1 product) — reason (6), fee_cents, resolution
wallet_transactions — append-only ledger, signed amount, available_at
payouts — requested → authorized → done flow
documents — Umowy K-S / FV uploads
notifications — typed inbox
bank_accounts — IBAN per klient
audit_log — admin actions trail
qr_codes (1:1 product) — slug, scans_count
```

RLS: klient widzi tylko swoje (via klient_id lub product→submission). Admin widzi wszystko (rola w profiles).

### Server actions (Next.js 16)

Każda mutacja przez Server Action: `createSubmission`, `requestPayout`, `addBankAccount`, `uploadDocument`, `markRead`, `saveAqc`, `acceptOffer`, `rejectOffer`, `sellerCounterOffer`, `adminCounterOffer`, `createBuyerOffer`, `submitBuyerOffer`, `withdrawProduct`, `resolveReturn`, `authorizePayout`, `rejectPayout`, `generateQrForProduct`.

Wszystkie po validacji + RLS check + audit_log insert (gdzie odpowiednie).

### Magia DB

- **`generate_submission_id()`** RPC (SECURITY DEFINER + sequence start 8000) → format `SUB-08001`, `SUB-08002`...
- **`wallet_summary(klient)`** RPC → balance / available / pending z ledger
- **`request_payout(amount, bank)`** RPC → atomowy debit + insert payout + notification
- **Trigger `handle_product_sold`** → status `sold` automatycznie wstawia `wallet_transactions(sale_pending)` po prowizji
- **`increment_qr_scan(slug)`** RPC dla anonimowego skanu

---

## Demo flow E2E

Test pełnego flow w 5 minut:

1. **Rejestracja:** `/register` → e-mail + hasło → onboarding → `/panel`
2. **Submission:** klik **Nowa Submission** → Autopay (mock) → 1 produkt z 2 zdjęciami → submit → numer SUB-08001
3. **Promocja na admina** (SQL Editor): `select public.set_user_role('twoj@email.com', 'admin');` — odśwież panel
4. **A&QC** (jako admin): `/admin/aqc/{product_id}` → 12 punktów → werdykt PASS → produkt staje się `listed`
5. **Generator QR:** `/admin/qr` → klik **Generuj** dla swojego produktu → otwórz `/admin/qr/{id}` → drukuj
6. **Skan QR** (publicznie, w innej karcie / anonimowo): `/q/{slug}` → wpisz ofertę → wyślij
7. **Akceptacja oferty** (jako klient1): `/panel/notifications` → klik **Otwórz PROD-** → `/panel/offers/{id}` → Akceptuj
8. **Trigger DB** automatycznie wstawia `wallet_transactions(sale_pending)` po 14d karencji
9. **Wypłata** (klient): `/panel/wallet` → dodaj konto bankowe → kwota → Zleć wypłatę
10. **Autoryzacja** (admin): `/admin/payouts` → Autoryzuj → Wykonaj → klient dostaje notyfikację

---

## Co jeszcze nie zostało zrobione

Te punkty PLAN-u są poza tym sprintem (wymagają zewnętrznych integracji / API keys / dłuższych konfiguracji):

- **Real Autopay OAuth** + **Profil zaufany SAML** — dziś mock 1.5s spinner
- **Subkonto Santander API** — dziś metadata only, payouts manualnie
- **DPD/InPost shipping API** — etykieta to HTML printable, nie real DPD waybill
- **VAT FV przez KSeF** — dziś prosty upload pliku, brak automatu
- **Resend transakcyjne emaile** — wszystko w in-app notifications
- **Realtime Zerr** (WebSocket subscriptions) — działa via revalidatePath, refresh ręczny
- **Cron edge function** dla sugestii redukcji ceny po 21d
- **Playwright E2E** — manualny test plan w sekcji "Demo flow"
- **OG images / SEO meta** — bare minimum

---

## Plan długoterminowy

Pełen mapowanie wymagań → deliverables w [PLAN.md](./PLAN.md).

---

## Licencja

Proprietary — Kickback sp. z o. o.
