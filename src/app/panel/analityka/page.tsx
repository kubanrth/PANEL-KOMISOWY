import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatPLN } from "@/lib/format";
import type { Product, InventorySnapshot } from "@/lib/types";
import { RevenueSimulator } from "./RevenueSimulator";
import { InventoryChart } from "./InventoryChart";

type Range = "7" | "30" | "90" | "365";

export default async function AnalitykaPage(props: { searchParams: Promise<{ range?: Range }> }) {
  const sp = await props.searchParams;
  const range: Range = (sp.range as Range) ?? "30";
  const days = parseInt(range, 10);
  const cutoff = Date.now() - days * 86_400_000;

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  // All products (RLS filters to own)
  const { data: productsRaw } = await supabase.from("products").select("*");
  const all = (productsRaw ?? []) as Product[];

  // Window the sold ones to the chosen range for "sprzedaż w okresie"
  const soldInRange = all.filter((p) => p.status === "sold" && p.sold_at && new Date(p.sold_at).getTime() >= cutoff);
  const sold30 = all.filter((p) => p.status === "sold" && p.sold_at && new Date(p.sold_at).getTime() >= Date.now() - 30 * 86_400_000);
  const revenue = soldInRange.reduce((acc, p) => acc + (p.listing_price_cents ?? 0), 0);
  const revenue30 = sold30.reduce((acc, p) => acc + (p.listing_price_cents ?? 0), 0);

  // Rotation: avg days from published_at → sold_at per brand
  type Rot = { brand: string; n: number; avgDays: number };
  const byBrand = new Map<string, { n: number; sumDays: number }>();
  for (const p of all) {
    if (p.status !== "sold" || !p.sold_at || !p.published_at) continue;
    const d = (new Date(p.sold_at).getTime() - new Date(p.published_at).getTime()) / 86_400_000;
    const cur = byBrand.get(p.brand) ?? { n: 0, sumDays: 0 };
    cur.n += 1;
    cur.sumDays += d;
    byBrand.set(p.brand, cur);
  }
  const rotations: Rot[] = Array.from(byBrand.entries())
    .map(([brand, v]) => ({ brand, n: v.n, avgDays: v.sumDays / v.n }))
    .sort((a, b) => a.avgDays - b.avgDays);
  const overallRotation = rotations.length
    ? rotations.reduce((a, r) => a + r.avgDays * r.n, 0) / rotations.reduce((a, r) => a + r.n, 0)
    : null;

  // Rotacja komisu: agregaty po atrybutach (RPC SECURITY DEFINER — same liczby,
  // bez danych jednostkowych innych komisantów). Brak migracji 018 → sekcja z notką.
  type RotStat = { dim: "brand" | "size" | "player"; label: string; sold_total: number; sold_mine: number };
  const rotRes = await supabase.rpc("komis_rotation_stats");
  const rotStats = (rotRes.data ?? []) as RotStat[];
  const rotAvailable = !rotRes.error;
  const komisSoldTotal = rotStats.filter((r) => r.dim === "brand").reduce((a, r) => a + r.sold_total, 0);
  const topOf = (dim: RotStat["dim"]) =>
    rotStats.filter((r) => r.dim === dim).sort((a, b) => b.sold_total - a.sold_total).slice(0, 5);

  // Inventory snapshots for chart
  const { data: snapsRaw } = await supabase
    .from("inventory_snapshots")
    .select("*")
    .eq("klient_id", user.id)
    .gte("day", new Date(cutoff).toISOString().slice(0, 10))
    .order("day", { ascending: true });
  const snapshots = (snapsRaw ?? []) as InventorySnapshot[];

  // If we have NO snapshots at all but we DO have products, capture one
  // now so the chart isn't empty on first visit. Ignore errors — non-critical.
  if (snapshots.length === 0 && all.some((p) => ["aqc", "listed", "offer"].includes(p.status))) {
    try {
      await supabase.rpc("capture_inventory_snapshot");
    } catch {
      /* swallow — snapshot is best-effort */
    }
  }

  // Stock right now
  const inStock = all.filter((p) => ["aqc", "listed", "offer"].includes(p.status));
  const currentStockValue = inStock.reduce((acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0), 0);



  // For the simulator we pass last-30d revenue and current stock value
  return (
    <>
      <PageHeader
        label="Twoje dane sprzedażowe"
        title="Analityka"
        sub="Sprzedaż, rotacja, symulator przychodu i sugestie Kickback. Wszystko obliczane na podstawie Twoich rzeczywistych danych — żadnej magii, deterministycznie."
      />

      <section className="mt-8 flex flex-wrap items-center gap-2">
        <span className="label mr-2">Zakres:</span>
        {(["7", "30", "90", "365"] as Range[]).map((r) => {
          const active = range === r;
          return (
            <Link
              key={r}
              href={`/panel/analityka?range=${r}`}
              className={`inline-flex items-center h-9 px-3.5 rounded-full text-[13px] font-medium border transition-colors active:scale-[.98] ${
                active ? "border-lime/40 bg-lime/10 text-lime" : "border-border bg-surface text-text-soft hover:text-text hover:bg-surface-2"
              }`}
            >
              {r === "365" ? "12 mies." : `${r} dni`}
            </Link>
          );
        })}
      </section>

      {/* Widget 1: Sprzedaż w okresie */}
      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card-elev p-6 lg:col-span-2">
          <div className="label">Sprzedaż w okresie · {range === "365" ? "12 mies." : `${range} dni`}</div>
          <div className="mt-2 font-light text-4xl lg:text-5xl tracking-[-0.02em] num">
            {formatPLN(revenue, { decimals: false })}
          </div>
          <div className="mt-2 text-[13px] text-text-soft">
            {soldInRange.length} transakcji ·{" "}
            <span className="text-mint">
              śr. {soldInRange.length ? formatPLN(Math.round(revenue / soldInRange.length), { decimals: false }) : "—"} / szt.
            </span>
          </div>
        </div>

        <div className="card-elev p-6">
          <div className="label">Wskaźnik rotacji</div>
          <div className="mt-2 font-light text-4xl tracking-[-0.02em] num">
            {overallRotation != null ? Math.round(overallRotation) : "—"}
            <span className="text-text-mute text-lg ml-1.5 font-normal">dni</span>
          </div>
          <div className="mt-2 text-[12px] text-text-mute">
            śr. czas od publikacji do sprzedaży (wszystkie marki)
          </div>
          {rotations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border-soft space-y-1.5">
              {rotations.slice(0, 3).map((r) => (
                <div key={r.brand} className="flex justify-between text-[12px]">
                  <span className="text-text-soft truncate">{r.brand}</span>
                  <span className="num text-mint">{Math.round(r.avgDays)} d</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Rotacja komisu — najlepiej sprzedające się atrybuty vs Twoje pozycje */}
      <section className="mt-6 card-elev p-6">
        <div className="label">Rotacja komisu · najlepiej sprzedające się atrybuty</div>
        <p className="mt-1 text-[12px] text-text-mute">
          Sprzedaż całego komisu ({komisSoldTotal} szt.) w rozbiciu na kluby, rozmiary i nazwiska — kolumna „Twoje" pokazuje Twój udział.
        </p>
        {!rotAvailable ? (
          <div className="mt-5 rounded-[12px] border border-dashed border-border p-6 text-center text-[13px] text-text-soft">
            Statystyki rotacji będą dostępne po aktualizacji bazy (migracja 018).
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            {([["brand", "Kluby i marki"], ["size", "Rozmiary"], ["player", "Nazwiska"]] as const).map(([dim, title]) => {
              const rows = topOf(dim);
              return (
                <div key={dim}>
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-text-mute mb-3">{title}</div>
                  {rows.length === 0 ? (
                    <div className="text-[12px] text-text-faint">Brak danych sprzedażowych.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {rows.map((r) => {
                        const pct = komisSoldTotal ? Math.round((r.sold_total / komisSoldTotal) * 100) : 0;
                        return (
                          <div key={r.label}>
                            <div className="flex items-baseline justify-between gap-3 text-[13px]">
                              <span className="truncate">{r.label}</span>
                              <span className="num text-text-soft flex-shrink-0">
                                {r.sold_total} szt · {pct}%
                                {r.sold_mine > 0 && <span className="text-lime"> · Twoje: {r.sold_mine}</span>}
                              </span>
                            </div>
                            <div className="mt-1 h-1 rounded-full bg-surface-2 overflow-hidden">
                              <div className="h-full rounded-full bg-lime/60" style={{ width: `${Math.max(pct, 3)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Widget 3: Symulator przychodu */}
      <section className="mt-6">
        <RevenueSimulator
          currentRevenue30d={revenue30}
          currentStockCount={inStock.length}
          currentStockValueCents={currentStockValue}
        />
      </section>

      {/* Widget 6: Wartość magazynu w czasie */}
      <section className="mt-6 card-elev p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div>
            <div className="label">Wartość magazynu w czasie</div>
            <div className="mt-1 font-semibold text-xl tracking-[-0.025em]">
              Obecnie: <span className="num">{formatPLN(currentStockValue, { decimals: false })}</span>
            </div>
          </div>
          <ButtonLink href="/panel/magazyn" variant="ghost" size="sm">
            Przejdź do magazynu <ArrowRight size={14} />
          </ButtonLink>
        </div>
        <InventoryChart snapshots={snapshots} />
        {snapshots.length === 0 && (
          <p className="mt-4 text-[12px] text-text-mute">
            Snapshoty są zbierane raz dziennie. Wykres uzupełni się po kilku dniach lub po
            ręcznym uruchomieniu RPC <span className="num">capture_inventory_snapshot()</span> w Supabase.
          </p>
        )}
      </section>
    </>
  );
}

