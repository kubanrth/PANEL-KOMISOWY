-- ============================================================
-- 018 — Fulfillment: dostawa do paczkomatu + koszt wysyłki z góry
-- ============================================================
-- Przy „Wygenerujcie list za mnie" komisant wybiera kuriera (adres)
-- albo Paczkomat InPost (kod maszyny). Koszt wysyłki zapisujemy przy
-- zleceniu (widoczny dla komisanta), potrącany z wypłaty.

alter table public.fulfillment_orders
  add column if not exists delivery_method text
  check (delivery_method in ('courier', 'paczkomat'));

alter table public.fulfillment_orders
  add column if not exists paczkomat_code text;
