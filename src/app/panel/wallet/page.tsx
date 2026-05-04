import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type { WalletTransaction, BankAccount } from "@/lib/types";
import { WithdrawForm } from "./WithdrawForm";
import { AddBankAccountForm } from "./AddBankAccountForm";

export default async function WalletPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
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
    .limit(20);
  const transactions = (txsRaw ?? []) as WalletTransaction[];

  // Bank accounts
  const { data: accountsRaw } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  const accounts = (accountsRaw ?? []) as BankAccount[];

  const isBusiness = profile.account_type === "business";

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      walletBalance={balance}
      walletAvailable={available}
      active="wallet"
      breadcrumb={[{ label: "Wallet" }]}
    >
      {/* Hero balance card */}
      <section className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <div className="card-gradient-blue p-7 lg:p-9 rounded-[24px] text-white">
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">
                Wallet · {formatDate(new Date())}
              </span>
              <span className="pill bg-white/15 text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                Subkonto Santander
              </span>
            </div>
            <div className="mt-7">
              <div className="font-bold text-[80px] lg:text-[112px] leading-none tracking-[-0.05em] num">
                {formatPLN(balance, { decimals: false })}
              </div>
              <div className="mt-3 text-white/70 text-[14px]">Saldo w portfelu</div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-5 pt-5 border-t border-white/15">
              <BalanceCol label="Dostępne" value={formatPLN(available, { decimals: false })} sub="do wypłaty teraz" hi />
              <BalanceCol label="Pending · 14d" value={formatPLN(pending, { decimals: false })} sub="po karencji" />
            </div>
          </div>
        </div>

        {/* Withdraw + accounts */}
        <div className="col-span-12 lg:col-span-5 space-y-5">
          <WithdrawForm available={available} accounts={accounts} />

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="label">Konta bankowe</div>
              <span className="text-[11px] text-text-mute num">{accounts.length}</span>
            </div>
            {accounts.length === 0 ? (
              <p className="text-[13px] text-text-soft">Brak kont. Dodaj pierwsze, by móc zlecić wypłatę.</p>
            ) : (
              <ul className="space-y-3 mb-5">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center text-[10px] font-mono text-blue-soft">
                      {a.bank_name.slice(0, 3).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] truncate">{a.bank_name}</div>
                      <div className="text-[11px] text-text-mute font-mono">
                        {a.iban.slice(0, 6)}…{a.iban.slice(-4)}
                      </div>
                    </div>
                    {a.is_default && <span className="pill pill-mint">Domyślne</span>}
                  </li>
                ))}
              </ul>
            )}
            <AddBankAccountForm />
          </div>
        </div>
      </section>

      {/* Documents prompt */}
      <PendingDocumentsCallout supabase={supabase} userId={user.id} isBusiness={isBusiness} />

      {/* Transaction history */}
      <section className="mt-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="label">Ruch w portfelu</div>
            <h2 className="mt-2 font-bold text-2xl lg:text-3xl tracking-[-0.025em]">
              Historia transakcji
            </h2>
          </div>
          <span className="text-[12px] text-text-mute num">{transactions.length} ostatnich</span>
        </div>

        {transactions.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-10 text-center text-text-soft">
            Brak transakcji. Środki pojawią się tu po pierwszej sprzedaży.
          </div>
        ) : (
          <div className="card overflow-hidden">
            {transactions.map((tx, i) => (
              <TxRow key={tx.id} tx={tx} isLast={i === transactions.length - 1} />
            ))}
          </div>
        )}
      </section>

      {/* Subkonto trust */}
      <section className="mt-12 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5">
          <div className="label">Bezpieczeństwo środków</div>
          <h3 className="mt-3 font-bold text-2xl lg:text-3xl tracking-[-0.025em]">Subkonto bankowe.</h3>
          <p className="mt-3 max-w-[44ch] text-[14px] leading-[1.65] text-text-soft">
            Środki klientów Kickback przechowujemy na osobnym subkoncie w Santander Bank Polska — odseparowanym od środków operacyjnych spółki.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-7 grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="card p-5">
            <div className="label">IBAN subkonta</div>
            <div className="mt-2 text-[12px] font-mono break-all">PL 84 1090 1014 0000 0000 0042 0042</div>
          </div>
          <div className="card p-5">
            <div className="label">BFG · gwarancja</div>
            <div className="mt-2 font-bold text-2xl tracking-[-0.035em]">100k €</div>
            <div className="text-[11px] text-text-mute">na klienta</div>
          </div>
          <div className="card p-5">
            <div className="label">Saldo subkonta</div>
            <div className="mt-2 font-bold text-2xl tracking-[-0.035em] num">{formatPLN(balance, { decimals: false })}</div>
            <div className="text-[11px] text-text-mute">{formatDate(new Date())}</div>
          </div>
        </div>
      </section>
    </PanelShell>
  );
}

