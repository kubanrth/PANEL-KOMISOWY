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
