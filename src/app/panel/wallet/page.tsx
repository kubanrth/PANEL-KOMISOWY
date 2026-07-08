import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate, daysFromNow } from "@/lib/format";
import type { WalletTransaction, BankAccount } from "@/lib/types";
import { WithdrawForm } from "./WithdrawForm";

/* Wallet — redesign: hero „Dostępne do wypłaty" na card-gradient-dark + glow-blob,
   2 KPI (W rozliczeniu / Wypłacone łącznie), tabela transakcji z pigułkami typów
   i saldem bieżącym, prawy panel: zlecenie wypłaty + metody wypłaty. */

export default async function WalletPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  // Wallet summary via RPC
  const { data: summary } = await supabase.rpc("wallet_summary", { klient: user.id });
  const balance = (summary?.[0]?.balance_cents as number | undefined) ?? 0;
  const available = (summary?.[0]?.available_cents as number | undefined) ?? 0;
  const pending = (summary?.[0]?.pending_cents as number | undefined) ?? 0;

  // Recent transactions
  const { data: txsRaw } = await supabase
    .from("wallet_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);
  const transactions = (txsRaw ?? []) as WalletTransaction[];

  // Bank accounts
  const { data: accountsRaw } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  const accounts = (accountsRaw ?? []) as BankAccount[];
  // Konto z umowy komisowej — jedno, ustalane przez Kickback (query sortuje is_default desc).
  const defaultAccount = accounts[0];

  const isBusiness = profile.account_type === "business";

  // Saldo po każdej transakcji — liczone od bieżącego balance w dół listy (desc).
  // ponytail: zakłada balance = suma ledgera; rozjazd RPC↔ledger pokaże przesunięcie.
  let running = balance;
  const txRows = transactions.map((tx) => {
    const saldo = running;
    running -= tx.amount_cents;
    return { tx, saldo };
  });

  // ponytail: suma z ostatnich 20 tx (limit istniejącego query) — pełny agregat
  // wymaga osobnego RPC, dodać gdy historia > 20 wypłat.
  const paidOutTotal = transactions
    .filter((t) => t.type === "payout_done")
    .reduce((a, t) => a + Math.abs(t.amount_cents), 0);

  return (
    <>
      <PageHeader label={`Wallet · ${formatDate(new Date())}`} title="Portfel" />
      {/* ponytail: własny <p> zamiast PageHeader sub — tekst klienta jest długi, 60ch było za ciasne */}
      <p className="mt-3 text-[15px] leading-[1.55] text-text-soft max-w-[78ch]">
        {'W widoku swojego portfela znajdziesz wizualizację skumulowanych środków ze sprzedaży swoich produktów. Nie musisz wykonywać żadnych akcji, aby wypłacić środki. Po okresie karencji, wynoszącym 14 dni, środki wpłyną na Twoje konto maksymalnie w przeciągu 72h. Jeżeli chcesz przyspieszyć ten proces, skorzystaj z przycisku „Wypłać teraz".'}
      </p>

      <section className="mt-8 grid grid-cols-12 gap-6">
        {/* Hero + KPI */}
        <div className="col-span-12 lg:col-span-7 space-y-3">
          <div className="card-gradient-dark relative overflow-hidden p-7 lg:p-9">
            <div className="glow-blob" aria-hidden />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="label !text-white/55">Dostępne do wypłaty</span>
                <span className="pill pill-mint">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                  Środki ze sprzedaży
                </span>
              </div>
              <div className="mt-5 num font-light text-[40px] lg:text-[56px] leading-none tracking-[-0.03em] text-mint">
                {formatPLN(available, { decimals: false })}
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <ButtonLink href="#wyplata" size="md">
                  Wypłać teraz <ArrowRight size={16} />
                </ButtonLink>
                <span className="text-[12px] text-white/60 num">
                  Saldo całkowite: {formatPLN(balance, { decimals: false })}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="W rozliczeniu"
              value={<span className="text-yellow">{formatPLN(pending, { decimals: false })}</span>}
              mono
              sub="karencja 14 dni po sprzedaży"
            />
            <KpiCard
              label="Wypłacone (ost. transakcje)"
              value={formatPLN(paidOutTotal, { decimals: false })}
              mono
              sub="zrealizowane wypłaty"
            />
          </div>
        </div>

        {/* Prawy panel: wypłata + metody wypłaty */}
        <div className="col-span-12 lg:col-span-5 space-y-5">
          <WithdrawForm available={available} accounts={accounts} />

          <div className="card p-6">
            <div className="label mb-4">Konto z umowy komisowej</div>
            {defaultAccount ? (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center text-[10px] num text-text-mute">
                  {defaultAccount.bank_name.slice(0, 3).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate">{defaultAccount.bank_name}</div>
                  <div className="text-[11px] text-text-mute num">
                    {defaultAccount.iban.slice(0, 6)}…{defaultAccount.iban.slice(-4)}
                  </div>
                </div>
                <Pill variant="lime">Z umowy</Pill>
              </div>
            ) : (
              <p className="text-[13px] text-text-soft">
                Brak przypiętego konta — skontaktuj się z opiekunem.
              </p>
            )}
            <p className="mt-4 text-[11px] text-text-mute leading-relaxed">
              Konto do wypłat ustala Kickback na podstawie umowy komisowej.
            </p>
          </div>
        </div>
      </section>

      {/* Documents prompt */}
      <PendingDocumentsCallout supabase={supabase} userId={user.id} isBusiness={isBusiness} />

      {/* Transaction history */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="label">Ruch w portfelu</div>
            <h2 className="mt-2 font-light text-[22px] tracking-[-0.02em]">Historia transakcji</h2>
          </div>
          <span className="text-[12px] text-text-mute num">{transactions.length} ostatnich</span>
        </div>

        {transactions.length === 0 ? (
          <EmptyState
            title="Brak transakcji"
            sub="Środki pojawią się tu po pierwszej sprzedaży."
          />
        ) : (
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[100px_130px_120px_minmax(180px,1fr)_130px_120px] gap-3 px-4 h-11 label border-b border-border items-center">
              <div>Data</div>
              <div title="Środki blokowane 14 dni (ochrona przed zwrotem)">Data rozliczenia</div>
              <div>Typ</div>
              <div>Operacja</div>
              <div className="text-right">Kwota</div>
              <div className="text-right">Saldo</div>
            </div>
            {txRows.map(({ tx, saldo }) => (
              <TxRow key={tx.id} tx={tx} saldo={saldo} />
            ))}
          </div>
        )}
      </section>

    </>
  );
}

/* Vocab pigułek typów transakcji: mint=sprzedaż, blue=wypłata (w toku/zrealizowana),
   yellow=karencja, amber=korekta. */
const TX_PILL: Record<WalletTransaction["type"], { label: string; variant: PillVariant }> = {
  sale_pending: { label: "Karencja", variant: "yellow" },
  sale_unlocked: { label: "Sprzedaż", variant: "mint" },
  payout_request: { label: "Wypłata", variant: "blue" },
  payout_done: { label: "Wypłata", variant: "blue" },
  payout_cancelled: { label: "Korekta", variant: "amber" },
  return_fee: { label: "Korekta", variant: "amber" },
  deposit_topup: { label: "Korekta", variant: "amber" },
  manual_adjustment: { label: "Korekta", variant: "amber" },
};

const TYPE_LABEL: Record<WalletTransaction["type"], string> = {
  sale_pending: "Sprzedaż (karencja 14d)",
  sale_unlocked: "Środki odblokowane",
  payout_request: "Wypłata zlecona",
  payout_done: "Wypłata zrealizowana",
  payout_cancelled: "Wypłata anulowana",
  return_fee: "Opłata za wycofanie",
  deposit_topup: "Doładowanie",
  manual_adjustment: "Korekta",
};

function TxRow({ tx, saldo }: { tx: WalletTransaction; saldo: number }) {
  const positive = tx.amount_cents >= 0;
  const sign = positive ? "+" : "−";
  const amountDisplay = `${sign} ${formatPLN(Math.abs(tx.amount_cents), { decimals: false })}`;
  const amountCls = positive ? "text-mint" : "text-coral";
  const { label, variant } = TX_PILL[tx.type] ?? { label: tx.type, variant: "mute" as const };

  // Data rozliczenia: tylko dla wierszy sprzedażowych; sale_pending w przyszłości → mikrotekst „za X dni".
  const isSale = tx.type === "sale_pending" || tx.type === "sale_unlocked";
  const settleDays = tx.type === "sale_pending" ? daysFromNow(tx.available_at) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[100px_130px_120px_minmax(180px,1fr)_130px_120px] gap-2 md:gap-3 px-4 py-3.5 md:items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors">
      <div className="hidden md:block text-[12px] num text-text-soft">{formatDate(tx.created_at)}</div>
      <div className="hidden md:block">
        {isSale && tx.available_at ? (
          <>
            <div className="text-[12px] num text-text-soft">{formatDate(tx.available_at)}</div>
            {settleDays !== null && settleDays > 0 && (
              <div className="text-[10px] text-text-mute">za {settleDays} dni</div>
            )}
          </>
        ) : (
          <span className="text-[12px] text-text-faint">—</span>
        )}
      </div>
      <div className="flex items-center justify-between md:block">
        <Pill variant={variant}>{label}</Pill>
        <span className={`md:hidden text-[14px] num ${amountCls}`}>{amountDisplay}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium truncate">{tx.description ?? TYPE_LABEL[tx.type]}</div>
        <div className="text-[11px] num text-text-mute truncate">
          <span className="md:hidden">{formatDate(tx.created_at)} · </span>
          {tx.reference_id ?? TYPE_LABEL[tx.type]}
        </div>
      </div>
      <div className={`hidden md:block text-[13px] num text-right ${amountCls}`}>{amountDisplay}</div>
      <div className="hidden md:block text-[12px] num text-text-soft text-right">
        {formatPLN(saldo, { decimals: false })}
      </div>
    </div>
  );
}

async function PendingDocumentsCallout({
  supabase, userId, isBusiness,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  isBusiness: boolean;
}) {
  // Find sales (sale_pending tx) that don't yet have a document of right type
  const { data: pendingTxs } = await supabase
    .from("wallet_transactions")
    .select("reference_id")
    .eq("klient_id", userId)
    .eq("type", "sale_pending");

  const productRefs = (pendingTxs ?? [])
    .map((t) => t.reference_id)
    .filter((r): r is string => !!r && r.startsWith("PROD-"))
    .map((r) => r.replace("PROD-", ""));

  if (productRefs.length === 0) return null;

  // Find submissions that have documents
  const { data: submissionIds } = await supabase
    .from("products")
    .select("submission_id")
    .in("id", productRefs);

  const requiredType = isBusiness ? "faktura" : "umowa_ks";
  const subIds = Array.from(new Set((submissionIds ?? []).map((s) => s.submission_id)));

  if (subIds.length === 0) return null;

  const { data: existing } = await supabase
    .from("documents")
    .select("submission_id")
    .in("submission_id", subIds)
    .eq("type", requiredType);

  const documented = new Set((existing ?? []).map((d) => d.submission_id));
  const missing = subIds.filter((s) => !documented.has(s));

  if (missing.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="rounded-[14px] bg-yellow/8 border border-yellow/25 p-5 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow mt-0.5 flex-shrink-0" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-yellow">
            {isBusiness
              ? `Wymagane faktury sprzedażowe · ${missing.length}`
              : `Wymagane Umowy Kupna-Sprzedaży · ${missing.length}`}
          </div>
          <p className="mt-1 text-[12px] leading-[1.55] text-text-soft max-w-[60ch]">
            {isBusiness
              ? "Po wystawieniu FV środki przechodzą z karencji do dostępnych — możesz je wypłacić."
              : "Po podpisaniu Umowy K-S i wgraniu skanu środki przechodzą z karencji do dostępnych."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missing.slice(0, 3).map((sid) => (
              <Link
                key={sid}
                href={`/panel/submissions/${sid}`}
                className="btn-ghost h-9 px-4 text-[12px] num inline-flex items-center gap-2"
              >
                {sid} <ArrowRight size={12} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
