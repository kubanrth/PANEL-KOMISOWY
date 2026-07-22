-- ============================================================
-- 018 — Rotacja komisu: agregaty sprzedaży po atrybutach
-- ============================================================
-- Panel Analityka pokazuje najlepiej rotujące atrybuty CAŁEGO komisu
-- (klub/marka, rozmiar, nazwisko zawodnika) w zestawieniu z pozycjami
-- zalogowanego komisanta. RLS ogranicza klienta do własnych produktów,
-- więc benchmark liczy SECURITY DEFINER — zwraca WYŁĄCZNIE agregaty
-- (żadnych danych jednostkowych innych komisantów).

create or replace function public.komis_rotation_stats()
returns table (dim text, label text, sold_total bigint, sold_mine bigint)
language sql
security definer
set search_path = public
as $$
  with sold as (
    select pr.brand, pr.size, lower(pr.model || ' ' || coalesce(pr.description, '')) as haystack, s.klient_id
    from products pr
    join submissions s on s.id = pr.submission_id
    where pr.status = 'sold'
  )
  -- Klub / marka (pole brand)
  select 'brand'::text, brand, count(*)::bigint,
         count(*) filter (where klient_id = auth.uid())::bigint
  from sold where coalesce(brand, '') <> '' group by brand
  union all
  -- Rozmiar
  select 'size', upper(size), count(*)::bigint,
         count(*) filter (where klient_id = auth.uid())::bigint
  from sold where coalesce(size, '') <> '' group by upper(size)
  union all
  -- Nazwisko zawodnika: dopasowanie nazwiska ze słownika players
  -- do tekstu model+opis (nazwiska < 4 znaki pomijamy — za dużo fałszywek)
  select 'player', p.full_name, count(*)::bigint,
         count(*) filter (where sold.klient_id = auth.uid())::bigint
  from players p
  join sold on position(lower(regexp_replace(p.full_name, '^.* ', '')) in sold.haystack) > 0
  where length(regexp_replace(p.full_name, '^.* ', '')) >= 4
  group by p.full_name;
$$;

revoke all on function public.komis_rotation_stats() from public;
grant execute on function public.komis_rotation_stats() to authenticated;
