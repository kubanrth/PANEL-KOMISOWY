import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import type { Product, Submission, AqcAudit, Photo, DerivedStatus } from "@/lib/types";
import { DERIVED_STATUS_LABEL } from "@/lib/types";
import { deriveStatus } from "@/lib/derived-status";
import { MagazynTable, type MagazynRow } from "./MagazynTable";

type Filters = {
  sort?: "newest" | "oldest" | "cheapest" | "expensive";
  vat?: "0" | "5" | "8" | "23";
  size?: string;
  status?: DerivedStatus;
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

  // Chip-filtr statusu (design C4) — liczniki per status z pełnego zbioru.
  const statusCounts = new Map<DerivedStatus, number>();
  for (const r of allRows) statusCounts.set(r.derived_status, (statusCounts.get(r.derived_status) ?? 0) + 1);

  // Apply filters
  let rows = allRows;
  if (sp.status) rows = rows.filter((r) => r.derived_status === sp.status);
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

  const sizes = Array.from(new Set(allRows.map((r) => r.size).filter(Boolean))) as string[];
  const totalValue = allRows.reduce((acc, r) => acc + r.listing_price_cents, 0);

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="magazyn"
      breadcrumb={[{ label: "Magazyn" }]}
      badges={{ magazyn: allRows.length }}
    >
      <PageHeader
        label="Panel · Produkty w komisie"
        title="Magazyn"
        sub={`${allRows.length} ${plural(allRows.length, ["koszulka", "koszulki", "koszulek"])} fizycznie w Kickback — łączna wartość listingu ${formatValue(totalValue)}.`}
      />

      {/* Filter bar — chips statusów z licznikami + pozostałe filtry */}
      <section className="mt-7 flex flex-wrap items-center gap-2">
        <StatusChip label="Wszystkie" count={allRows.length} active={!sp.status} href={buildHref({ ...sp, status: undefined })} dot="lime" />
        {(["aktywny", "oczekuje_publikacji", "zdjecia", "przyjeto", "w_trakcie_dostawy"] as DerivedStatus[])
          .filter((s) => (statusCounts.get(s) ?? 0) > 0)
          .map((s) => (
            <StatusChip
              key={s}
              label={DERIVED_STATUS_LABEL[s]}
              count={statusCounts.get(s)!}
              active={sp.status === s}
              href={buildHref({ ...sp, status: s })}
              dot={s === "aktywny" ? "mint" : s === "oczekuje_publikacji" ? "yellow" : "blue"}
            />
          ))}

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <ChipGroup
          current={sp.sort ?? "newest"}
          options={[
            { v: "newest", l: "Najkrócej" },
            { v: "oldest", l: "Najdłużej" },
            { v: "cheapest", l: "Najtańsze" },
            { v: "expensive", l: "Najdroższe" },
          ]}
          param="sort"
          existing={sp}
        />
        <ChipGroup
          current={sp.vat ?? ""}
          options={[
            { v: "", l: "VAT: każdy" },
            { v: "23", l: "23%" },
            { v: "8", l: "8%" },
            { v: "5", l: "5%" },
            { v: "0", l: "zw" },
          ]}
          param="vat"
          existing={sp}
        />
        {sizes.length > 0 && (
          <ChipGroup
            current={sp.size ?? ""}
            options={[{ v: "", l: "Rozmiar: każdy" }, ...sizes.map((s) => ({ v: s, l: s }))]}
            param="size"
            existing={sp}
          />
        )}
      </section>

      <section className="mt-6">
        {allRows.length === 0 ? (
          <EmptyState
            title="Twój magazyn jest pusty"
            sub="Jak tylko Twoja pierwsza paczka przejdzie A&QC i trafi do sprzedaży — zobaczysz tu jej stan na żywo."
            action={
              <ButtonLink href="/start" size="md">
                Nowa oferta <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        ) : (
          <MagazynTable rows={rows} />
        )}
      </section>
    </PanelShell>
  );
}

function buildHref(f: Filters): string {
  const next: Record<string, string> = {};
  if (f.sort) next.sort = f.sort;
  if (f.vat) next.vat = f.vat;
  if (f.size) next.size = f.size;
  if (f.status) next.status = f.status;
  const q = new URLSearchParams(next).toString();
  return `/panel/magazyn${q ? "?" + q : ""}`;
}

function StatusChip({
  label, count, active, href, dot,
}: {
  label: string; count: number; active: boolean; href: string; dot: "lime" | "mint" | "blue" | "yellow";
}) {
  const dotCls = { lime: "bg-lime", mint: "bg-mint", blue: "bg-blue-soft", yellow: "bg-yellow" }[dot];
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium border transition-colors ${
        active
          ? "border-lime/40 bg-lime/10 text-lime"
          : "border-border bg-surface text-text-soft hover:text-text hover:bg-surface-2"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} aria-hidden />
      {label}
      <span className="num text-[11px] opacity-70">{count}</span>
    </Link>
  );
}

function ChipGroup({
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
        const active = (current ?? "") === o.v;
        const next: Record<string, string> = {};
        if (existing.sort) next.sort = existing.sort;
        if (existing.vat) next.vat = existing.vat;
        if (existing.size) next.size = existing.size;
        if (existing.status) next.status = existing.status;
        if (o.v) next[param as string] = o.v; else delete next[param as string];
        const query = new URLSearchParams(next).toString();
        return (
          <Link
            key={o.v || "any"}
            href={`/panel/magazyn${query ? "?" + query : ""}`}
            className={`h-8 px-3 inline-flex items-center rounded-[9px] text-[12px] transition-colors ${
              active
                ? "bg-surface-3 text-text font-medium"
                : "bg-surface text-text-soft hover:bg-surface-2 hover:text-text"
            }`}
          >
            {o.l}
          </Link>
        );
      })}
    </div>
  );
}

function formatValue(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString("en-US").replace(/,/g, " ")} zł`;
}

function plural(n: number, [one, few, many]: [string, string, string]): string {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}
