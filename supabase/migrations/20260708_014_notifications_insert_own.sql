-- 014: notifications — brakująca polityka INSERT dla klienta.
--
-- Tabela ma RLS enabled, ale tylko select_own / update_own / admin_all.
-- Server actions klienta (requestPriceChange, bulkRequestWithdrawal)
-- wpisują powiadomienie "do własnej historii" — insert był po cichu
-- odrzucany przez RLS (kod ignoruje błąd tego insertu jako non-blocking).
-- Klient może tworzyć powiadomienia wyłącznie dla samego siebie.

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
  on public.notifications for insert
  with check (auth.uid() = user_id);
