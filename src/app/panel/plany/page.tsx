import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/panel/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type {
  Product, SalesPlan, DemandListing, Club, Player, NationalTeam, KickbackPick,
} from "@/lib/types";
import { PlanForm } from "./PlanForm";

/**
 * Plany sprzedaży — redesign:
 * 1. „Co warto dodać" — kuratorowane picks jako grid 3-kol kart
 *    (obrazek 4:3, pigułka priorytetu, ghost CTA, mikrotekst wygasania).
 * 2. Sugestie heurystyczne (demand_listings + braki klienta).
 * 3. Formularz: budżet marketingowy + planowane pozycje + oczekiwana wartość.
 * 4. Historia zgłoszonych planów.
 */
export default async function PlanyPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
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

  // 5. Kickback picks — manualnie kurowana lista (migracja 013).
  //    Pokazujemy aktywne + jeszcze nie wygasłe.
  const { data: picksRaw } = await supabase
    .from("kickback_picks")
    .select("*")
    .eq("active", true)
    .order("priority", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(12);
  const picks = ((picksRaw ?? []) as KickbackPick[]).filter(
    (p) => !p.expires_at || new Date(p.expires_at) > new Date(),
  );

  return (
    <>
      <PageHeader
        label="Roadmap Twojej sprzedaży"
        title="Plany sprzedaży"
        sub="Zgłoś budżet marketingowy i planowane pozycje. Spójrz na sugestie Kickback — co warto dodać do najbliższej Oferty, żeby zwiększyć rotację."
      />

      {/* Co warto dodać — kuratorowane picks (migracja 013) */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <div>
            <div className="label">Kuratorowane przez Kickback</div>
            <h2 className="mt-1 font-light text-[22px] tracking-[-0.02em]">Co warto dodać</h2>
          </div>
          {picks.length > 0 && (
            <span className="text-[11px] num text-text-mute">
              {picks.length} {picks.length === 1 ? "rekomendacja" : "rekomendacji"}
            </span>
          )}
        </div>

        {picks.length === 0 ? (
          <EmptyState
            title="Wszystko już masz."
            sub="Brak nowych rekomendacji — wrócimy tu, gdy pojawi się coś wartego dodania do Twojego komisu."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {picks.map((p) => (
              <article key={p.id} className="card overflow-hidden flex flex-col">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    width={400}
                    height={300}
                    className="w-full aspect-[4/3] object-cover border-b border-border-soft"
                  />
                )}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[14px] font-medium tracking-[-0.015em] min-w-0 flex-1">{p.title}</div>
                    <Pill variant={p.priority >= 3 ? "lime" : p.priority === 2 ? "blue" : "mute"}>
                      {p.priority >= 3 ? "Wysoki" : p.priority === 2 ? "Średni" : "Niski"}
                    </Pill>
                  </div>
                  {p.category && (
                    <div className="mt-1 text-[11px] text-text-mute">{p.category}</div>
                  )}
                  {p.description && (
                    <p className="mt-2 text-[12px] text-text-soft leading-[1.5] line-clamp-2 flex-1">
                      {p.description}
                    </p>
                  )}
                  {(p.cta_label && p.cta_href) || p.expires_at ? (
                    <div className="mt-4 pt-3 border-t border-border-soft flex items-center justify-between gap-3">
                      {p.cta_label && p.cta_href ? (
                        <ButtonLink href={p.cta_href} variant="ghost" size="sm">
                          {p.cta_label}
                        </ButtonLink>
                      ) : <span />}
                      {p.expires_at && (
                        <span className="text-[10px] num text-text-faint whitespace-nowrap">
                          Wygasa {formatDate(p.expires_at)}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Sugestie Kickback — heurystyki */}
      <section className="mt-8 card p-6">
        <div className="label">Sugestie automatyczne</div>
        <h2 className="mt-1.5 font-light text-[20px] tracking-[-0.02em]">
          Co dorzucić, żeby rotacja przyspieszyła
        </h2>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Suggestion 1 — polish clubs */}
          <div>
            <div className="mb-3">
              <Pill variant="mint">Polskie kluby</Pill>
            </div>
            {polishMissing.length === 0 ? (
              <p className="text-[12px] text-text-soft leading-[1.55]">
                Twój asortyment polski wygląda komplet. Zerknij na inne kluby z zapotrzebowania.
              </p>
            ) : (
              <ul className="space-y-2.5 text-[13px]">
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
            <div className="mb-3">
              <Pill variant="yellow">Wolniejsza rotacja</Pill>
            </div>
            {slowBrands.length === 0 ? (
              <p className="text-[12px] text-text-soft leading-[1.55]">
                Wszystkie Twoje marki rotują dobrze (poniżej 21 dni).
              </p>
            ) : (
              <ul className="space-y-2.5 text-[13px]">
                {slowBrands.map((s) => (
                  <li key={s.brand}>
                    <div className="font-medium">{s.brand}</div>
                    <div className="text-[11px] text-yellow num">
                      Średnio {Math.round(s.avgDays)} dni do sprzedaży
                    </div>
                    <div className="text-[11px] text-text-mute">
                      Rozważ redukcję ceny w{" "}
                      <Link href="/panel/magazyn" className="text-text-soft underline underline-offset-2 hover:text-lime transition-colors">
                        Magazynie
                      </Link>.
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Suggestion 3 — generic top pick from demand */}
          <div>
            <div className="mb-3">
              <Pill variant="blue">Aktywnie poszukujemy</Pill>
            </div>
            {demand.length === 0 ? (
              <p className="text-[12px] text-text-soft leading-[1.55]">Brak aktualnych ogłoszeń.</p>
            ) : (
              <ul className="space-y-2.5 text-[13px]">
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
                      {d.season && (
                        <div className="text-[11px] text-text-mute num">
                          sezon {d.season}{d.retro ? " · retro" : ""}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-border-soft text-[12px] text-text-mute leading-[1.55]">
          Sugestie generowane na podstawie Twoich danych sprzedażowych i bieżącego{" "}
          <Link href="/panel/zapotrzebowanie" className="text-text-soft underline underline-offset-2 hover:text-lime transition-colors">
            zapotrzebowania Kickback
          </Link>.
        </div>
      </section>

      {/* Form */}
      <section className="mt-6">
        <PlanForm />
      </section>

      {/* History */}
      {plans.length > 0 && (
        <section className="mt-10">
          <h2 className="font-light text-[22px] tracking-[-0.02em] mb-4">Historia planów</h2>
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[140px_140px_minmax(280px,3fr)_140px_140px] gap-3 px-4 h-11 label border-b border-border items-center">
              <div>Data</div>
              <div>Budżet</div>
              <div>Pozycje</div>
              <div>Oczek. wartość</div>
              <div>Status</div>
            </div>
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="grid grid-cols-[140px_140px_minmax(280px,3fr)_140px_140px] gap-3 px-4 py-3.5 items-start border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
              >
                <div className="text-[12px] num text-text-soft">{formatDate(plan.submitted_at)}</div>
                <div className="text-[13px] num">{formatPLN(plan.marketing_budget_cents, { decimals: false })}</div>
                <div className="text-[12px] text-text-soft line-clamp-2">{plan.planned_items_text ?? "—"}</div>
                <div className="text-[13px] num text-mint">
                  {plan.expected_value_cents ? formatPLN(plan.expected_value_cents, { decimals: false }) : "—"}
                </div>
                <div>
                  <Pill variant="mute">{plan.status}</Pill>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
