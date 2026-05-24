import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import { vatLabel } from "@/lib/types";
import type { Product, Submission, Invoice } from "@/lib/types";

type Filters = { status?: "all" | "pending" | "settled"; range?: "7" | "30" | "90" | "all" };

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

  const { data: productsRaw } = await supabase
    .from("products")
    .select("*")
    .eq("status", "sold")
    .order("sold_at", { ascending: false, nullsFirst: false });

  const sales = (productsRaw ?? []) as Product[];

  // Pull related submissions for context + invoices to determine settled status
  const subIds = Array.from(new Set(sales.map((p) => p.submission_id)));
  const { data: subs } = subIds.length
    ? await supabase
        .from("submissions")
        .select("id, commission_rate")
        .in("id", subIds)
    : { data: [] as Array<Pick<Submission, "id" | "commission_rate">> };
  const subById = new Map((subs ?? []).map((s) => [s.id, s]));

  const { data: invoicesRaw } = await supabase
    .from("invoices")
    .select("id, invoice_number, sale_product_ids, status")
    .eq("klient_id", user.id);
  const invoices = (invoicesRaw ?? []) as Pick<Invoice, "id" | "invoice_number" | "sale_product_ids" | "status">[];
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

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="sprzedaze"
      breadcrumb={[{ label: "Sprzedaże" }]}
    >
      <section>
        <div className="label">{sales.length} sprzedaży</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Sprzedaże <span className="text-text-soft">/ historia transakcji.</span>
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Pełna historia sprzedaży z datą, ceną, VAT, terminem rozliczenia oraz statusem
          (rozliczone / oczekujące). Po 14 dniach od sprzedaży środki są gotowe do wypłaty.
        </p>
      </section>

      {sales.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Sprzedanych" value={sales.length.toString()} />
            <Kpi label="Rozliczonych" value={settledCount.toString()} sub={`z ${sales.length}`} />
            <Kpi label="Oczekujące" value={(sales.length - settledCount).toString()} sub="bez faktury / UKS" />
            <Kpi
              label="Wartość brutto"
              value={formatPLN(totalValue, { decimals: false })}
              sub={range === "all" ? "łącznie" : `ostatnie ${range} dni`}
            />
          </section>

          {/* Filters */}
          <section className="mt-8 flex flex-wrap items-center gap-3">
            <FilterPills
              label="Zakres"
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
            <FilterPills
              label="Status"
              current={statusFilter}
              options={[
                { v: "all", l: "Wszystkie" },
                { v: "settled", l: "Rozliczone" },
                { v: "pending", l: "Oczekujące" },
              ]}
              param="status"
              existing={sp}
            />
          </section>

          {/* List */}
          <section className="mt-6">
            <div className="card overflow-hidden">
              <div className="hidden md:grid grid-cols-[minmax(220px,3fr)_44px_60px_120px_70px_110px_110px_120px_140px] gap-3 px-4 py-3 label border-b border-border-soft items-center">
                <div>Produkt</div>
                <div>Il.</div>
                <div>Rozm.</div>
                <div>Cena</div>
                <div>VAT</div>
                <div>Data sprz.</div>
                <div>Dni</div>
                <div>Rozliczenie</div>
                <div>Status</div>
              </div>
              {visible.map((p) => {
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
                    className="grid grid-cols-[minmax(220px,3fr)_44px_60px_120px_70px_110px_110px_120px_140px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/30"
                  >
                    <Link href={`/panel/products/${p.id}`} className="flex items-center gap-3 min-w-0 hover:text-blue transition-colors">
                      <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">{p.brand} · {p.model}</div>
                        <div className="text-[11px] text-text-mute num truncate">
                          Twój udział: {formatPLN(takeHome, { decimals: false })}
                        </div>
                      </div>
                    </Link>
                    <div className="text-[13px] num text-text-soft">1</div>
                    <div className="text-[12px] num text-text-soft">{p.size ?? "—"}</div>
                    <div className="text-[13px] font-semibold num">{formatPLN(p.listing_price_cents ?? 0, { decimals: false })}</div>
                    <div className="text-[12px] num text-text-soft">{vatLabel(p.vat_rate)}</div>
                    <div className="text-[12px] num text-text-soft">{formatDate(p.sold_at)}</div>
                    <div className="text-[12px] num text-text-soft">{daysToSold != null ? `${daysToSold} d` : "—"}</div>
                    <div className={`text-[12px] num ${p.settlement_at ? "text-text-soft" : "text-text-faint"}`}>
                      {p.settlement_at ? formatDate(p.settlement_at) : "—"}
                    </div>
                    <div>
                      {settled ? (
                        <span className="pill pill-mint">
                          <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                          Rozliczone
                          {inv?.invoice_number && <span className="ml-1 text-text-faint num">· {inv.invoice_number}</span>}
                        </span>
                      ) : (
                        <span className="pill pill-amber">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                          Oczekujące
                        </span>
                      )}
                    </div>
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

function FilterPills({
  label, current, options, param, existing,
}: {
  label: string;
  current: string;
  options: Array<{ v: string; l: string }>;
  param: keyof Filters;
  existing: Filters;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-[12px]">
      <span className="label">{label}:</span>
      {options.map((o) => {
        const active = current === o.v;
        const next: Record<string, string> = { ...existing };
        if (o.v && o.v !== "all") next[param as string] = o.v;
        else delete next[param as string];
        const query = new URLSearchParams(next).toString();
        const cls = active
          ? "bg-text text-bg font-semibold"
          : "bg-surface text-text-soft hover:bg-surface-2 hover:text-text";
        return (
          <Link key={o.v} href={`/panel/sprzedaze${query ? "?" + query : ""}`} className={`px-2.5 py-1 rounded-[8px] transition-colors ${cls}`}>
            {o.l}
          </Link>
        );
      })}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-2 font-bold text-2xl tracking-[-0.035em] num">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-text-mute">{sub}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="mt-10">
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center">
        <div className="font-bold text-xl tracking-[-0.025em]">Brak sprzedaży</div>
        <p className="mt-2 text-text-soft text-[14px]">Po pierwszej sprzedaży zobaczysz tu pełną historię.</p>
        <div className="mt-6">
          <ButtonLink href="/start" size="md">
            Nowa Oferta <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
