import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatPLN } from "@/lib/format";
import type { Product, DemandListing, Club, Player, NationalTeam, InventorySnapshot } from "@/lib/types";
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

  // Recommendations — top 3 clubs/players/national_teams from demand_listings
  // that match what's *missing* from this klient's stock.
  const { data: demandRaw } = await supabase
    .from("demand_listings")
    .select("*")
    .eq("active", true)
    .order("published_at", { ascending: false })
    .limit(20);
  const demand = (demandRaw ?? []) as DemandListing[];

  const labelLookups = await Promise.all([
    supabase.from("clubs").select("id, name, crest_url"),
    supabase.from("national_teams").select("id, name, flag_url"),
    supabase.from("players").select("id, full_name"),
  ]);
  const clubById = new Map((labelLookups[0].data ?? []).map((c) => [c.id, c as Pick<Club, "id" | "name" | "crest_url">]));
  const teamById = new Map((labelLookups[1].data ?? []).map((t) => [t.id, t as Pick<NationalTeam, "id" | "name" | "flag_url">]));
  const playerById = new Map((labelLookups[2].data ?? []).map((p) => [p.id, p as Pick<Player, "id" | "full_name">]));

  // Klient's own brand strings (lowercased) — heuristic for "I already have this club".
  const ownBrands = new Set(all.map((p) => p.brand.toLowerCase().trim()));
  const demandWithLabels = demand.map((d) => {
    const label =
      d.kind === "club" && d.club_id
        ? clubById.get(d.club_id)?.name
        : d.kind === "national_team" && d.national_team_id
          ? teamById.get(d.national_team_id)?.name
          : d.kind === "player" && d.player_id
            ? playerById.get(d.player_id)?.full_name
            : d.raw_label;
    const alreadyHave = label ? ownBrands.has(label.toLowerCase().trim()) : false;
    return { d, label: label ?? "—", alreadyHave };
  });
  const recsClubs = demandWithLabels.filter((x) => x.d.kind === "club" && !x.alreadyHave).slice(0, 3);
  const recsTeams = demandWithLabels.filter((x) => x.d.kind === "national_team" && !x.alreadyHave).slice(0, 3);
  const recsPlayers = demandWithLabels.filter((x) => x.d.kind === "player" && !x.alreadyHave).slice(0, 3);

  // Price recommendations: P50 per brand+model from sold history vs current listings
  const soldPrices = new Map<string, number[]>();
  for (const p of all) {
    if (p.status !== "sold" || !p.listing_price_cents) continue;
    const k = `${p.brand}|${p.model}`;
    const arr = soldPrices.get(k) ?? [];
    arr.push(p.listing_price_cents);
    soldPrices.set(k, arr);
  }
  const priceRecs = inStock
    .map((p) => {
      const arr = soldPrices.get(`${p.brand}|${p.model}`) ?? [];
      if (arr.length < 1) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length / 2)];
      const current = p.listing_price_cents ?? p.expected_price_cents ?? 0;
      const deviation = (current - p50) / p50;
      return { product: p, p50, current, deviation };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b!.deviation) - Math.abs(a!.deviation))
    .slice(0, 6) as Array<{ product: Product; p50: number; current: number; deviation: number }>;

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

      {/* Widget 3: Symulator przychodu */}
      <section className="mt-6">
        <RevenueSimulator
          currentRevenue30d={revenue30}
          currentStockCount={inStock.length}
          currentStockValueCents={currentStockValue}
        />
      </section>

      {/* Widget 4: Sugestie Kickback */}
      <section className="mt-6 card-elev p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="label">Sugestie Kickback</div>
            <div className="mt-1 font-semibold text-xl tracking-[-0.025em]">Co warto dodać do komisu</div>
          </div>
          <ButtonLink href="/panel/zapotrzebowanie" variant="ghost" size="sm">
            Pełna lista zapotrzebowania
          </ButtonLink>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <RecCol title="Kluby" items={recsClubs} />
          <RecCol title="Reprezentacje" items={recsTeams} />
          <RecCol title="Nazwiska" items={recsPlayers} />
        </div>
      </section>

      {/* Widget 5: Rekomendacje cenowe */}
      <section className="mt-6 card-elev p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div>
            <div className="label">Rekomendacje cenowe</div>
            <div className="mt-1 font-semibold text-xl tracking-[-0.025em]">Twoja cena vs P50 rynkowe</div>
          </div>
          <ButtonLink href="/panel/magazyn" variant="ghost" size="sm">
            Przejdź do magazynu
          </ButtonLink>
        </div>
        {priceRecs.length === 0 ? (
          <p className="text-[13px] text-text-soft">
            Za mało historii sprzedaży tych modeli — rekomendacje pojawią się po kilku transakcjach.
          </p>
        ) : (
          <div className="space-y-2.5">
            {priceRecs.map(({ product, p50, current, deviation }) => {
              const pctOff = Math.round(deviation * 100);
              const color = Math.abs(deviation) < 0.1 ? "text-mint" : Math.abs(deviation) < 0.3 ? "text-amber" : "text-coral";
              return (
                <div key={product.id} className="flex items-center justify-between gap-4 py-2 border-b border-border-soft last:border-0">
                  <div className="min-w-0">
                    <div className="text-[14px] truncate">{product.brand} · {product.model}</div>
                    <div className="text-[11px] text-text-mute num">
                      Twoja: {formatPLN(current, { decimals: false })} · P50: {formatPLN(p50, { decimals: false })}
                    </div>
                  </div>
                  <span className={`font-bold text-sm num ${color}`}>
                    {pctOff > 0 ? "+" : ""}{pctOff}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
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

function RecCol({
  title, items,
}: {
  title: string;
  items: Array<{ d: DemandListing; label: string; alreadyHave: boolean }>;
}) {
  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-wider text-text-mute mb-3">{title}</div>
      {items.length === 0 ? (
        <p className="text-[12px] text-text-soft">Brak aktualnych sugestii.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(({ d, label }) => (
            <li key={d.id} className="text-[13px]">
              <div className="font-medium">{label}</div>
              {d.season && <div className="text-[11px] text-text-mute num">sezon {d.season}{d.retro ? " · retro" : ""}</div>}
              {d.target_price_cents && (
                <div className="text-[11px] text-mint num">
                  Możliwa cena: {(d.target_price_cents / 100).toFixed(0)} zł
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
