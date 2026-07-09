-- ============================================================
-- 016 — shipping-labels: dostęp admina do etykiet klientów
-- ============================================================
-- Etykiety wysyłkowe czyta magazyn/ops (admin), nie tylko właściciel.
-- Bez tej policy signed URL po 365 dniach wygasa bez możliwości
-- ponownego podpisania przez admina.

drop policy if exists "shipping_labels_admin_select" on storage.objects;
create policy "shipping_labels_admin_select" on storage.objects for select to authenticated using (
  bucket_id = 'shipping-labels' and public.is_admin()
);
