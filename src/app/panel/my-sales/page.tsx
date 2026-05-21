import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ProductStatusPill } from "@/components/panel/StatusPill";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate, takeHomeCents } from "@/lib/format";
import type { Product, ProductStatus } from "@/lib/types";

type ProductWithSubmission = Product & {
  submission: { id: string; status: string; commission_rate: number; created_at: string } | null;
};

type FilterKey = "all" | "listed" | "sold" | "aqc" | "offer" | "draft";

const FILTERS: Array<{ key: FilterKey; label: string; matches: (s: ProductStatus) => boolean }> = [
  { key: "all", label: "Wszystkie", matches: () => true },
  { key: "draft", label: "Szkic", matches: (s) => s === "draft" },
  { key: "aqc", label: "A&QC", matches: (s) => s === "aqc" },
  { key: "listed", label: "W sprzedaży", matches: (s) => s === "listed" },
  { key: "offer", label: "Oferty", matches: (s) => s === "offer" },
  { key: "sold", label: "Sprzedane", matches: (s) => s === "sold" },
];

export default async function MySalesPage(props: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await props.searchParams;
  const filterKey = (FILTERS.find((f) => f.key === filter)?.key ?? "all") as FilterKey;

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

  // Two separate queries — embedded relations through RLS sometimes 500 in PostgREST.
  // Klienci widzą tylko swoje przez RLS, więc nie potrzebujemy .eq po stronie klienta.
  const { data: productsRaw } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  const productList = (productsRaw ?? []) as Product[];
  const submissionIds = Array.from(new Set(productList.map((p) => p.submission_id))).filter(Boolean);

  const { data: subsRaw } = submissionIds.length
    ? await supabase
        .from("submissions")
        .select("id, status, commission_rate, created_at")
        .in("id", submissionIds)
    : { data: [] as Array<{ id: string; status: string; commission_rate: number; created_at: string }> };

  const subById = new Map((subsRaw ?? []).map((s) => [s.id, s]));

  const allProducts: ProductWithSubmission[] = productList.map((p) => ({
    ...p,
    submission: subById.get(p.submission_id) ?? null,
  }));
  const activeFilter = FILTERS.find((f) => f.key === filterKey)!;
  const products = allProducts.filter((p) => activeFilter.matches(p.status));

  // Counts per filter for the chips
  const counts = FILTERS.reduce<Record<FilterKey, number>>(
    (acc, f) => {
      acc[f.key] = allProducts.filter((p) => f.matches(p.status)).length;
      return acc;
    },
    {} as Record<FilterKey, number>,
  );

  // Aggregates
  const totalGross = products.reduce(
    (acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0),
    0,
  );
  const totalTakeHome = products.reduce(
    (acc, p) =>
      acc +
      (takeHomeCents(
        p.listing_price_cents ?? p.expected_price_cents ?? 0,
        p.submission?.commission_rate ?? 0.2,
      ) ?? 0),
    0,
  );

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="my-sales"
      breadcrumb={[{ label: "My Sales" }]}
    >
      <section>
        <div className="label">{allProducts.length} produktów łącznie</div>
        <h1 className="mt-4 font-bold text-[40px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
          My Sales <span className="text-text-soft">/ Twoja sprzedaż.</span>
        </h1>
        <p className="mt-4 text-[16px] text-text-soft max-w-[60ch]">
          Wszystkie powierzone rzeczy z różnych Ofert w jednym widoku. Filtruj po statusie, klikaj w produkt by zobaczyć szczegóły.
        </p>
      </section>

      {allProducts.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPI strip */}
          <section className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="W sprzedaży" value={counts.listed} sub="aktywne listingi" />
            <Kpi label="Sprzedane" value={counts.sold} sub="zakończone" />
            <Kpi
              label="Wartość listing"
              value={null}
              custom={<span className="font-bold text-3xl tracking-[-0.04em] num">{formatPLN(totalGross, { decimals: false })}</span>}
              sub={`po filtrze: ${activeFilter.label.toLowerCase()}`}
            />
            <Kpi
              label="Twój udział"
              value={null}
              custom={<span className="font-bold text-3xl tracking-[-0.04em] num text-mint">{formatPLN(totalTakeHome, { decimals: false })}</span>}
              sub="po prowizji"
            />
          </section>

          {/* Filters */}
          <section className="mt-10">
            <div className="flex items-center gap-2 flex-wrap text-[13px]">
              {FILTERS.map((f) => {
                const active = f.key === filterKey;
                const cls = active
                  ? "bg-text text-bg font-semibold"
                  : "bg-surface text-text-soft hover:bg-surface-2 hover:text-text";
                return (
                  <Link
                    key={f.key}
                    href={f.key === "all" ? "/panel/my-sales" : `/panel/my-sales?filter=${f.key}`}
                    className={`px-3 py-1.5 rounded-[10px] transition-colors ${cls}`}
                  >
                    {f.label} <span className={`num ml-1 ${active ? "text-bg/70" : "text-text-mute"}`}>· {counts[f.key]}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* List */}
          <section className="mt-6">
            {products.length === 0 ? (
              <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
                Brak produktów pasujących do filtra „{activeFilter.label.toLowerCase()}".
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((p) => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </PanelShell>
  );
}

function ProductRow({ product }: { product: ProductWithSubmission }) {
  const price = product.listing_price_cents ?? product.expected_price_cents ?? 0;
  const commission = product.submission?.commission_rate ?? 0.2;
  const takeHome = takeHomeCents(price, commission) ?? 0;

  return (
    <Link
      href={`/panel/products/${product.id}`}
      className="block card p-5 hover:border-blue/40 transition-colors group"
    >
      <div className="grid grid-cols-12 gap-5 items-center">
        <div className="col-span-12 md:col-span-5 flex items-center gap-4">
          <ProductThumb photos={product.photos} brand={product.brand} size="md" />
          <div className="min-w-0">
            <div className="font-semibold text-[15px] truncate">
              {product.brand} <span className="text-text-soft">·</span> {product.model}
            </div>
            <div className="mt-1 text-[12px] text-text-mute num">
              {[product.category, product.size, product.condition && `stan ${product.condition}/10`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </div>

        <div className="col-span-6 md:col-span-2">
          <ProductStatusPill status={product.status} />
        </div>

        <div className="col-span-6 md:col-span-2">
          {product.submission && (
            <Link
              href={`/panel/submissions/${product.submission.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[12px] text-text-mute hover:text-text num"
            >
              {product.submission.id}
              <span className="block text-[11px] text-text-faint">
                {formatDate(product.submission.created_at)}
              </span>
            </Link>
          )}
        </div>

        <div className="col-span-6 md:col-span-2 text-right">
          <div className="text-[11px] text-text-mute font-semibold uppercase">Cena</div>
          <div className="font-bold text-lg tracking-[-0.025em] num">
            {formatPLN(price, { decimals: false })}
          </div>
        </div>

        <div className="col-span-6 md:col-span-1 text-right">
          <div className="text-[11px] text-text-mute font-semibold uppercase">Udział</div>
          <div className="font-semibold text-[13px] num text-mint">
            {formatPLN(takeHome, { decimals: false })}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Kpi({
  label, value, custom, sub,
}: {
  label: string;
  value: number | null;
  custom?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="card p-5">
      <div className="label">{label}</div>
      {custom ?? (
        <div className="mt-3 font-bold text-3xl tracking-[-0.04em] num">{value}</div>
      )}
      {sub && <div className="mt-2 text-[12px] text-text-mute">{sub}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="mt-12">
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[24px] p-12 lg:p-16 text-center">
        <div className="font-bold text-2xl lg:text-3xl tracking-[-0.025em]">
          Brak produktów w My Sales
        </div>
        <p className="mt-3 text-text-soft max-w-[44ch] mx-auto">
          Po dodaniu Oferty Twoje produkty pojawią się tutaj — ze statusami, wycenami i kontrolą sprzedaży.
        </p>
        <div className="mt-8">
          <ButtonLink href="/start" size="lg">
            Stwórz pierwszą Ofertę <ArrowRight size={18} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
