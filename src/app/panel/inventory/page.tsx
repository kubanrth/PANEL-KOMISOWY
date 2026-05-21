import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ProductStatusPill } from "@/components/panel/StatusPill";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN } from "@/lib/format";
import type { Product, ProductStatus, PricingMode } from "@/lib/types";

// Inventory = produkty aktualnie w naszym magazynie (sklad / sprzedaż).
// Wyklucza draft/withdrawn/returned/sold.
const IN_STOCK: ReadonlySet<ProductStatus> = new Set(["aqc", "listed", "offer"]);

type Row = Product & {
  submission_id: string;
  submission_created_at: string | null;
};

export default async function InventoryPage(props: {
  searchParams: Promise<{ filter?: string; mode?: string }>;
}) {
  const { filter, mode } = await props.searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    .order("created_at", { ascending: false });

  const all = (productsRaw ?? []) as Product[];
  const inStock = all.filter((p) => IN_STOCK.has(p.status));

  // Build a map of submissions for created_at backref (fire only if needed)
  const subIds = Array.from(new Set(inStock.map((p) => p.submission_id)));
  const { data: subsRaw } = subIds.length
    ? await supabase.from("submissions").select("id, created_at").in("id", subIds)
    : { data: [] as Array<{ id: string; created_at: string }> };
  const subDate = new Map((subsRaw ?? []).map((s) => [s.id, s.created_at]));

  const rows: Row[] = inStock.map((p) => ({
    ...p,
    submission_created_at: subDate.get(p.submission_id) ?? null,
  }));

  // Filter chips
  const STATUS_FILTERS: Array<{ key: string; label: string; matches: (s: ProductStatus) => boolean }> = [
    { key: "all", label: "Wszystkie", matches: () => true },
    { key: "listed", label: "W sprzedaży", matches: (s) => s === "listed" },
    { key: "offer", label: "W ofercie", matches: (s) => s === "offer" },
    { key: "aqc", label: "A&QC", matches: (s) => s === "aqc" },
  ];
  const activeStatus = STATUS_FILTERS.find((f) => f.key === filter) ?? STATUS_FILTERS[0];

  const MODE_FILTERS: Array<{ key: string; label: string; matches: (m: PricingMode) => boolean }> = [
    { key: "any", label: "Każdy model", matches: () => true },
    { key: "commission", label: "Prowizja 20%", matches: (m) => m === "commission" },
    { key: "payout", label: "Stała wypłata", matches: (m) => m === "payout" },
  ];
  const activeMode = MODE_FILTERS.find((f) => f.key === mode) ?? MODE_FILTERS[0];

  const visible = rows.filter(
    (p) => activeStatus.matches(p.status) && activeMode.matches((p.pricing_mode ?? "commission") as PricingMode),
  );

  // Aggregates over the visible set
  const sumListing = visible.reduce((acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0), 0);
  const sumPayout = visible.reduce((acc, p) => {
    if (p.pricing_mode === "payout") return acc + (p.payout_price_cents ?? 0);
    const price = p.listing_price_cents ?? p.expected_price_cents ?? 0;
    return acc + Math.round(price * 0.8);
  }, 0);

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="inventory"
      breadcrumb={[{ label: "Inventory" }]}
    >
      <section>
        <div className="label">Live podgląd magazynu</div>
        <h1 className="mt-4 font-bold text-[40px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
          Inventory <span className="text-text-soft">/ stan magazynu.</span>
        </h1>
        <p className="mt-4 text-[16px] text-text-soft max-w-[60ch]">
          Wszystkie Twoje rzeczy aktualnie w magazynie Kickback — z cenami, rozmiarami
          i statusem. Możesz w każdej chwili poprosić o wycofanie pozycji ze stocku.
        </p>
      </section>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPI strip */}
          <section className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Pozycji w magazynie" value={rows.length.toString()} sub={`po filtrach: ${visible.length}`} />
            <Kpi label="W sprzedaży" value={rows.filter((p) => p.status === "listed").length.toString()} sub="aktywne listingi" />
            <Kpi
              label="Wartość listingu"
              value={formatPLN(sumListing, { decimals: false })}
              sub={`po filtrze: ${activeStatus.label.toLowerCase()}`}
              big
            />
            <Kpi
              label="Tw. wypłata (szac.)"
              value={formatPLN(sumPayout, { decimals: false })}
              sub="po prowizji / wg stałej wypłaty"
              accent="text-mint"
              big
            />
          </section>

          {/* Filters */}
          <section className="mt-10 flex flex-wrap items-center gap-3">
            <div className="text-[12px] text-text-mute font-semibold uppercase tracking-wider mr-1">Status:</div>
            <div className="flex items-center gap-2 flex-wrap text-[13px]">
              {STATUS_FILTERS.map((f) => {
                const active = f.key === activeStatus.key;
                const count = rows.filter((p) => f.matches(p.status)).length;
                const cls = active
                  ? "bg-text text-bg font-semibold"
                  : "bg-surface text-text-soft hover:bg-surface-2 hover:text-text";
                const next = new URLSearchParams();
                if (f.key !== "all") next.set("filter", f.key);
                if (mode && mode !== "any") next.set("mode", mode);
                return (
                  <Link
                    key={f.key}
                    href={`/panel/inventory${next.toString() ? "?" + next.toString() : ""}`}
                    className={`px-3 py-1.5 rounded-[10px] transition-colors ${cls}`}
                  >
                    {f.label} <span className={`num ml-1 ${active ? "text-bg/70" : "text-text-mute"}`}>· {count}</span>
                  </Link>
                );
              })}
            </div>

            <span className="hidden md:inline mx-2 text-text-faint">·</span>

            <div className="text-[12px] text-text-mute font-semibold uppercase tracking-wider mr-1">Model:</div>
            <div className="flex items-center gap-2 flex-wrap text-[13px]">
              {MODE_FILTERS.map((f) => {
                const active = f.key === activeMode.key;
                const cls = active
                  ? "bg-text text-bg font-semibold"
                  : "bg-surface text-text-soft hover:bg-surface-2 hover:text-text";
                const next = new URLSearchParams();
                if (filter && filter !== "all") next.set("filter", filter);
                if (f.key !== "any") next.set("mode", f.key);
                return (
                  <Link
                    key={f.key}
                    href={`/panel/inventory${next.toString() ? "?" + next.toString() : ""}`}
                    className={`px-3 py-1.5 rounded-[10px] transition-colors ${cls}`}
                  >
                    {f.label}
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Table */}
          <section className="mt-6">
            {visible.length === 0 ? (
              <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
                Brak pozycji pasujących do filtrów.
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 label border-b border-border-soft">
                  <div className="col-span-4">Produkt</div>
                  <div className="col-span-1">Rozmiar</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Model</div>
                  <div className="col-span-2 text-right">Cena / Wypłata</div>
                  <div className="col-span-1 text-right">Akcja</div>
                </div>

                {visible.map((p) => (
                  <InventoryRow key={p.id} p={p} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </PanelShell>
  );
}

function InventoryRow({ p }: { p: Row }) {
  const mode: PricingMode = (p.pricing_mode ?? "commission") as PricingMode;
  const price = p.listing_price_cents ?? p.expected_price_cents ?? 0;
  const payout = mode === "payout" ? (p.payout_price_cents ?? 0) : Math.round(price * 0.8);

  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/30 transition-colors">
      <Link href={`/panel/products/${p.id}`} className="col-span-12 md:col-span-4 flex items-center gap-4 min-w-0 group">
        <ProductThumb photos={p.photos} brand={p.brand} size="md" />
        <div className="min-w-0">
          <div className="font-semibold text-[15px] truncate group-hover:text-blue transition-colors">
            {p.brand} <span className="text-text-soft">·</span> {p.model}
          </div>
          <div className="mt-1 text-[12px] text-text-mute num truncate">
            {[p.category, p.condition && `stan ${p.condition}/10`].filter(Boolean).join(" · ")} ·{" "}
            <span className="text-text-faint">{p.submission_id}</span>
          </div>
        </div>
      </Link>

      <div className="col-span-6 md:col-span-1 text-[13px] num text-text-soft">
        {p.size ?? "—"}
      </div>

      <div className="col-span-6 md:col-span-2">
        <ProductStatusPill status={p.status} />
      </div>

      <div className="col-span-6 md:col-span-2">
        <span className={`pill ${mode === "payout" ? "pill-mint" : "pill-blue"}`}>
          {mode === "payout" ? "Stała wypłata" : "Prowizja 20%"}
        </span>
      </div>

      <div className="col-span-6 md:col-span-2 text-right">
        <div className="font-bold text-[16px] tracking-[-0.025em] num">
          {formatPLN(price, { decimals: false })}
        </div>
        <div className="text-[11px] text-mint num">
          → {formatPLN(payout, { decimals: false })}
        </div>
      </div>

      <div className="col-span-12 md:col-span-1 text-right">
        {(p.status === "listed" || p.status === "aqc") ? (
          <Link
            href={`/panel/products/${p.id}/withdraw`}
            className="text-[12px] text-amber hover:underline inline-flex items-center gap-1"
          >
            Wycofaj
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <span className="text-[12px] text-text-faint">—</span>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label, value, sub, big = false, accent = "",
}: {
  label: string; value: string; sub?: string; big?: boolean; accent?: string;
}) {
  return (
    <div className="card p-5">
      <div className="label">{label}</div>
      <div className={`mt-3 font-bold tracking-[-0.04em] num ${big ? "text-2xl lg:text-3xl" : "text-3xl"} ${accent}`}>
        {value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-text-mute">{sub}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="mt-12">
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[24px] p-12 lg:p-16 text-center">
        <div className="font-bold text-2xl lg:text-3xl tracking-[-0.025em]">
          Pusty magazyn
        </div>
        <p className="mt-3 text-text-soft max-w-[44ch] mx-auto">
          Jak tylko Twoja pierwsza paczka przejdzie A&amp;QC i trafi do sprzedaży —
          zobaczysz tu jej stan na żywo.
        </p>
        <div className="mt-8">
          <ButtonLink href="/start" size="lg">
            Nowa Oferta <ArrowRight size={18} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
