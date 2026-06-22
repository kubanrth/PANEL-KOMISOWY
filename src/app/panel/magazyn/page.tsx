import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN } from "@/lib/format";
import type { Product, Submission, AqcAudit, Photo, DerivedStatus } from "@/lib/types";
import { deriveStatus } from "@/lib/derived-status";
import { MagazynTable, type MagazynRow } from "./MagazynTable";

type Filters = {
  sort?: "newest" | "oldest" | "cheapest" | "expensive";
  vat?: "0" | "5" | "8" | "23";
  size?: string;
};

// Only "in-stock" raw statuses count for Magazyn.
const IN_STOCK = new Set<Product["status"]>(["draft", "aqc", "listed", "offer"]);

export default async function MagazynPage(props: { searchParams: Promise<Filters> }) {
  const sp = await props.searchParams;

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
    .order("created_at", { ascending: false });

  const all = (productsRaw ?? []) as Product[];
  const stock = all.filter((p) => IN_STOCK.has(p.status));

  // Fetch related submissions + aqc audits in one batch each.
  const submissionIds = Array.from(new Set(stock.map((p) => p.submission_id)));
  const { data: subs } = submissionIds.length
    ? await supabase
        .from("submissions")
        .select("id, status, created_at")
        .in("id", submissionIds)
    : { data: [] as Array<Pick<Submission, "id" | "status" | "created_at">> };
  const subById = new Map((subs ?? []).map((s) => [s.id, s]));

  const productIds = stock.map((p) => p.id);
  const { data: audits } = productIds.length
    ? await supabase
        .from("aqc_audits")
        .select("product_id, recommended_price_cents, decided_at")
        .in("product_id", productIds)
    : { data: [] as Array<Pick<AqcAudit, "product_id" | "recommended_price_cents" | "decided_at">> };
  const auditByProduct = new Map((audits ?? []).map((a) => [a.product_id, a]));

  // Build typed rows for the client table
  const allRows: MagazynRow[] = stock.map((p) => {
    const sub = subById.get(p.submission_id);
    const audit = auditByProduct.get(p.id);
    const sinceTs = p.published_at ?? p.created_at;
    const days = Math.max(0, Math.floor((Date.now() - new Date(sinceTs).getTime()) / 86_400_000));
    const photo = (p.photos as Photo[])?.[0]?.url ?? null;
    const derived: DerivedStatus = deriveStatus(
      p,
      sub?.status,
      Boolean(audit?.recommended_price_cents),
    );
    return {
      id: p.id,
      brand: p.brand,
      model: p.model,
      sku: p.sku,
      size: p.size,
      vat_rate: p.vat_rate ?? 0.23,
      photo_url: photo,
      listing_price_cents: p.listing_price_cents ?? p.expected_price_cents ?? 0,
      recommended_price_cents: audit?.recommended_price_cents ?? null,
      published_at: p.published_at,
      sold_at: p.sold_at,
      settlement_at: p.settlement_at,
      derived_status: derived,
      days_in_commission: days,
    };
  });

  // Apply filters
  let rows = allRows;
  if (sp.vat) {
    const target = sp.vat === "0" ? 0 : Number(sp.vat) / 100;
    rows = rows.filter((r) => Math.abs(r.vat_rate - target) < 0.001);
  }
  if (sp.size) {
    rows = rows.filter((r) => (r.size ?? "").toLowerCase() === sp.size!.toLowerCase());
  }
  switch (sp.sort) {
    case "oldest":
      rows = [...rows].sort((a, b) => b.days_in_commission - a.days_in_commission);
      break;
    case "cheapest":
      rows = [...rows].sort((a, b) => a.listing_price_cents - b.listing_price_cents);
      break;
    case "expensive":
      rows = [...rows].sort((a, b) => b.listing_price_cents - a.listing_price_cents);
      break;
    case "newest":
    default:
      rows = [...rows].sort((a, b) => a.days_in_commission - b.days_in_commission);
      break;
  }

  // Build unique size dropdown
  const sizes = Array.from(new Set(allRows.map((r) => r.size).filter(Boolean))) as string[];

  const totalValue = allRows.reduce((acc, r) => acc + r.listing_price_cents, 0);
  const visibleValue = rows.reduce((acc, r) => acc + r.listing_price_cents, 0);

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="magazyn"
      breadcrumb={[{ label: "Magazyn" }]}
    >
      <section>
        <div className="label">Live podgląd magazynu</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Magazyn <span className="text-text-soft">/ Twój stock.</span>
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Wszystkie pozycje w magazynie Kickback. Zmień cenę pojedynczego produktu (admin akceptuje)
          lub zaznacz wiele pozycji i wycofaj je hurtowo z komisu.
        </p>
      </section>

      {/* KPI */}
      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Pozycji w magazynie" value={allRows.length.toString()} sub={`widoczne: ${rows.length}`} />
        <Kpi label="W sprzedaży" value={allRows.filter((r) => r.derived_status === "aktywny").length.toString()} sub="aktywne listingi" />
        <Kpi
          label="Wartość listingu"
          value={formatPLN(visibleValue, { decimals: false })}
          sub={sp.vat || sp.size ? "po filtrze" : `łącznie: ${formatPLN(totalValue, { decimals: false })}`}
        />
        <Kpi
          label="Średnio dni"
          value={
            allRows.length
              ? Math.round(allRows.reduce((a, r) => a + r.days_in_commission, 0) / allRows.length).toString()
              : "—"
          }
          sub="w magazynie"
        />
      </section>

      {/* Filters */}
      <section className="mt-8 flex flex-wrap items-center gap-3">
        <FilterGroup
          label="Sortuj"
          current={sp.sort ?? "newest"}
          options={[
            { v: "newest", l: "Najkrócej w komisie" },
            { v: "oldest", l: "Najdłużej w komisie" },
            { v: "cheapest", l: "Najtańsze" },
            { v: "expensive", l: "Najdroższe" },
          ]}
          param="sort"
          existing={sp}
        />
        <FilterGroup
          label="VAT"
          current={sp.vat ?? ""}
          options={[
            { v: "", l: "Każdy" },
            { v: "23", l: "23%" },
            { v: "8", l: "8%" },
            { v: "5", l: "5%" },
            { v: "0", l: "zw" },
          ]}
          param="vat"
          existing={sp}
        />
        {sizes.length > 0 && (
          <FilterGroup
            label="Rozmiar"
            current={sp.size ?? ""}
            options={[{ v: "", l: "Każdy" }, ...sizes.map((s) => ({ v: s, l: s }))]}
            param="size"
            existing={sp}
          />
        )}
      </section>

      <section className="mt-6">
        {allRows.length === 0 ? (
          <EmptyMagazyn />
        ) : (
          <MagazynTable rows={rows} />
        )}
      </section>
    </PanelShell>
  );
}

function FilterGroup({
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
        const active = (current ?? "") === o.v;
        const next: Record<string, string> = { ...existing };
        if (o.v) next[param as string] = o.v; else delete next[param as string];
        const query = new URLSearchParams(next).toString();
        const cls = active
          ? "bg-text text-bg font-semibold"
          : "bg-surface text-text-soft hover:bg-surface-2 hover:text-text";
        return (
          <Link
            key={o.v || "any"}
            href={`/panel/magazyn${query ? "?" + query : ""}`}
            className={`px-2.5 py-1 rounded-[8px] transition-colors ${cls}`}
          >
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

function EmptyMagazyn() {
  return (
    <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center">
      <div className="font-bold text-xl tracking-[-0.025em]">Pusty magazyn</div>
      <p className="mt-2 text-text-soft max-w-[44ch] mx-auto text-[14px]">
        Jak tylko Twoja pierwsza paczka przejdzie A&amp;QC i trafi do sprzedaży —
        zobaczysz tu jej stan na żywo.
      </p>
      <div className="mt-6">
        <ButtonLink href="/start" size="md">
          Nowa Oferta <ArrowRight size={16} />
        </ButtonLink>
      </div>
    </div>
  );
}
