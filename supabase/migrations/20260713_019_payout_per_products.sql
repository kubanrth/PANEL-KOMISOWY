-- ============================================================
-- 019 — Wypłaty per pozycja (komisant zaznacza sprzedane produkty)
-- ============================================================
-- Zamiast wypłaty kwotą/procentem: komisant zaznacza konkretne
-- sprzedane pozycje i zleca wypłatę dokładnie za nie.
-- products.payout_id wiąże pozycję z wypłatą (blokada podwójnej wypłaty).
-- RPC domyka też brakujący krok rozliczenia: dojrzałe sale_pending
-- (po 14 dniach) konwertuje na sale_unlocked przed debetem.

alter table public.products
  add column if not exists payout_id uuid references public.payouts(id);
create index if not exists products_payout_idx on public.products(payout_id);

create or replace function public.request_payout_for_products(product_ids uuid[], bank_account uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  refs text[];
  cnt int;
  total bigint;
  available bigint;
  new_payout_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if product_ids is null or array_length(product_ids, 1) is null then
    raise exception 'Zaznacz co najmniej jedną pozycję.';
  end if;

  refs := array(select 'PROD-' || pid::text from unnest(product_ids) pid);

  -- Pozycje muszą: istnieć, należeć do komisanta, być sprzedane, bez wypłaty.
  select count(*) into cnt
  from products pr
  join submissions s on s.id = pr.submission_id
  where pr.id = any(product_ids)
    and s.klient_id = uid
    and pr.status = 'sold'
    and pr.payout_id is null;
  if cnt <> array_length(product_ids, 1) then
    raise exception 'Część pozycji nie istnieje, nie jest sprzedana albo ma już zleconą wypłatę.';
  end if;

  -- Dojrzałe pending payout → dostępne (brakujący krok rozliczenia).
  update wallet_transactions
    set type = 'sale_unlocked'
    where klient_id = uid and type = 'sale_pending'
      and available_at <= now()
      and reference_id = any(refs);

  -- Suma odblokowanych środków za zaznaczone pozycje.
  select coalesce(sum(amount_cents), 0) into total
  from wallet_transactions
  where klient_id = uid and type = 'sale_unlocked' and reference_id = any(refs);
  if total <= 0 then
    raise exception 'Środki za zaznaczone pozycje są jeszcze w pending payout.';
  end if;

  -- Defensywnie: saldo dostępne musi pokrywać wypłatę.
  select available_cents into available from public.wallet_summary(uid);
  if available < total then
    raise exception 'insufficient funds: available % cents, requested %', available, total;
  end if;

  if not exists (select 1 from bank_accounts where id = bank_account and klient_id = uid) then
    raise exception 'bank account not found';
  end if;

  insert into payouts (klient_id, amount_cents, bank_account_id, status, notes)
  values (uid, total, bank_account, 'requested',
          'Wypłata za ' || cnt || ' pozycji: ' || array_to_string(refs, ', '))
  returning id into new_payout_id;

  update products set payout_id = new_payout_id where id = any(product_ids);

  insert into wallet_transactions (klient_id, type, amount_cents, reference_id, description)
  values (uid, 'payout_request', -total, 'PAY-' || new_payout_id::text,
          'Wypłata za ' || cnt || ' sprzedanych pozycji');

  insert into notifications (user_id, type, title, body, ref_id, payload)
  values (uid, 'payout_pending', 'Wypłata zlecona',
          'Wypłata za ' || cnt || ' pozycji oczekuje na autoryzację administratora.',
          'PAY-' || new_payout_id::text,
          jsonb_build_object('amount_cents', total, 'product_ids', product_ids));

  return new_payout_id;
end;
$$;

revoke all on function public.request_payout_for_products(uuid[], uuid) from public;
grant execute on function public.request_payout_for_products(uuid[], uuid) to authenticated;
