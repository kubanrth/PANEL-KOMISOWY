import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import { vatLabel } from "@/lib/types";
import type { Product, Submission, Invoice } from "@/lib/types";

/* Sprzedaże — design C6: KPI row, tabela grupowana nagłówkami miesięcy
   („Czerwiec 2026 — 3 szt · 8 400 zł"), pigułki W ROZLICZENIU/ROZLICZONE. */

type Filters = { status?: "all" | "pending" | "settled"; range?: "7" | "30" | "90" | "all" };

const MONTHS_PL = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

export default async function SprzedazePage(props: { searchParams: Promise<Filters> }) {
  const sp = await props.searchParams;
  const statusFilter = sp.status ?? "all";
  const range = sp.range ?? "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  // Defensive: order by sold_at (added in migration 008). If migration not
  // applied — fall back to created_at + log missing migration banner.
  let productsRaw: Product[] | null = null;
  let missingMigration = false;
  {
    const primary = await supabase
      .from("products")
      .select("*")
      .eq("status", "sold")
      .order("sold_at", { ascending: false, nullsFirst: false });
    if (primary.error?.code === "42703" /* column does not exist */) {
      missingMigration = true;
      const fallback = await supabase
        .from("products")
        .select("*")
        .eq("status", "sold")
        .order("created_at", { ascending: false });
      productsRaw = (fallback.data ?? []) as Product[];
    } else {
      productsRaw = (primary.data ?? []) as Product[];
    }
  }
  const sales = productsRaw ?? [];

  // Pull related submissions for context + invoices to determine settled status
  const subIds = Array.from(new Set(sales.map((p) => p.submission_id)));
  const { data: subs } = subIds.length
    ? await supabase
        .from("submissions")
        .select("id, commission_rate")
        .in("id", subIds)
    : { data: [] as Array<Pick<Submission, "id" | "commission_rate">> };
  const subById = new Map((subs ?? []).map((s) => [s.id, s]));

  // Invoices table from migration 009 — może nie istnieć przy partial migration.
  let invoices: Pick<Invoice, "id" | "invoice_number" | "sale_product_ids" | "status">[] = [];
  {
    const inv = await supabase
      .from("invoices")
      .select("id, invoice_number, sale_product_ids, status")
      .eq("klient_id", user.id);
    if (inv.error?.code === "42P01" /* relation does not exist */) {
      missingMigration = true;
    } else {
      invoices = (inv.data ?? []) as typeof invoices;
    }
  }
  const invoiceByProduct = new Map<string, Pick<Invoice, "id" | "invoice_number" | "status">>();
  for (const inv of invoices) {
    for (const pid of inv.sale_product_ids ?? []) {
      invoiceByProduct.set(pid, inv);
    }
  }

  // Filter by range
  let visible = sales;
  if (range !== "all") {
    const cutoff = Date.now() - parseInt(range, 10) * 86_400_000;
    visible = visible.filter((p) => p.sold_at && new Date(p.sold_at).getTime() >= cutoff);
  }
  if (statusFilter !== "all") {
    visible = visible.filter((p) => {
      const inv = invoiceByProduct.get(p.id);
      const isSettled = inv?.status === "verified";
      return statusFilter === "settled" ? isSettled : !isSettled;
    });
  }

  const totalValue = visible.reduce((acc, p) => acc + (p.listing_price_cents ?? 0), 0);
  const settledCount = sales.filter((p) => invoiceByProduct.get(p.id)?.status === "verified").length;

  // Grupowanie po miesiącu sprzedaży (bez sold_at → grupa „Bez daty").
  const groups = new Map<string, Product[]>();
  for (const p of visible) {
    const key = p.sold_at
      ? `${new Date(p.sold_at).getFullYear()}-${String(new Date(p.sold_at).getMonth()).padStart(2, "0")}`
      : "none";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const groupKeys = Array.from(groups.keys()).sort((a, b) => (a === "none" ? 1 : b === "none" ? -1 : b.localeCompare(a)));

  function groupLabel(key: string): string {
    if (key === "none") return "Bez daty sprzedaży";
    const [y, m] = key.split("-").map(Number);
    return `${MONTHS_PL[m]} ${y}`;
  }

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="sprzedaze"
      breadcrumb={[{ label: "Sprzedaże" }]}
    >
      {missingMigration && (
        <div className="mb-6 rounded-[14px] bg-yellow/8 border border-yellow/25 p-4 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow mt-0.5 flex-shrink-0" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <div className="text-[12px]">
            <div className="font-medium text-yellow">Brakuje migracji 008 lub 009</div>
            <p className="mt-1 text-text-soft">
              Strona działa w trybie ograniczonym (brak VAT / dat rozliczeń / statusu faktur).
              Uruchom migracje 008_product_enrichment + 009_invoices w Supabase SQL Editor.
            </p>
          </div>
        </div>
      )}

      <PageHeader
        label={`${sales.length} sprzedaży · historia transakcji`}
        title="Sprzedaże"
        sub="Pełna historia sprzedaży z datą, ceną, VAT i statusem rozliczenia. Po 14 dniach od sprzedaży środki są gotowe do wypłaty."
      />

      {sales.length === 0 ? (
        <section className="mt-8">
          <EmptyState
            title="Jeszcze nic nie sprzedałeś"
            sub="Wystaw pierwszą koszulkę — po pierwszej sprzedaży zobaczysz tu pełną historię."
            action={
              <ButtonLink href="/start" size="md">
                Nowa oferta <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </section>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Sprzedanych" value={sales.length} />
            <KpiCard label="Rozliczonych" value={settledCount} sub={`z ${sales.length}`} />
            <KpiCard label="W rozliczeniu" value={sales.length - settledCount} sub="bez faktury / UKS" />
            <KpiCard
              label="Wartość brutto"
              value={formatPLN(totalValue, { decimals: false })}
              mono
              sub={range === "all" ? "łącznie" : `ostatnie ${range} dni`}
            />
          </section>

          {/* Filters */}
          <section className="mt-7 flex flex-wrap items-center gap-2">
            <FilterChips
              current={range}
              options={[
                { v: "all", l: "Wszystkie" },
                { v: "7", l: "7 dni" },
                { v: "30", l: "30 dni" },
                { v: "90", l: "90 dni" },
              ]}
              param="range"
              existing={sp}
            />
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <FilterChips
              current={statusFilter}
              options={[
                { v: "all", l: "Wszystkie" },
                { v: "settled", l: "Rozliczone" },
                { v: "pending", l: "W rozliczeniu" },
              ]}
              param="status"
              existing={sp}
            />
          </section>

          {/* Lista grupowana po miesiącach */}
          <section className="mt-6">
            <div className="card table-scroll">
              <div className="hidden md:grid grid-cols-[minmax(220px,3fr)_60px_130px_56px_100px_70px_110px_170px] gap-3 px-4 h-11 label border-b border-border items-center">
                <div>Koszulka</div>
                <div>Rozm.</div>
                <div>Cena</div>
                <div>VAT</div>
                <div>Data</div>
                <div>Dni</div>
                <div>Rozliczenie</div>
                <div>Status</div>
              </div>

              {groupKeys.map((key) => {
                const items = groups.get(key)!;
                const sum = items.reduce((a, p) => a + (p.listing_price_cents ?? 0), 0);
                return (
                  <div key={key}>
                    {/* Month header */}
                    <div className="px-4 py-2.5 bg-surface-2/50 border-b border-border-soft flex items-baseline justify-between gap-3">
                      <div className="text-[12px] font-medium tracking-[-0.01em]">{groupLabel(key)}</div>
                      <div className="text-[11px] num text-text-mute">
                        {items.length} szt · {formatPLN(sum, { decimals: false })}
                      </div>
                    </div>

                    {items.map((p) => {
                      const sub = subById.get(p.submission_id);
                      const commission = sub?.commission_rate ?? 0.2;
                      const takeHome = Math.round((p.listing_price_cents ?? 0) * (1 - commission));
                      const inv = invoiceByProduct.get(p.id);
                      const settled = inv?.status === "verified";
                      const daysToSold = p.sold_at && p.published_at
                        ? Math.max(
                            0,
                            Math.floor(
                              (new Date(p.sold_at).getTime() - new Date(p.published_at).getTime()) /
                                86_400_000,
                            ),
                          )
                        : null;

                      return (
                        <div
                          key={p.id}
                          className="grid grid-cols-1 md:grid-cols-[minmax(220px,3fr)_60px_130px_56px_100px_70px_110px_170px] gap-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                        >
                          <Link href={`/panel/products/${p.id}`} className="flex items-center gap-3 min-w-0 hover:text-lime transition-colors">
                            <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
                            <div className="min-w-0">
                              <div className="text-[13.5px] font-medium truncate">{p.brand} {p.model}</div>
                              <div className="text-[11px] num text-text-mute truncate">{p.sku}</div>
                              <div className="text-[11px] text-text-mute num truncate">
                                Twój udział: <span className="text-mint">{formatPLN(takeHome, { decimals: false })}</span>
                              </div>
                            </div>
                          </Link>
                          <div className="hidden md:block text-[12px] num text-text-soft">{p.size ?? "—"}</div>
                          <div className="hidden md:block text-[13px] num">{formatPLN(p.listing_price_cents ?? 0, { decimals: false })}</div>
                          <div className="hidden md:block text-[12px] num text-text-soft">{vatLabel(p.vat_rate)}</div>
                          <div className="hidden md:block text-[12px] num text-text-soft">{formatDate(p.sold_at)}</div>
                          <div className="hidden md:block text-[12px] num text-text-soft">{daysToSold != null ? `${daysToSold} d` : "—"}</div>
                          <div className={`hidden md:block text-[12px] num ${p.settlement_at ? "text-text-soft" : "text-text-faint"}`}>
                            {p.settlement_at ? formatDate(p.settlement_at) : "—"}
                          </div>
                          <div className="flex md:block items-center gap-2">
                            {settled ? (
                              <span className="pill pill-mint">
                                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                                Rozliczone
                              </span>
                            ) : (
                              <span className="pill pill-yellow">
                                <span className="h-1.5 w-1.5 rounded-full bg-yellow" />
                                W rozliczeniu
                              </span>
                            )}
                            {settled && inv?.invoice_number && (
                              <span className="md:mt-1 block text-[10px] num text-text-faint">{inv.invoice_number}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {visible.length === 0 && (
                <div className="px-6 py-12 text-center text-[13px] text-text-soft">
                  Brak sprzedaży w tym zakresie.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </PanelShell>
  );
}

function FilterChips({
  current, options, param, existing,
}: {
  current: string;
  options: Array<{ v: string; l: string }>;
  param: keyof Filters;
  existing: Filters;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((o) => {
        const active = current === o.v;
        const next: Record<string, string> = { ...existing };
        if (o.v && o.v !== "all") next[param as string] = o.v;
        else delete next[param as string];
        const query = new URLSearchParams(next).toString();
        return (
          <Link
            key={o.v}
            href={`/panel/sprzedaze${query ? "?" + query : ""}`}
            className={`inline-flex items-center h-9 px-3.5 rounded-full text-[13px] font-medium border transition-colors active:scale-[.98] ${
              active
                ? "border-lime/40 bg-lime/10 text-lime"
                : "border-border bg-surface text-text-soft hover:text-text hover:bg-surface-2"
            }`}
          >
            {o.l}
          </Link>
        );
      })}
    </div>
  );
}
