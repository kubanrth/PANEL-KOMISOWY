-- ============================================================
-- 017 — Etapy zarządzania towarem (pipeline magazynowy)
-- ============================================================
-- 9 etapów przez które przechodzi produkt od przyjęcia do wystawienia.
-- Aktualizowane przez admina (infrastrukturę) formularzem w
-- /admin/submissions/[id]; klient widzi postęp na stronie produktu.
-- Etap 'listing' promuje products.status do 'listed' (w server action,
-- razem z pushem do Fakturowni) — następca usuniętego modułu A&QC.

alter table public.products
  add column if not exists stage text not null default 'introduction'
  check (stage in (
    'introduction',
    'verification',
    'attributes',
    'quality_control',
    'valuation_decision',
    'dimensions',
    'photos',
    'description',
    'listing'
  ));

-- Backfill: produkty które już są (były) w sprzedaży przeszły cały pipeline.
update public.products
  set stage = 'listing'
  where status in ('listed', 'offer', 'sold', 'withdrawn', 'returned')
    and stage = 'introduction';

create index if not exists products_stage_idx on public.products(stage);
