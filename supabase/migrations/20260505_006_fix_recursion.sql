-- ============================================================
-- 006 fix: infinite recursion in profiles RLS
-- ============================================================
-- Problem: policy "profiles_admin_select_all" checked role by querying
-- profiles, which triggered RLS evaluation on profiles, which called the
-- policy again → infinite recursion.
-- Fix: SECURITY DEFINER function bypasses RLS (postgres has BYPASSRLS).

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role in ('admin', 'super_admin') from public.profiles where id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- Drop + recreate every admin "all" policy to use the function instead of inline EXISTS.

-- profiles (the one that caused the recursion)
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles for select using (public.is_admin());

-- submissions (002)
drop policy if exists "submissions_admin_all" on public.submissions;
create policy "submissions_admin_all" on public.submissions for all using (public.is_admin());

-- products (002)
drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all" on public.products for all using (public.is_admin());

-- bank_accounts (003)
drop policy if exists "bank_accounts_admin_all" on public.bank_accounts;
create policy "bank_accounts_admin_all" on public.bank_accounts for all using (public.is_admin());

-- wallet_transactions (003)
drop policy if exists "wallet_tx_admin_all" on public.wallet_transactions;
create policy "wallet_tx_admin_all" on public.wallet_transactions for all using (public.is_admin());

-- payouts (003)
drop policy if exists "payouts_admin_all" on public.payouts;
create policy "payouts_admin_all" on public.payouts for all using (public.is_admin());

-- documents (003)
drop policy if exists "documents_admin_all" on public.documents;
create policy "documents_admin_all" on public.documents for all using (public.is_admin());

-- notifications (003)
drop policy if exists "notifications_admin_all" on public.notifications;
create policy "notifications_admin_all" on public.notifications for all using (public.is_admin());

-- audit_log (003)
drop policy if exists "audit_log_admin_only" on public.audit_log;
create policy "audit_log_admin_only" on public.audit_log for all using (public.is_admin());

-- aqc_audits (004)
drop policy if exists "aqc_audits_admin_all" on public.aqc_audits;
create policy "aqc_audits_admin_all" on public.aqc_audits for all using (public.is_admin());

-- listings (004)
drop policy if exists "listings_admin_all" on public.listings;
create policy "listings_admin_all" on public.listings for all using (public.is_admin());

-- offers (004)
drop policy if exists "offers_admin_all" on public.offers;
create policy "offers_admin_all" on public.offers for all using (public.is_admin());

-- returns (004)
drop policy if exists "returns_admin_all" on public.returns;
create policy "returns_admin_all" on public.returns for all using (public.is_admin());

-- qr_codes (004)
drop policy if exists "qr_codes_admin_all" on public.qr_codes;
create policy "qr_codes_admin_all" on public.qr_codes for all using (public.is_admin());
