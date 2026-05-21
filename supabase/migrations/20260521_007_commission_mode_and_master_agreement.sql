-- ============================================================
-- 007 — Commission mode (Grail Point style) + Master Umowa Komisowa
-- ============================================================
-- Two product changes:
--   1) Klient can sign the Umowa Komisowa ONCE, not per submission.
--      Each submission becomes "paczka" (delivery), not a contract.
--      → profiles.master_agreement_*
--   2) Klient can choose how to price each product:
--      'commission' — Kickback sells, 20% prowizji (legacy default)
--      'payout'     — klient declares "I want X zł"; Kickback sells at any
--                     price, keeps the spread.
--      → products.pricing_mode + products.payout_price_cents

-- ---------- profiles: master umowa komisowa ----------
alter table public.profiles
  add column if not exists master_agreement_signed_at     timestamptz,
  add column if not exists master_agreement_signed_method text,    -- 'autopay' | 'pz' | 'admin'
  add column if not exists master_agreement_signed_ip     text,
  add column if not exists master_agreement_version       text default '4.2';

-- ---------- products: pricing mode ----------
do $$ begin
  create type pricing_mode as enum ('commission', 'payout');
exception when duplicate_object then null;
end $$;

alter table public.products
  add column if not exists pricing_mode         pricing_mode not null default 'commission',
  add column if not exists payout_price_cents   int;             -- only for pricing_mode='payout'

comment on column public.products.pricing_mode is
  'commission = Kickback takes % from sale price (commission_rate on submission). '
  'payout = klient declares fixed PLN they want; Kickback sells at any price and keeps the rest.';

comment on column public.products.payout_price_cents is
  'For pricing_mode=payout: kwota PLN (cents) jaką klient chce otrzymać netto. '
  'Listing price ustawia Kickback dowolnie powyżej tej kwoty.';

-- Sanity: payout mode requires payout_price_cents to be set
alter table public.products
  drop constraint if exists products_payout_price_required;
alter table public.products
  add constraint products_payout_price_required
    check (pricing_mode = 'commission' or payout_price_cents is not null);
