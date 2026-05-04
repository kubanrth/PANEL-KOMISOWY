-- ============================================================
-- 003 wallet, payouts, documents, notifications, bank_accounts, audit_log
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================
do $$ begin
  create type wallet_tx_type as enum (
    'sale_pending',     -- sprzedaż, w karencji 14d
    'sale_unlocked',    -- karencja minęła, środki dostępne
    'payout_request',   -- wypłata zlecona (lock środków)
    'payout_done',      -- wypłata zrealizowana
    'payout_cancelled', -- wypłata odrzucona / anulowana (zwrot do dostępnych)
    'return_fee',       -- opłata za wycofanie rzeczy
    'deposit_topup',    -- doładowanie ręczne
    'manual_adjustment' -- korekta admina
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payout_status as enum (
    'requested', 'authorized', 'executing', 'done', 'failed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type document_type as enum (
    'umowa_komisowa',   -- generowana przy submission
    'umowa_ks',         -- Umowa Kupna-Sprzedaży (klient indywidualny)
    'faktura',          -- FV sprzedażowa (klient biznesowy)
    'inne'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type notification_type as enum (
    'submission_signed',
    'submission_received',
    'aqc_started',
    'aqc_complete',
    'valuation_ready',
    'price_reduction_suggestion',
    'offer_received',
    'offer_accepted',
    'offer_rejected',
    'sale',
    'sale_unlocked',
    'payout_pending',
    'payout_done',
    'payout_failed',
    'return_decision',
    'document_required'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- bank_accounts
-- ============================================================
create table if not exists public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  klient_id       uuid not null references public.profiles(id) on delete cascade,
  bank_name       text not null,
  iban            text not null,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists bank_accounts_klient_idx on public.bank_accounts(klient_id);

alter table public.bank_accounts enable row level security;
drop policy if exists "bank_accounts_select_own" on public.bank_accounts;
create policy "bank_accounts_select_own" on public.bank_accounts for select using (auth.uid() = klient_id);
drop policy if exists "bank_accounts_insert_own" on public.bank_accounts;
create policy "bank_accounts_insert_own" on public.bank_accounts for insert with check (auth.uid() = klient_id);
drop policy if exists "bank_accounts_update_own" on public.bank_accounts;
create policy "bank_accounts_update_own" on public.bank_accounts for update using (auth.uid() = klient_id);
drop policy if exists "bank_accounts_delete_own" on public.bank_accounts;
create policy "bank_accounts_delete_own" on public.bank_accounts for delete using (auth.uid() = klient_id);
drop policy if exists "bank_accounts_admin_all" on public.bank_accounts;
create policy "bank_accounts_admin_all" on public.bank_accounts for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);

-- ============================================================
-- wallet_transactions (append-only ledger)
-- ============================================================
create table if not exists public.wallet_transactions (
  id              uuid primary key default gen_random_uuid(),
  klient_id       uuid not null references public.profiles(id) on delete cascade,
  type            wallet_tx_type not null,
  amount_cents    int not null, -- signed: + wpływ, − wypłata
  reference_id    text,         -- SUB-/PAY-/...
  available_at    timestamptz,  -- kiedy karencja kończy
  description     text,
  created_at      timestamptz not null default now()
);
create index if not exists wallet_tx_klient_idx on public.wallet_transactions(klient_id);
create index if not exists wallet_tx_created_idx on public.wallet_transactions(created_at desc);

alter table public.wallet_transactions enable row level security;
drop policy if exists "wallet_tx_select_own" on public.wallet_transactions;
create policy "wallet_tx_select_own" on public.wallet_transactions for select using (auth.uid() = klient_id);
drop policy if exists "wallet_tx_admin_all" on public.wallet_transactions;
create policy "wallet_tx_admin_all" on public.wallet_transactions for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);
-- Note: insert is done via SECURITY DEFINER functions, not direct from client.

-- ============================================================
-- payouts
-- ============================================================
create table if not exists public.payouts (
  id                uuid primary key default gen_random_uuid(),
  klient_id         uuid not null references public.profiles(id) on delete cascade,
  amount_cents      int not null check (amount_cents > 0),
  bank_account_id   uuid references public.bank_accounts(id),
  status            payout_status not null default 'requested',
  requested_at      timestamptz not null default now(),
  authorized_by     uuid references public.profiles(id),
  authorized_at     timestamptz,
  executed_at       timestamptz,
  bank_ref          text,
  notes             text
);
create index if not exists payouts_klient_idx on public.payouts(klient_id);
create index if not exists payouts_status_idx on public.payouts(status);

alter table public.payouts enable row level security;
drop policy if exists "payouts_select_own" on public.payouts;
create policy "payouts_select_own" on public.payouts for select using (auth.uid() = klient_id);
drop policy if exists "payouts_insert_own" on public.payouts;
create policy "payouts_insert_own" on public.payouts for insert with check (auth.uid() = klient_id and status = 'requested');
drop policy if exists "payouts_admin_all" on public.payouts;
create policy "payouts_admin_all" on public.payouts for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);