function BalanceCol({ label, value, sub, hi }: { label: string; value: string; sub: string; hi?: boolean }) {
  return (
    <div>
      <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">{label}</div>
      <div className={`mt-1 font-bold text-2xl tracking-[-0.035em] num ${hi ? "text-mint" : "text-white"}`}>{value}</div>
      <div className="mt-1 text-white/60 text-[11px]">{sub}</div>
    </div>
  );
}

function TxRow({ tx, isLast }: { tx: WalletTransaction; isLast: boolean }) {
  const positive = tx.amount_cents >= 0;
  const sign = positive ? "+" : "−";
  const amountDisplay = `${sign} ${formatPLN(Math.abs(tx.amount_cents), { decimals: false })}`;
  const colorClass = positive
    ? tx.type === "sale_pending"
      ? "text-amber"
      : "text-mint"
    : "text-text-soft";

  const typeLabel = TYPE_LABEL[tx.type];

  return (
    <div className={`grid grid-cols-12 gap-4 px-6 py-4 items-center ${isLast ? "" : "border-b border-border-soft"}`}>
      <div className="col-span-2 text-[12px] text-text-mute num">{formatDate(tx.created_at)}</div>
      <div className="col-span-6 flex items-center gap-3">
        <span className={`h-1.5 w-1.5 rounded-full ${
          tx.type === "sale_pending" ? "bg-amber" :
          tx.type === "sale_unlocked" ? "bg-mint" :
          tx.type === "payout_done" || tx.type === "payout_request" ? "bg-text-mute" :
          "bg-blue-soft"
        }`} />
        <div className="min-w-0">
          <div className="text-[14px] truncate">{typeLabel}</div>
          {tx.description && <div className="text-[12px] text-text-mute truncate">{tx.description}</div>}
        </div>
      </div>
      <div className="col-span-2 text-[12px] text-text-mute num">
        {tx.reference_id ?? "—"}
      </div>
      <div className={`col-span-2 text-right font-bold text-lg tracking-[-0.025em] num ${colorClass}`}>
        {amountDisplay}
      </div>
    </div>
  );
}

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
    <section className="mt-12">
      <div className="card p-6 lg:p-7 border-amber/30 bg-amber/5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-amber/15 flex items-center justify-center text-amber flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg tracking-[-0.025em]">
              {isBusiness
                ? `Wymagane faktury sprzedażowe · ${missing.length}`
                : `Wymagane Umowy Kupna-Sprzedaży · ${missing.length}`}
            </h3>
            <p className="mt-2 text-[14px] text-text-soft max-w-[60ch]">
              {isBusiness
                ? "Po wystawieniu FV środki przechodzą z Pending do Dostępne — możesz je wypłacić."
                : "Po podpisaniu Umowy K-S i wgraniu skanu środki przechodzą z Pending do Dostępne."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {missing.slice(0, 3).map((sid) => (
                <Link
                  key={sid}
                  href={`/panel/submissions/${sid}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-surface border border-border text-[13px] hover:border-blue hover:text-blue transition-colors num"
                >
                  {sid} <ArrowRight size={12} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
