import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type { DemandListing, Club, NationalTeam, Player } from "@/lib/types";

/* Zapotrzebowanie — redesign: PageHeader, chip-filtry (wzór FilterChips
   ze Sprzedaży), grid 3-kol kart z avatar-badge 40px (herb/litera),
   pigułki rozmiarów, „do X zł" w mint, CTA-karta na dole. */

type Filter = { kind?: "club" | "national_team" | "player"; retro?: "1" };

export default async function ZapotrzebowaniePage(props: { searchParams: Promise<Filter> }) {
  const sp = await props.searchParams;

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  let q = supabase.from("demand_listings").select("*").eq("active", true);
  if (sp.kind) q = q.eq("kind", sp.kind);
  if (sp.retro === "1") q = q.eq("retro", true);
  const { data: demandsRaw } = await q.order("published_at", { ascending: false }).limit(100);
  const demands = (demandsRaw ?? []) as DemandListing[];

  // Resolve labels in parallel — keep it cheap
  const [clubs, teams, players] = await Promise.all([
    supabase.from("clubs").select("id, name, crest_url"),
    supabase.from("national_teams").select("id, name, flag_url"),
    supabase.from("players").select("id, full_name"),
  ]);
  const clubById = new Map((clubs.data ?? []).map((c) => [c.id, c as Pick<Club, "id" | "name" | "crest_url">]));
  const teamById = new Map((teams.data ?? []).map((t) => [t.id, t as Pick<NationalTeam, "id" | "name" | "flag_url">]));
  const playerById = new Map((players.data ?? []).map((p) => [p.id, p as Pick<Player, "id" | "full_name">]));

  const enriched = demands.map((d) => {
    let label: string;
    let crest: string | null = null;
    if (d.kind === "club" && d.club_id) {
      const c = clubById.get(d.club_id);
      label = c?.name ?? d.raw_label ?? "—";
      crest = c?.crest_url ?? null;
    } else if (d.kind === "national_team" && d.national_team_id) {
      const t = teamById.get(d.national_team_id);
      label = t?.name ?? d.raw_label ?? "—";
      crest = t?.flag_url ?? null;
    } else if (d.kind === "player" && d.player_id) {
      label = playerById.get(d.player_id)?.full_name ?? d.raw_label ?? "—";
    } else {
      label = d.raw_label ?? "—";
    }
    return { d, label, crest };
  });

  return (
    <>
      <PageHeader
        label={`${demands.length} aktywnych ogłoszeń · bieżące poszukiwania Kickback`}
        title="Zapotrzebowanie"
        sub="Aktywne ogłoszenia — koszulki, których aktualnie poszukujemy. Masz pasującą pozycję? Dodaj ją do najbliższej Oferty."
      />

      {/* Chip-filtry: rodzaj + retro */}
      <section className="mt-7 flex flex-wrap items-center gap-2">
        <FilterChips
          current={sp.kind ?? ""}
          options={[
            { v: "", l: "Wszystkie" },
            { v: "club", l: "Kluby" },
            { v: "national_team", l: "Reprezentacje" },
            { v: "player", l: "Nazwiska" },
          ]}
          param="kind"
          existing={sp}
        />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <FilterChips
          current={sp.retro === "1" ? "1" : ""}
          options={[{ v: "1", l: "Tylko retro" }]}
          param="retro"
          existing={sp}
        />
      </section>

      {/* Grid kart */}
      <section className="mt-6">
        {enriched.length === 0 ? (
          <EmptyState
            title="Brak aktywnych ogłoszeń"
            sub="Żadne ogłoszenie nie pasuje do wybranych filtrów. Zmień filtry albo zajrzyj tu później."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {enriched.map(({ d, label, crest }) => (
              <article key={d.id} className="card p-4 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-[10px] bg-surface-2 border border-border-soft flex items-center justify-center flex-shrink-0 overflow-hidden text-[15px] font-medium text-text-soft">
                    {crest ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={crest} alt={label} width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      label[0]?.toUpperCase() ?? "?"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium truncate">{label}</div>
                    <div className="mt-0.5 text-[11px] text-text-mute truncate">
                      {d.kind === "club" ? "Klub" : d.kind === "national_team" ? "Reprezentacja" : "Nazwisko"}
                      {d.season && <span className="num"> · sezon {d.season}</span>}
                    </div>
                  </div>
                  {d.retro && <span className="pill pill-amber flex-shrink-0">Retro</span>}
                </div>

                {d.sizes && d.sizes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {d.sizes.map((s) => (
                      <span key={s} className="px-1.5 py-0.5 rounded-[6px] bg-blue/12 text-blue-soft text-[10px] font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {d.notes && (
                  <p className="mt-3 text-[12px] text-text-soft leading-[1.5] line-clamp-2">{d.notes}</p>
                )}

                <div className="mt-4 pt-3 border-t border-border-soft flex items-center justify-between gap-3">
                  <div className="text-[11px] num text-text-faint">{formatDate(d.published_at)}</div>
                  {d.target_price_cents && (
                    <div className="text-[14px] num text-mint whitespace-nowrap">
                      do {formatPLN(d.target_price_cents, { decimals: false })}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* CTA-karta */}
      <section className="mt-8">
        <div className="card p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="label">Masz pasującą koszulkę?</div>
            <div className="mt-1.5 font-light text-[20px] tracking-[-0.02em]">
              Dodaj ją do najbliższej Oferty.
            </div>
          </div>
          <ButtonLink href="/start" size="md">
            Nowa oferta <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

function FilterChips({
  current, options, param, existing,
}: {
  current: string;
  options: Array<{ v: string; l: string }>;
  param: keyof Filter;
  existing: Filter;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((o) => {
        const active = current === o.v && o.v !== "";
        const isAll = o.v === "";
        const activeAll = isAll && current === "";
        const next: Record<string, string> = { ...existing };
        // Toggle: klik w aktywny chip zdejmuje filtr (parametry URL bez zmian).
        if (o.v && current !== o.v) next[param as string] = o.v;
        else delete next[param as string];
        const query = new URLSearchParams(next).toString();
        return (
          <Link
            key={o.v || "any"}
            href={`/panel/zapotrzebowanie${query ? "?" + query : ""}`}
            className={`inline-flex items-center h-9 px-3.5 rounded-full text-[13px] font-medium border transition-colors active:scale-[.98] ${
              active || activeAll
                ? "border-lime/40 bg-lime/10 text-lime"
                : "border-border bg-surface text-text-soft hover:text-text hover:bg-surface-2"
            }`}
          >
            {o.l}
          </Link>
        );
      })}
    </div>
  );
}
