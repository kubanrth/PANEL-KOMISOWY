import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getWalletSummary } from "@/lib/supabase/session";
import { Pill, PROD_VARIANT, type PillVariant } from "@/components/panel/StatusPill";
import { KpiCard, Sparkline } from "@/components/ui/KpiCard";
import { KickbackMark } from "@/components/ui/KickbackMark";
import { formatPLN, formatDate } from "@/lib/format";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import type { Product, Submission, KickbackPick, DemandListing } from "@/lib/types";

/* Dashboard klienta — design B1 wariant 1a (ops-first):
   KPI row → „Twoje ostatnie ruchy" (timeline) + prawa kolumna
   „Co warto dodać" / „Zapotrzebowanie". */

export default async function PanelPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) redirect("/onboarding");

  // --- dane (wszystkie odczyty defensywne — brak tabeli/RPC ≠ 500) ---
  const [{ data: submissionsRaw }, summary, { data: picksRaw }, { data: demandsRaw }] =
    await Promise.all([
      supabase
        .from("submissions")
        .select("id, status, created_at")
        .order("created_at", { ascending: false }),
      getWalletSummary(),
      supabase
        .from("kickback_picks")
        .select("id, title, description, priority, expires_at, active, cta_href")
        .eq("active", true)
        .order("priority", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(4),
      supabase
        .from("demand_listings")
        .select("*")
        .eq("active", true)
        .order("published_at", { ascending: false })
        .limit(3),
    ]);

  const submissions = (submissionsRaw ?? []) as Pick<Submission, "id" | "status" | "created_at">[];
  const submissionIds = submissions.map((s) => s.id);

  // Równolegle: produkty (zależą od submissionIds) i etykiety zapotrzebowania
  // (zależą tylko od demands) — bez zbędnego round-tripa.
  const demandsEarly = (demandsRaw ?? []) as DemandListing[];
  const [{ data: productsRaw }, demandLabels] = await Promise.all([
    submissionIds.length
      ? supabase
          .from("products")
          .select("id, submission_id, brand, model, size, status, listing_price_cents, expected_price_cents, sold_at, published_at, updated_at, created_at")
          .in("submission_id", submissionIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    resolveDemandLabels(supabase, demandsEarly),
  ]);
  const products = (productsRaw ?? []) as Pick<
    Product,
    "id" | "submission_id" | "brand" | "model" | "size" | "status" | "listing_price_cents" | "expected_price_cents" | "sold_at" | "published_at" | "updated_at" | "created_at"
  >[];

  const walletAvailable = summary.available;
  const walletBalance = summary.balance;

  const picks = ((picksRaw ?? []) as Pick<KickbackPick, "id" | "title" | "description" | "priority" | "expires_at" | "active" | "cta_href">[])
    .filter((p) => !p.expires_at || new Date(p.expires_at) > new Date())
    .slice(0, 3);
  const demands = demandsEarly;

  // --- KPI ---
  const listed = products.filter((p) => p.status === "listed");
  const now = new Date();
  const soldThisMonth = products.filter(
    (p) =>
      p.status === "sold" &&
      p.sold_at &&
      new Date(p.sold_at).getMonth() === now.getMonth() &&
      new Date(p.sold_at).getFullYear() === now.getFullYear(),
  );
  const soldMonthSum = soldThisMonth.reduce(
    (acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0),
    0,
  );

  // Sparkline: produkty utworzone w 7 ostatnich tygodniach (realne dane, nie dekoracja).
  const weekBuckets = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(now.getTime() - (6 - i + 1) * 7 * 86400000);
    const end = new Date(now.getTime() - (6 - i) * 7 * 86400000);
    return products.filter((p) => {
      const t = new Date(p.created_at);
      return t >= start && t < end;
    }).length;
  });

  // --- Timeline „Twoje ostatnie ruchy" — z produktów, sortowane po updated_at ---
  const moves = products.slice(0, 8);

  const totalSubmissions = submissions.length;

  return (
    <>
      {/* KPI row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Aktywnie w sprzedaży" value={listed.length} delta={weekBuckets[6] > 0 ? `+${weekBuckets[6]}` : undefined}>
          {weekBuckets.some((b) => b > 0) && <Sparkline points={weekBuckets} />}
        </KpiCard>
        <KpiCard
          label="Sprzedane w mies."
          value={soldThisMonth.length}
          sub={soldMonthSum > 0 ? formatPLN(soldMonthSum, { decimals: false }) : undefined}
        />
        <Link href="/panel/wallet" className="block h-full">
          <KpiCard
            label="Do wypłaty"
            value={formatPLN(walletAvailable, { decimals: false })}
            mono
            delta={walletAvailable > 0 ? "Gotowe" : undefined}
          />
        </Link>
        <Link href="/panel/zapotrzebowanie" className="block h-full">
          <KpiCard label="Nowe zapotrzebowanie" value={demands.length} />
        </Link>
      </section>

      {totalSubmissions === 0 ? (
        <section className="mt-8">
          <div className="card-gradient-dark p-10 lg:p-14 relative overflow-hidden">
            <div className="glow-blob" aria-hidden />
            <div className="max-w-[520px] relative">
              <div className="label !text-mint/80">Pierwsza sprzedaż</div>
              <h2 className="mt-3 font-light text-[26px] lg:text-[36px] leading-[1.05] tracking-[-0.02em]">
                Powierz pierwszą koszulkę.
              </h2>
              <p className="mt-4 text-text-soft text-[15px] leading-[1.6]">
                Wypełnij formularz Oferty, podpisz Umowę Komisową, dostaniesz etykietę nadania.
                My weryfikujemy, sprzedajemy, wypłacamy.
              </p>
              <div className="mt-8">
                <ButtonLink href="/start" size="lg">
                  Wypełnij formularz <ArrowRight size={16} />
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-8 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Twoje ostatnie ruchy */}
          <div>
            {/* h-7 + mb-4 identycznie w obu kolumnach — pierwsze karty równają się do linii */}
            <div className="flex items-baseline justify-between h-7 mb-4">
              <h2 className="font-light text-[22px] tracking-[-0.02em]">Twoje ostatnie ruchy</h2>
              <Link href="/panel/magazyn" className="text-[13px] text-text-soft hover:text-lime transition-colors">
                Zobacz wszystkie →
              </Link>
            </div>
            <div className="space-y-2">
              {moves.length === 0 && (
                <div className="card p-6 text-[14px] text-text-soft">
                  Jeszcze nic się nie dzieje — Twoje produkty są w przygotowaniu.
                </div>
              )}
              {moves.map((p, i) => (
                <MoveRow key={p.id} product={p} highlight={i === 0 && p.status === "listed"} />
              ))}
            </div>
          </div>

          {/* Prawa kolumna */}
          <div className="space-y-6">
            <div>
              <div className="flex items-baseline justify-between h-7 mb-4">
                <h2 className="font-light text-[18px] tracking-[-0.02em]">Co warto dodać</h2>
                <Link href="/panel/plany" className="text-[12px] text-text-soft hover:text-lime transition-colors">
                  Wszystkie →
                </Link>
              </div>
              <div className="space-y-2">
                {picks.length === 0 && (
                  <div className="card p-4 text-[13px] text-text-soft">Brak nowych rekomendacji.</div>
                )}
                {picks.map((p) => (
                  <Link key={p.id} href={p.cta_href ?? "/panel/plany"} className="card p-4 flex items-start gap-3 hover:bg-surface-2/40 transition-colors">
                    <KickbackMark size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">{p.title}</div>
                      {p.description && (
                        <div className="text-[11px] text-text-mute truncate mt-0.5">{p.description}</div>
                      )}
                    </div>
                    <Pill variant={p.priority >= 3 ? "lime" : p.priority === 2 ? "blue" : "mute"}>
                      {p.priority >= 3 ? "Wysoki" : p.priority === 2 ? "Średni" : "Niski"}
                    </Pill>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-light text-[18px] tracking-[-0.02em]">Zapotrzebowanie</h2>
                <Link href="/panel/zapotrzebowanie" className="text-[12px] text-text-soft hover:text-lime transition-colors">
                  Wszystkie →
                </Link>
              </div>
              <div className="space-y-2">
                {demands.length === 0 && (
                  <div className="card p-4 text-[13px] text-text-soft">Brak aktywnych ogłoszeń.</div>
                )}
                {demands.map((d) => (
                  <Link key={d.id} href="/panel/zapotrzebowanie" className="card p-4 block hover:bg-surface-2/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <KickbackMark size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium truncate">{demandLabels.get(d.id) ?? "—"}</div>
                        <div className="text-[11px] text-text-mute mt-0.5">
                          {d.kind === "club" ? "Klub" : d.kind === "national_team" ? "Reprezentacja" : "Nazwisko"}
                          {d.retro && " · retro"}
                        </div>
                      </div>
                      {d.target_price_cents && (
                        <div className="text-[13px] num text-mint whitespace-nowrap">
                          do {formatPLN(d.target_price_cents, { decimals: false })}
                        </div>
                      )}
                    </div>
                    {d.sizes && d.sizes.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1 pl-12">
                        {d.sizes.slice(0, 5).map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded-[6px] bg-blue/12 text-blue-soft text-[10px] font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Demo banner */}
      <div className="mt-10 inline-flex items-center gap-3 px-5 py-4 rounded-[14px] bg-yellow/8 border border-yellow/25 text-yellow">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
        <span className="text-[13px]">Tryb demo — bez integracji Autopay/PZ/banku DPD. Oferty zapisywane w DB, pieniądze testowe.</span>
      </div>
    </>
  );
}

/* Wiersz timeline — avatar-badge z literą, tytuł + timestamp, pill statusu.
   Najświeższa pozycja w sprzedaży = wyróżnienie gradientem (wzór B1 1a). */
function MoveRow({
  product: p,
  highlight,
}: {
  product: Pick<Product, "id" | "brand" | "model" | "size" | "status" | "listing_price_cents" | "expected_price_cents" | "updated_at">;
  highlight: boolean;
}) {
  const title = `${p.brand} ${p.model}`.trim();
  const event =
    p.status === "listed" ? "wystawiona w sklepie"
    : p.status === "sold" ? `sprzedana${p.listing_price_cents ? ` za ${formatPLN(p.listing_price_cents, { decimals: false })}` : ""}`
    : p.status === "aqc" ? "w trakcie A&QC"
    : p.status === "offer" ? "kontr-oferta czeka na Twoją decyzję"
    : p.status === "returned" ? "zwrot w obsłudze"
    : p.status === "withdrawn" ? "wycofana z komisu"
    : "w przygotowaniu";

  const SHORT: Partial<Record<typeof p.status, string>> = {
    listed: "W sprzedaży", sold: "Sprzedane", aqc: "A&QC",
    offer: "Do decyzji", returned: "Zwrot",
  };
  const pill: { v: PillVariant; l: string } = {
    v: PROD_VARIANT[p.status],
    l: SHORT[p.status] ?? "Draft",
  };

  if (highlight) {
    return (
      <Link
        href={`/panel/products/${p.id}`}
        className="block rounded-[16px] p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5 [background:var(--gradient-cta)]"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-[10px] bg-black/20 flex items-center justify-center text-[15px] font-medium text-on-accent flex-shrink-0">
            {title[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-on-accent truncate">
              {title} — {event}
            </div>
            <div className="text-[11px] num text-on-accent/70 mt-0.5">{formatDate(p.updated_at)}</div>
          </div>
          <span className="pill !bg-black/20 !text-on-accent !border-transparent">{pill.l}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/panel/products/${p.id}`}
      className="card p-4 flex items-center gap-3 hover:bg-surface-2/40 transition-colors"
    >
      <div className="h-10 w-10 rounded-[10px] bg-surface-2 border border-border-soft flex items-center justify-center text-[15px] font-medium text-text-soft flex-shrink-0">
        {title[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] truncate">
          <span className="font-medium">{title}</span>
          <span className="text-text-soft"> — {event}</span>
        </div>
        <div className="text-[11px] num text-text-mute mt-0.5">{formatDate(p.updated_at)}</div>
      </div>
      <Pill variant={pill.v}>{pill.l}</Pill>
    </Link>
  );
}

/** Nazwy dla 3 ogłoszeń zapotrzebowania — dociąga tylko potrzebne rekordy. */
async function resolveDemandLabels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  demands: DemandListing[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const clubIds = demands.filter((d) => d.club_id).map((d) => d.club_id!);
  const teamIds = demands.filter((d) => d.national_team_id).map((d) => d.national_team_id!);
  const playerIds = demands.filter((d) => d.player_id).map((d) => d.player_id!);

  const [clubs, teams, players] = await Promise.all([
    clubIds.length ? supabase.from("clubs").select("id, name").in("id", clubIds) : { data: [] },
    teamIds.length ? supabase.from("national_teams").select("id, name").in("id", teamIds) : { data: [] },
    playerIds.length ? supabase.from("players").select("id, full_name").in("id", playerIds) : { data: [] },
  ]);

  const clubBy = new Map((clubs.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
  const teamBy = new Map((teams.data ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  const playerBy = new Map((players.data ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

  for (const d of demands) {
    const label =
      (d.club_id && clubBy.get(d.club_id)) ||
      (d.national_team_id && teamBy.get(d.national_team_id)) ||
      (d.player_id && playerBy.get(d.player_id)) ||
      d.raw_label ||
      "—";
    out.set(d.id, label);
  }
  return out;
}
