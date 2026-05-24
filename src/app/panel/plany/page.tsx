import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { formatPLN, formatDate } from "@/lib/format";
import type { Product, SalesPlan, DemandListing, Club, Player, NationalTeam } from "@/lib/types";
import { PlanForm } from "./PlanForm";

/**
 * Plany sprzedaży:
 * 1. "Sugestie Kickback" — heurystyki na podstawie aktualnych demand_listings
 *    i własnych braków klienta.
 * 2. Formularz: budżet marketingowy + planowane pozycje + oczekiwana wartość.
 * 3. Historia zgłoszonych planów.
 */
export default async function PlanyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  // 1. Klient stock — to compute "what's missing"
  const { data: prodsRaw } = await supabase
    .from("products")
    .select("brand, model, status, listing_price_cents, sold_at, published_at");
  const products = (prodsRaw ?? []) as Pick<Product, "brand" | "model" | "status" | "listing_price_cents" | "sold_at" | "published_at">[];

  // 2. Demand + domain
  const { data: demandRaw } = await supabase
    .from("demand_listings")
    .select("*")
    .eq("active", true)
    .order("published_at", { ascending: false })
    .limit(20);
  const demand = (demandRaw ?? []) as DemandListing[];

  const [clubs, teams, players] = await Promise.all([
    supabase.from("clubs").select("id, name, country, league"),
    supabase.from("national_teams").select("id, name"),
    supabase.from("players").select("id, full_name"),
  ]);
  const clubById = new Map((clubs.data ?? []).map((c) => [c.id, c as Pick<Club, "id" | "name" | "country" | "league">]));
  const teamById = new Map((teams.data ?? []).map((t) => [t.id, t as Pick<NationalTeam, "id" | "name">]));
  const playerById = new Map((players.data ?? []).map((p) => [p.id, p as Pick<Player, "id" | "full_name">]));

  // 3. Heuristics → "Sugestie Kickback"
  const ownBrands = new Set(products.map((p) => p.brand.toLowerCase().trim()));
  const polishLeagues = ["Ekstraklasa", "I Liga"];

  // Heuristic A: polskie kluby z demand których klient nie ma
  const polishMissing: Array<{ name: string; price?: number }> = [];
  for (const d of demand) {
    if (d.kind !== "club" || !d.club_id) continue;
    const c = clubById.get(d.club_id);
    if (!c || !polishLeagues.includes(c.league ?? "")) continue;
    if (!ownBrands.has(c.name.toLowerCase().trim())) {
      polishMissing.push({ name: c.name, price: d.target_price_cents ?? undefined });
    }
  }

  // Heuristic B: rotation > 21 dni vs Twoje cenowanie
  const rotByBrand = new Map<string, { sumDays: number; n: number; sold: number }>();
  for (const p of products) {
    if (p.status !== "sold" || !p.sold_at || !p.published_at) continue;
    const d = (new Date(p.sold_at).getTime() - new Date(p.published_at).getTime()) / 86_400_000;
    const cur = rotByBrand.get(p.brand) ?? { sumDays: 0, n: 0, sold: 0 };
    cur.sumDays += d;
    cur.n += 1;
    cur.sold += 1;
    rotByBrand.set(p.brand, cur);
  }
  const slowBrands = Array.from(rotByBrand.entries())
    .map(([brand, v]) => ({ brand, avgDays: v.sumDays / v.n, n: v.n }))
    .filter((x) => x.avgDays > 21 && x.n >= 2)
    .sort((a, b) => b.avgDays - a.avgDays)
    .slice(0, 3);

  // 4. Existing sales plans history
  const { data: plansRaw } = await supabase
    .from("sales_plans")
    .select("*")
    .eq("klient_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(10);
  const plans = (plansRaw ?? []) as SalesPlan[];

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="plany"
      breadcrumb={[{ label: "Plany sprzedaży" }]}
    >
      <section>
        <div className="label">Roadmap Twojej sprzedaży</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Plany sprzedaży.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Zgłoś budżet marketingowy i planowane pozycje. Spójrz na sugestie Kickback — co warto dodać
          do najbliższej Oferty żeby zwiększyć rotację.
        </p>
      </section>

      {/* Sugestie Kickback */}
      <section className="mt-8 card-elev p-6">
        <div className="label">Sugestie Kickback</div>
        <div className="mt-1 font-semibold text-xl tracking-[-0.025em]">
          Co dorzucić, żeby rotacja przyspieszyła
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Suggestion 1 — polish clubs */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-mint mb-3">
              Polskie kluby
            </div>
            {polishMissing.length === 0 ? (
              <p className="text-[12px] text-text-soft">
                Twój asortyment polski wygląda komplet. Zerknij na inne kluby z zapotrzebowania.
              </p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {polishMissing.slice(0, 3).map((m) => (
                  <li key={m.name}>
                    <div className="font-medium">{m.name}</div>
                    {m.price && (
                      <div className="text-[11px] text-mint num">
                        Możliwa cena: {formatPLN(m.price, { decimals: false })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Suggestion 2 — slow rotation */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber mb-3">
              Marki, które rotują wolniej
            </div>
            {slowBrands.length === 0 ? (
              <p className="text-[12px] text-text-soft">
                Wszystkie Twoje marki rotują dobrze (poniżej 21 dni).
              </p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {slowBrands.map((s) => (
                  <li key={s.brand}>
                    <div className="font-medium">{s.brand}</div>
                    <div className="text-[11px] text-amber num">
                      Średnio {Math.round(s.avgDays)} dni do sprzedaży
                    </div>
                    <div className="text-[10px] text-text-mute">
                      Rozważ redukcję ceny w{" "}
                      <Link href="/panel/magazyn" className="text-blue hover:underline">Magazynie</Link>.
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Suggestion 3 — generic top pick from demand */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue mb-3">
              Aktywnie poszukujemy
            </div>
            {demand.length === 0 ? (
              <p className="text-[12px] text-text-soft">Brak aktualnych ogłoszeń.</p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {demand.slice(0, 3).map((d) => {
                  const label =
                    d.kind === "club" && d.club_id
                      ? clubById.get(d.club_id)?.name
                      : d.kind === "national_team" && d.national_team_id
                        ? teamById.get(d.national_team_id)?.name
                        : d.kind === "player" && d.player_id
                          ? playerById.get(d.player_id)?.full_name
                          : d.raw_label;
                  return (
                    <li key={d.id}>
                      <div className="font-medium">{label}</div>
                      {d.season && <div className="text-[11px] text-text-mute num">sezon {d.season}{d.retro ? " · retro" : ""}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-border-soft text-[12px] text-text-mute">
          Sugestie generowane na podstawie Twoich danych sprzedażowych i bieżącego{" "}
          <Link href="/panel/zapotrzebowanie" className="text-blue hover:underline">zapotrzebowania Kickback</Link>.
        </div>
      </section>

      {/* Form */}
      <section className="mt-6">
        <PlanForm />
      </section>

      {/* History */}
      {plans.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">Historia planów</h2>
          <div className="card overflow-hidden">
            <div className="hidden md:grid grid-cols-[140px_140px_minmax(280px,3fr)_140px_140px] gap-3 px-4 py-3 label border-b border-border-soft">
              <div>Data</div>
              <div>Budżet</div>
              <div>Pozycje</div>
              <div>Oczek. wartość</div>
              <div>Status</div>
            </div>
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="grid grid-cols-[140px_140px_minmax(280px,3fr)_140px_140px] gap-3 px-4 py-3 items-start border-b border-border-soft last:border-0"
              >
                <div className="text-[12px] num text-text-soft">{formatDate(plan.submitted_at)}</div>
                <div className="text-[13px] num">{formatPLN(plan.marketing_budget_cents, { decimals: false })}</div>
                <div className="text-[12px] text-text-soft line-clamp-2">{plan.planned_items_text ?? "—"}</div>
                <div className="text-[13px] num text-mint">
                  {plan.expected_value_cents ? formatPLN(plan.expected_value_cents, { decimals: false }) : "—"}
                </div>
                <div>
                  <span className="pill pill-mute">{plan.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </PanelShell>
  );
}
