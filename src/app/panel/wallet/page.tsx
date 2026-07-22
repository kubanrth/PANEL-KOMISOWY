import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile, getWalletSummary } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type { BankAccount, Payout, Product } from "@/lib/types";
import { PayoutPicker, type PayoutRow } from "./PayoutPicker";

/* Wallet — wypłaty per pozycja: komisant zaznacza sprzedane produkty
   i zleca wypłatę dokładnie za nie. Historia pokazuje wyłącznie etapy
   wypłat (bez wpisów sprzedażowych). Karencja = „Pending payout". */

export default async function WalletPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { balance, available, pending } = await getWalletSummary();

  const [productsRes, txRes, payoutsRes, accountsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, brand, model, size, status, sold_at, payout_id, submissions!inner(klient_id)")
      .eq("status", "sold")
      .eq("submissions.klient_id", user.id)
      .order("sold_at", { ascending: false }),
    supabase
      .from("wallet_transactions")
      .select("reference_id, type, amount_cents, available_at")
      .eq("klient_id", user.id)
      .in("type", ["sale_pending", "sale_unlocked"]),
    supabase
      .from("payouts")
      .select("*")
      .eq("klient_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(30),
    supabase
      .from("bank_accounts")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const soldProducts = (productsRes.data ?? []) as unknown as Array<
    Pick<Product, "id" | "brand" | "model" | "size" | "sold_at"> & { payout_id: string | null }
  >;
  const payouts = (payoutsRes.data ?? []) as Payout[];
  const accounts = (accountsRes.data ?? []) as BankAccount[];
  const defaultAccount = accounts[0];
  const isBusiness = profile.account_type === "business";

  // Transakcja sprzedażowa per produkt (ref PROD-{id}) → kwota + dojrzałość.
  const txByProduct = new Map<string, { amount: number; matured: boolean; availableAt: string | null }>();
  for (const t of txRes.data ?? []) {
    const pid = t.reference_id?.startsWith("PROD-") ? t.reference_id.slice(5) : null;
    if (!pid) continue;
    const matured = t.type === "sale_unlocked" || (!!t.available_at && new Date(t.available_at) <= new Date());
    txByProduct.set(pid, { amount: t.amount_cents, matured, availableAt: t.available_at });
  }
  const payoutById = new Map(payouts.map((p) => [p.id, p]));

  const rows: PayoutRow[] = soldProducts
    .map((p): PayoutRow | null => {
      const tx = txByProduct.get(p.id);
      if (!tx) return null;
      const state: PayoutRow["state"] = p.payout_id ? "in_payout" : tx.matured ? "available" : "pending";
      return {
        id: p.id,
        name: [p.brand, p.model].filter(Boolean).join(" · ") + (p.size ? ` · ${p.size}` : ""),
        soldAt: p.sold_at,
        amountCents: tx.amount,
        state,
        availableAt: tx.availableAt,
        payoutStatus: p.payout_id ? payoutById.get(p.payout_id)?.status ?? null : null,
      };
    })
    .filter((r): r is PayoutRow => r !== null);

  return (
    <>
      <PageHeader label={`Wallet · ${formatDate(new Date())}`} title="Portfel" />
      <p className="mt-3 text-[15px] leading-[1.55] text-text-soft max-w-[78ch]">
        Wypłaty zlecasz za konkretne sprzedane pozycje — zaznacz je poniżej i kliknij „Zleć wypłatę".
        Środki ze świeżej sprzedaży są w statusie pending payout przez 14 dni, potem możesz je wypłacić;
        przelew realizujemy w ciągu 72h od autoryzacji.
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
                  Wypłać za pozycje <ArrowRight size={16} />
                </ButtonLink>
                <span className="text-[12px] text-white/60 num">
                  Saldo całkowite: {formatPLN(balance, { decimals: false })}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Pending payout"
              value={<span className="text-yellow">{formatPLN(pending, { decimals: false })}</span>}
              mono
              sub="dostępne 14 dni po sprzedaży"
            />
            <KpiCard
              label="Wypłacone łącznie"
              value={formatPLN(
                payouts.filter((p) => p.status === "done").reduce((a, p) => a + p.amount_cents, 0),
                { decimals: false },
              )}
              mono
              sub="zrealizowane wypłaty"
            />
          </div>
        </div>

        {/* Prawy panel: konto z umowy */}
        <div className="col-span-12 lg:col-span-5 space-y-5">
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
              Wypłaty za zaznaczone pozycje trafiają na to konto. Ustala je Kickback na podstawie umowy komisowej.
            </p>
          </div>

          <div className="card p-6">
            <div className="label mb-3">Dokumenty do wypłat</div>
            <p className="text-[12.5px] text-text-soft leading-[1.55]">
              {isBusiness
                ? "Rozliczasz się fakturą — wystaw FV na kwotę wypłaty i wgraj ją w Fakturach."
                : "Rozliczasz się przez UKS — umowę generujemy przy zleceniu wypłaty, podpisujesz ją w zakładce UKS."}
            </p>
            <div className="mt-3">
              <ButtonLink href={isBusiness ? "/panel/faktury" : "/panel/uks"} variant="ghost" size="sm">
                {isBusiness ? "Przejdź do Faktur" : "Przejdź do UKS"} <ArrowRight size={14} />
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Wypłata per pozycja */}
      <section className="mt-10" id="wyplata">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="label">Sprzedane pozycje</div>
            <h2 className="mt-2 font-light text-[22px] tracking-[-0.02em]">Wypłać za pozycje</h2>
          </div>
          <span className="text-[12px] text-text-mute num">{rows.length} sprzedanych</span>
        </div>
        <PayoutPicker rows={rows} isBusiness={isBusiness} />
      </section>

      {/* Historia wypłat — wyłącznie etapy realizacji */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="label">Ruch w portfelu</div>
            <h2 className="mt-2 font-light text-[22px] tracking-[-0.02em]">Historia transakcji</h2>
          </div>
          <span className="text-[12px] text-text-mute num">{payouts.length} wypłat</span>
        </div>

        {payouts.length === 0 ? (
          <EmptyState
            title="Brak wypłat"
            sub="Historia pokaże każdą zleconą wypłatę i etap jej realizacji."
          />
        ) : (
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[110px_minmax(180px,1fr)_150px_130px_130px] gap-3 px-4 h-11 label border-b border-border items-center">
              <div>Zlecona</div>
              <div>Wypłata</div>
              <div>Etap</div>
              <div className="text-right">Kwota</div>
              <div className="text-right">Zrealizowana</div>
            </div>
            {payouts.map((p) => {
              const st = PAYOUT_STAGE[p.status] ?? { label: p.status, variant: "mute" as PillVariant };
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-2 md:grid-cols-[110px_minmax(180px,1fr)_150px_130px_130px] gap-2 md:gap-3 px-4 py-3.5 md:items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <div className="text-[12px] num text-text-soft">{formatDate(p.requested_at)}</div>
                  <div className="min-w-0 col-span-2 md:col-span-1 order-3 md:order-none">
                    <div className="text-[13.5px] font-medium truncate">{p.notes ?? "Wypłata na konto"}</div>
                    <div className="text-[11px] num text-text-mute truncate">PAY-{p.id}</div>
                  </div>
                  <div className="text-right md:text-left"><Pill variant={st.variant}>{st.label}</Pill></div>
                  <div className="text-[13px] num md:text-right font-medium text-coral">
                    − {formatPLN(p.amount_cents, { decimals: false })}
                  </div>
                  <div className="text-[12px] num text-text-soft text-right">
                    {p.executed_at ? formatDate(p.executed_at) : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

/* Etapy wypłaty — mapowanie payout_status na vocab pigułek. */
const PAYOUT_STAGE: Record<string, { label: string; variant: PillVariant }> = {
  requested: { label: "Zlecona", variant: "yellow" },
  authorized: { label: "Autoryzowana", variant: "blue" },
  executing: { label: "W realizacji", variant: "blue" },
  done: { label: "Zrealizowana", variant: "mint" },
  failed: { label: "Nieudana", variant: "coral" },
  cancelled: { label: "Anulowana", variant: "mute" },
};
