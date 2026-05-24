-- ============================================================
-- 010 — Domain catalog + Demand listings (Zapotrzebowanie)
-- ============================================================
-- Słowniki klubów / reprezentacji / zawodników do filtrów,
-- rekomendacji i listy "Zapotrzebowanie" publikowanej przez Kickback.
-- Klient może wpisać free text (raw_label) jeśli brakuje pozycji w katalogu.

create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  country     text,
  league      text,
  crest_url   text,
  created_at  timestamptz not null default now()
);

create table if not exists public.national_teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  region      text,
  flag_url    text,
  created_at  timestamptz not null default now()
);

create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  club_id      uuid references public.clubs(id) on delete set null,
  position     text,
  is_legendary boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists players_club_idx on public.players(club_id);
create index if not exists players_name_idx on public.players(full_name);

-- ============================================================
-- Seed: top European clubs + Ekstraklasa + popular national teams + legendy
-- (Niewielka próbka — admin może dopisywać przez CRUD w Fazie 6+.)
-- ============================================================
insert into public.clubs (name, country, league) values
  ('Real Madryt',         'Hiszpania', 'La Liga'),
  ('FC Barcelona',        'Hiszpania', 'La Liga'),
  ('Atletico Madryt',     'Hiszpania', 'La Liga'),
  ('Manchester United',   'Anglia',    'Premier League'),
  ('Manchester City',     'Anglia',    'Premier League'),
  ('Liverpool',           'Anglia',    'Premier League'),
  ('Chelsea',             'Anglia',    'Premier League'),
  ('Arsenal',             'Anglia',    'Premier League'),
  ('Tottenham',           'Anglia',    'Premier League'),
  ('Bayern Monachium',    'Niemcy',    'Bundesliga'),
  ('Borussia Dortmund',   'Niemcy',    'Bundesliga'),
  ('Bayer Leverkusen',    'Niemcy',    'Bundesliga'),
  ('PSG',                 'Francja',   'Ligue 1'),
  ('Olympique Marsylia',  'Francja',   'Ligue 1'),
  ('Juventus',            'Włochy',    'Serie A'),
  ('AC Milan',            'Włochy',    'Serie A'),
  ('Inter Mediolan',      'Włochy',    'Serie A'),
  ('AS Roma',             'Włochy',    'Serie A'),
  ('SSC Napoli',           'Włochy',    'Serie A'),
  ('Ajax',                'Holandia',  'Eredivisie'),
  ('PSV Eindhoven',       'Holandia',  'Eredivisie'),
  ('FC Porto',            'Portugalia','Primeira Liga'),
  ('Benfica',             'Portugalia','Primeira Liga'),
  ('Sporting Lizbona',    'Portugalia','Primeira Liga'),
  ('Legia Warszawa',      'Polska',    'Ekstraklasa'),
  ('Lech Poznań',         'Polska',    'Ekstraklasa'),
  ('Pogoń Szczecin',      'Polska',    'Ekstraklasa'),
  ('Raków Częstochowa',   'Polska',    'Ekstraklasa'),
  ('Jagiellonia Białystok','Polska',   'Ekstraklasa'),
  ('Wisła Kraków',        'Polska',    'I Liga')
on conflict (name) do nothing;

insert into public.national_teams (name, region) values
  ('Polska',     'Europa'),
  ('Hiszpania',  'Europa'),
  ('Niemcy',     'Europa'),
  ('Francja',    'Europa'),
  ('Anglia',     'Europa'),
  ('Włochy',     'Europa'),
  ('Holandia',   'Europa'),
  ('Portugalia', 'Europa'),
  ('Belgia',     'Europa'),
  ('Chorwacja',  'Europa'),
  ('Argentyna',  'Ameryka Płd'),
  ('Brazylia',   'Ameryka Płd'),
  ('Urugwaj',    'Ameryka Płd'),
  ('Meksyk',     'Ameryka Płn'),
  ('USA',        'Ameryka Płn'),
  ('Maroko',     'Afryka'),
  ('Senegal',    'Afryka'),
  ('Japonia',    'Azja'),
  ('Korea Płd',  'Azja')
on conflict (name) do nothing;

