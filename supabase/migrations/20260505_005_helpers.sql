-- ============================================================
-- 005 helpers: increment_qr_scan, set_admin_role
-- ============================================================

-- Increment scan counter on QR scan (public — anyone with slug can call)
create or replace function public.increment_qr_scan(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.qr_codes
     set scans_count = scans_count + 1,
         last_scanned_at = now()
   where slug = p_slug;
end;
$$;
grant execute on function public.increment_qr_scan(text) to anon, authenticated;

-- Helper: set admin role (run as super_admin or postgres in SQL editor)
-- Usage: select public.set_user_role('email@example.com', 'admin');
create or replace function public.set_user_role(p_email text, p_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  select u.id into uid from auth.users u where u.email = p_email;
  if uid is null then
    raise exception 'User not found: %', p_email;
  end if;
  update public.profiles set role = p_role where id = uid;
end;
$$;
-- Note: NOT granted to public — must be called from SQL editor (super-admin context).
