import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
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
      <section>
        <div className="label">Dokumenty WZ</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Wydania magazynowe.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Każdy ruch towaru z magazynu — sprzedaż albo wycofanie — to oddzielny dokument WZ.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="mt-10 card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center text-text-soft text-[14px]">
          Brak ruchów towaru do tej pory.
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi label="Wydań łącznie" value={rows.length.toString()} />
            <Kpi label="Sprzedaże" value={rows.filter((r) => r.kind === "sprzedaz").length.toString()} />
            <Kpi label="Wartość ruchu" value={formatPLN(totalValue, { decimals: false })} />
          </section>

          <section className="mt-8">
            <div className="card overflow-hidden">
              <div className="hidden md:grid grid-cols-[160px_minmax(220px,3fr)_60px_120px_140px_120px] gap-3 px-4 py-3 label border-b border-border-soft">
                <div>Numer WZ</div>
                <div>Produkt</div>
                <div>Rozm.</div>
                <div>Wartość</div>
                <div>Rodzaj</div>
                <div>Data</div>
              </div>
              {rows.map((r) => (
                <div
                  key={`${r.kind}-${r.id}`}
                  className="grid grid-cols-[160px_minmax(220px,3fr)_60px_120px_140px_120px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
                >
                  <div className="text-[13px] num font-medium">
                    WZ-{r.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    {r.product ? (
                      <Link href={`/panel/products/${r.product.id}`} className="text-[13px] truncate block hover:text-blue">
                        {r.product.brand} · {r.product.model}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-text-mute">Produkt usunięty</span>
                    )}
                  </div>
                  <div className="text-[12px] num text-text-soft">{r.product?.size ?? "—"}</div>
                  <div className="text-[13px] font-semibold num">{formatPLN(r.value_cents, { decimals: false })}</div>
                  <div>
                    <span className={`pill ${r.kind === "sprzedaz" ? "pill-mint" : "pill-amber"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.kind === "sprzedaz" ? "bg-mint" : "bg-amber"}`} />
                      {r.kind === "sprzedaz" ? "Sprzedaż" : "Wycofanie"}
                    </span>
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-2 font-bold text-2xl tracking-[-0.035em] num">{value}</div>
    </div>
  );
}