-- Few legendary players bound to their clubs (lookups by name)
insert into public.players (full_name, club_id, position, is_legendary)
select v.full_name, c.id, v.position, true
from (values
  ('Robert Lewandowski', 'FC Barcelona',     'ST'),
  ('Cristiano Ronaldo',  null,               'ST'),
  ('Lionel Messi',       null,               'RW'),
  ('Kylian Mbappé',      'Real Madryt',      'ST'),
  ('Erling Haaland',     'Manchester City',  'ST'),
  ('Vinicius Jr.',       'Real Madryt',      'LW'),
  ('Jude Bellingham',    'Real Madryt',      'CM'),
  ('Mohamed Salah',      'Liverpool',        'RW'),
  ('Bukayo Saka',        'Arsenal',          'RW'),
  ('Pedri',              'FC Barcelona',     'CM'),
  ('Lamine Yamal',       'FC Barcelona',     'RW'),
  ('Zlatan Ibrahimović', null,               'ST'),
  ('Andrij Szewczenko',  null,               'ST'),
  ('Diego Maradona',     null,               'AM'),
  ('Pelé',               null,               'ST'),
  ('Ronaldinho',         null,               'AM'),
  ('Zinedine Zidane',    null,               'AM'),
  ('David Beckham',      null,               'RM'),
  ('Wojciech Szczęsny',  null,               'GK'),
  ('Piotr Zieliński',    'Inter Mediolan',   'CM')
) as v(full_name, club_name, position)
left join public.clubs c on c.name = v.club_name
on conflict do nothing;

-- ============================================================
-- demand_listings — publikowane przez Kickback "szukamy koszulek"
-- ============================================================
do $$ begin
  create type demand_kind as enum ('club', 'national_team', 'player');
exception when duplicate_object then null;
end $$;

create table if not exists public.demand_listings (
  id                uuid primary key default gen_random_uuid(),
  kind              demand_kind not null,
  club_id           uuid references public.clubs(id) on delete set null,
  national_team_id  uuid references public.national_teams(id) on delete set null,
  player_id         uuid references public.players(id) on delete set null,
  raw_label         text,                    -- free-text fallback when ID not present
  retro             boolean not null default false,
  season            text,                    -- "2003/04", "2024/25", "retro"
  target_price_cents int,
  notes             text,
  published_by      uuid references public.profiles(id),
  published_at      timestamptz not null default now(),
  expires_at        timestamptz,
  active            boolean not null default true
);

create index if not exists demand_active_idx on public.demand_listings(active, published_at desc);

alter table public.demand_listings enable row level security;

-- Publicznie czytalne (każdy zalogowany klient widzi co Kickback szuka)
drop policy if exists "demand_listings_read_all_auth" on public.demand_listings;
create policy "demand_listings_read_all_auth"
  on public.demand_listings for select
  to authenticated
  using (active = true);

drop policy if exists "demand_listings_admin_all" on public.demand_listings;
create policy "demand_listings_admin_all"
  on public.demand_listings for all using (public.is_admin());

-- Słowniki (clubs/players/national_teams) — read-only dla wszystkich
-- zalogowanych, write-only admin.
alter table public.clubs enable row level security;
alter table public.players enable row level security;
alter table public.national_teams enable row level security;

drop policy if exists "clubs_read_auth" on public.clubs;
create policy "clubs_read_auth" on public.clubs for select to authenticated using (true);
drop policy if exists "clubs_admin_write" on public.clubs;
create policy "clubs_admin_write" on public.clubs for all using (public.is_admin());

drop policy if exists "players_read_auth" on public.players;
create policy "players_read_auth" on public.players for select to authenticated using (true);
drop policy if exists "players_admin_write" on public.players;
create policy "players_admin_write" on public.players for all using (public.is_admin());

drop policy if exists "national_teams_read_auth" on public.national_teams;
create policy "national_teams_read_auth" on public.national_teams for select to authenticated using (true);
drop policy if exists "national_teams_admin_write" on public.national_teams;
create policy "national_teams_admin_write" on public.national_teams for all using (public.is_admin());

-- ============================================================
-- fulfillment_orders — Phase 4 (opcjonalne)
-- ============================================================
create table if not exists public.fulfillment_orders (
  id                uuid primary key default gen_random_uuid(),
  klient_id         uuid not null references public.profiles(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,
  buyer_name        text,
  tracking_number   text,
  carrier           text,
  shipping_cost_cents int,
  status            text not null default 'pending', -- pending / shipped / delivered / failed
  shipped_at        timestamptz,
  delivered_at      timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.fulfillment_orders enable row level security;

drop policy if exists "fulfillment_select_own" on public.fulfillment_orders;
create policy "fulfillment_select_own" on public.fulfillment_orders for select using (klient_id = auth.uid());

drop policy if exists "fulfillment_admin_all" on public.fulfillment_orders;
create policy "fulfillment_admin_all" on public.fulfillment_orders for all using (public.is_admin());
