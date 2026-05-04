# Panel Komisowy — Kickback

Konsygnacyjna platforma sprzedażowa dla Kickback sp. z o. o. — Next.js 16 + Supabase + Tailwind v4.

Live: [github.com/kubanrth/PANEL-KOMISOWY](https://github.com/kubanrth/PANEL-KOMISOWY)

## Plan

Pełen plan działania: [PLAN.md](./PLAN.md). 10 sesji, każda kończy się działającym feature'em.

**Sesja 1 (zrobiona):** Foundation — Next.js + Supabase + auth + landing + onboarding.

## Stack

- **Next.js 16** (App Router, Turbopack, async params/cookies)
- **TypeScript** strict
- **Tailwind CSS v4** (CSS-first config przez `@theme` w `globals.css`)
- **Supabase** — Postgres + Auth + RLS + Storage + Realtime
- **React 19.2** — server components + server actions

## Design language

Revolut: czarne tło `#0A0B10`, electric blue `#0066FF` jako primary, vivid purple → hot pink gradients na feature cards. Inter Display + Geist Mono. Tokens w [src/app/globals.css](src/app/globals.css).

## Setup

### 1. Sklonuj i zainstaluj

```bash
git clone https://github.com/kubanrth/PANEL-KOMISOWY.git
cd PANEL-KOMISOWY
npm install
```

### 2. Supabase

Utwórz projekt na [supabase.com](https://supabase.com), potem:

1. Skopiuj `.env.example` do `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Wypełnij wartości z **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (do server-side admin operacji)

3. Wykonaj migrację SQL w **Supabase Dashboard → SQL Editor**:
   - Skopiuj zawartość [supabase/migrations/20260504_001_init.sql](supabase/migrations/20260504_001_init.sql)
   - Wklej i `Run`

4. W **Authentication → URL Configuration** ustaw:
   - Site URL: `http://localhost:3001`
   - Redirect URLs: `http://localhost:3001/auth/callback`

### 3. Dev server

```bash
npm run dev
```

App na **http://localhost:3001** (port 3001 by nie konfliktować z `serve.mjs` w workspace).

## Ścieżki

| Route | Co | Ochrona |
|---|---|---|
| `/` | Landing marketing | publiczna |
| `/register` | Rejestracja konta | publiczna (redirect → `/panel` jeśli zalogowany) |
| `/login` | Logowanie | publiczna |
| `/auth/callback` | Email confirmation | publiczna |
| `/onboarding` | Wybór typu konta + dane | wymaga loginu |
| `/panel` | Dashboard klienta | wymaga loginu + onboardingu |
| `/start` | Submission flow | wymaga loginu (Sesja 2) |
| `/admin/*` | Panel admina | wymaga loginu + role admin (Sesja 5) |

Auth gate w [src/proxy.ts](src/proxy.ts).

## Co działa już teraz (Sesja 1)

- Rejestracja konta z e-mailem + hasłem (Supabase Auth)
- Email confirmation flow (callback handler)
- Logowanie + wylogowanie
- Auto-redirect: zalogowany → `/panel`, niezalogowany na chronionym → `/login?next=...`
- Onboarding: wybór konta indywidualne / biznesowe + dane (PESEL/NIP)
- DB profile (`profiles`) + RLS (klient widzi tylko swój)
- Landing page w pełnej Revolut estetyce

## Co dalej (Sesja 2)

Submission flow: multi-step `/start` → mock Autopay → wypełnienie produktów → generowanie PDF etykiety nadania + Umowy Komisowej → email do klienta.

Zobacz [PLAN.md](./PLAN.md) sekcja "Plan po sesjach".

## Licencja

Proprietary — Kickback sp. z o. o.