-- ============================================================
-- documents
-- ============================================================
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  klient_id       uuid not null references public.profiles(id) on delete cascade,
  submission_id   text references public.submissions(id) on delete set null,
  type            document_type not null,
  file_url        text,
  signed_at       timestamptz,
  signed_method   text,
  created_at      timestamptz not null default now()
);
create index if not exists documents_klient_idx on public.documents(klient_id);
create index if not exists documents_submission_idx on public.documents(submission_id);

alter table public.documents enable row level security;
drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents for select using (auth.uid() = klient_id);
drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents for insert with check (auth.uid() = klient_id);
drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents for update using (auth.uid() = klient_id);
drop policy if exists "documents_admin_all" on public.documents;
create policy "documents_admin_all" on public.documents for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);

-- Storage bucket dla dokumentów (PRYWATNY — tylko właściciel + admin)
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

drop policy if exists "documents_insert_own_storage" on storage.objects;
create policy "documents_insert_own_storage" on storage.objects for insert to authenticated with check (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "documents_select_own_storage" on storage.objects;
create policy "documents_select_own_storage" on storage.objects for select to authenticated using (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- notifications
-- ============================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        notification_type not null,
  title       text not null,
  body        text,
  ref_id      text,             -- SUB-/PROD-/PAY-...
  read_at     timestamptz,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id, read_at) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);
drop policy if exists "notifications_admin_all" on public.notifications;
create policy "notifications_admin_all" on public.notifications for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);

-- ============================================================
-- audit_log (admin actions)
-- ============================================================
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.profiles(id),
  action        text not null,
  target_type   text,           -- 'submission', 'product', 'payout', ...
  target_id     text,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_target_idx on public.audit_log(target_type, target_id);
create index if not exists audit_log_actor_idx on public.audit_log(actor_id, created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists "audit_log_admin_only" on public.audit_log;
create policy "audit_log_admin_only" on public.audit_log for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
);

-- ============================================================
-- Wallet RPC: balance + available + pending
-- (SECURITY DEFINER bo agreguje wszystkie tx klienta)
-- ============================================================
create or replace function public.wallet_summary(klient uuid default auth.uid())
returns table (
  balance_cents      bigint,
  available_cents    bigint,
  pending_cents      bigint
)
language sql
security definer
set search_path = public
as $$
  with my_tx as (
    select * from public.wallet_transactions
    where klient_id = klient
    -- klient widzi tylko swoje (RLS)
    and (
      auth.uid() = klient
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'super_admin'))
    )
  )
  select
    coalesce(sum(amount_cents), 0)::bigint                                                    as balance_cents,
    coalesce(sum(case when type in ('sale_unlocked','payout_request','payout_done','payout_cancelled','return_fee','deposit_topup','manual_adjustment') then amount_cents else 0 end), 0)::bigint as available_cents,
    coalesce(sum(case when type = 'sale_pending' then amount_cents else 0 end), 0)::bigint    as pending_cents
  from my_tx;
$$;
grant execute on function public.wallet_summary(uuid) to authenticated;

-- ============================================================
-- Wallet RPC: request_payout (debits available)
-- ============================================================
create or replace function public.request_payout(amount_cents int, bank_account uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  available bigint;
  payout_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if amount_cents <= 0 then raise exception 'amount must be positive'; end if;

  -- Sprawdź dostępne środki
  select available_cents into available from public.wallet_summary(uid);
  if available < amount_cents then
    raise exception 'insufficient funds: available % cents, requested %', available, amount_cents;
  end if;

  -- Sprawdź konto bankowe
  if not exists (select 1 from public.bank_accounts where id = bank_account and klient_id = uid) then
    raise exception 'bank account not found';
  end if;

  -- Utwórz payout
  insert into public.payouts (klient_id, amount_cents, bank_account_id, status)
  values (uid, amount_cents, bank_account, 'requested')
  returning id into payout_id;

  -- Wstaw transakcję (debit)
  insert into public.wallet_transactions (klient_id, type, amount_cents, reference_id, description)
  values (uid, 'payout_request', -amount_cents, 'PAY-' || payout_id::text, 'Wypłata na konto');

  -- Powiadomienie
  insert into public.notifications (user_id, type, title, body, ref_id, payload)
  values (uid, 'payout_pending', 'Wypłata zlecona', 'Twoja wypłata oczekuje na autoryzację administratora.', 'PAY-' || payout_id::text, jsonb_build_object('amount_cents', amount_cents));

  return payout_id;
end;
$$;
grant execute on function public.request_payout(int, uuid) to authenticated;
