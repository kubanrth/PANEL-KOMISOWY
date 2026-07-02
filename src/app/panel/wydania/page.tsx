import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { Pill } from "@/components/panel/StatusPill";
import { formatPLN, formatDate } from "@/lib/format";
import type { Product, AppReturn } from "@/lib/types";

/**
 * Wydania magazynowe = ruch towaru OUT z magazynu: sprzedaże (sold) + zwroty.
 * Każde wydanie ma numer WZ-{id}, datę, wartość, ilość, rodzaj (sprzedaż / wycofanie).
 */
type RowKind = "sprzedaz" | "wycofanie";
type Row = {
  kind: RowKind;
  id: string;
  date: string;
  value_cents: number;
  product: Pick<Product, "id" | "brand" | "model" | "size"> | null;
};

export default async function WydaniaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  // Source 1: sprzedaże (products.status = sold)
  const { data: solds } = await supabase
    .from("products")
    .select("id, brand, model, size, listing_price_cents, expected_price_cents, sold_at, updated_at")
    .eq("status", "sold");

  // Source 2: wycofania (returns table)
  const { data: returnsRaw } = await supabase
    .from("returns")
    .select("id, product_id, created_at, fee_cents");
  const returns = (returnsRaw ?? []) as Pick<AppReturn, "id" | "product_id" | "created_at" | "fee_cents">[];

  const returnedIds = returns.map((r) => r.product_id);
  const { data: returnedProds } = returnedIds.length
    ? await supabase
        .from("products")
        .select("id, brand, model, size, listing_price_cents, expected_price_cents")
        .in("id", returnedIds)
    : { data: [] as Array<Pick<Product, "id" | "brand" | "model" | "size" | "listing_price_cents" | "expected_price_cents">> };
  const productById = new Map((returnedProds ?? []).map((p) => [p.id, p]));

  const rows: Row[] = [];
  for (const s of solds ?? []) {
    rows.push({
      kind: "sprzedaz",
      id: s.id,
      date: s.sold_at ?? s.updated_at,
      value_cents: s.listing_price_cents ?? s.expected_price_cents ?? 0,
      product: { id: s.id, brand: s.brand, model: s.model, size: s.size },
    });
  }
  for (const r of returns) {
    const p = productById.get(r.product_id);
    rows.push({
      kind: "wycofanie",
      id: r.id,
      date: r.created_at,
      value_cents: p ? (p.listing_price_cents ?? p.expected_price_cents ?? 0) : 0,
      product: p ? { id: p.id, brand: p.brand, model: p.model, size: p.size } : null,
    });
  }
  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalValue = rows.reduce((a, r) => a + r.value_cents, 0);

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="wydania"
      breadcrumb={[{ label: "Wydania magazynowe" }]}
    >
      <PageHeader
        label="Dokumenty WZ"
        title="Wydania magazynowe"
        sub="Każdy ruch towaru z magazynu — sprzedaż albo wycofanie — to oddzielny dokument WZ."
      />

      {rows.length === 0 ? (
        <section className="mt-8">
          <EmptyState
            title="Brak wydań magazynowych"
            sub="Nie było jeszcze żadnego ruchu towaru z magazynu. Pierwsza sprzedaż albo wycofanie wygeneruje tu dokument WZ."
            action={
              <ButtonLink href="/panel/magazyn" size="md">
                Sprawdź magazyn <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </section>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label="Wydań łącznie" value={rows.length} />
            <KpiCard label="Sprzedaże" value={rows.filter((r) => r.kind === "sprzedaz").length} />
            <KpiCard label="Wartość ruchu" value={formatPLN(totalValue, { decimals: false })} mono />
          </section>

          <section className="mt-6">
            <div className="card table-scroll">
              <div className="hidden md:grid grid-cols-[130px_minmax(200px,3fr)_90px_130px_110px_150px_100px] gap-3 px-4 h-11 label border-b border-border items-center">
                <div>Numer WZ</div>
                <div>Produkt</div>
                <div>Kurier</div>
                <div>Tracking</div>
                <div>Wartość</div>
                <div>Status</div>
                <div>Data</div>
              </div>
              {rows.map((r) => (
                <div
                  key={`${r.kind}-${r.id}`}
                  className="grid grid-cols-1 md:grid-cols-[130px_minmax(200px,3fr)_90px_130px_110px_150px_100px] gap-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <div className="text-[13px] num font-medium">
                    WZ-{r.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    {r.product ? (
                      <Link href={`/panel/products/${r.product.id}`} className="block min-w-0 hover:text-lime transition-colors">
                        <span className="block text-[13.5px] font-medium truncate">
                          {r.product.brand} {r.product.model}
                        </span>
                        {r.product.size && (
                          <span className="block text-[11px] num text-text-mute truncate">
                            Rozm. {r.product.size}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-text-mute">Produkt usunięty</span>
                    )}
                  </div>
                  <div className="hidden md:block text-[12px] text-text-faint">—</div>
                  <div className="hidden md:block text-[12px] num text-text-faint">—</div>
                  <div className="hidden md:block text-[13px] num">{formatPLN(r.value_cents, { decimals: false })}</div>
                  <div>
                    {r.kind === "sprzedaz" ? (
                      <Pill variant="blue">Wysłane</Pill>
                    ) : (
                      <Pill variant="coral">Zwrot</Pill>
                    )}
                  </div>
                  <div className="text-[12px] num text-text-soft">{formatDate(r.date)}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </PanelShell>
  );
}
