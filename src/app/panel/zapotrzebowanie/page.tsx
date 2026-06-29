import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type { DemandListing, Club, NationalTeam, Player } from "@/lib/types";

type Filter = { kind?: "club" | "national_team" | "player"; retro?: "1" };

export default async function ZapotrzebowaniePage(props: { searchParams: Promise<Filter> }) {
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
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="zapotrzebowanie"
      breadcrumb={[{ label: "Zapotrzebowanie" }]}
    >
      <section>
        <div className="label">Bieżące poszukiwania Kickback</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Zapotrzebowanie.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Aktywne ogłoszenia — koszulki, których aktualnie poszukujemy. Masz pasującą pozycję? Dodaj ją do
          najbliższej Oferty.
        </p>
      </section>

      {/* Filters */}
      <section className="mt-8 flex flex-wrap items-center gap-3">
        <FilterPills
          label="Rodzaj"
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
        <FilterPills
          label="Retro"
          current={sp.retro === "1" ? "1" : ""}
          options={[
            { v: "", l: "Wszystkie" },
            { v: "1", l: "Tylko retro" },
          ]}
          param="retro"
          existing={sp}
        />
      </section>

      {/* List */}
      <section className="mt-8">
        {enriched.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center text-text-soft text-[14px]">
            Brak aktywnych ogłoszeń pasujących do filtrów.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {enriched.map(({ d, label, crest }) => (
              <article key={d.id} className="card p-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {crest ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={crest} alt={label} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-text-mute text-[10px] uppercase">
                        {d.kind === "club" ? "Klub" : d.kind === "national_team" ? "Repr." : "Nazw."}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[15px] truncate">{label}</div>
                    <div className="mt-1 text-[12px] text-text-mute">
                      {d.kind === "club" ? "Klub" : d.kind === "national_team" ? "Reprezentacja" : "Nazwisko"}
                      {d.season && ` · sezon ${d.season}`}
                      {d.retro && " · retro"}
                    </div>
                  </div>
                  {d.retro && <span className="pill pill-amber text-[10px]">retro</span>}
                </div>

                {d.sizes && d.sizes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-text-mute uppercase tracking-wider mr-1 self-center">Rozmiary:</span>
                    {d.sizes.map((s) => (
                      <span key={s} className="pill pill-blue text-[10px] px-1.5">{s}</span>
                    ))}
                  </div>
                )}

                {d.target_price_cents && (
                  <div className="mt-4 pt-4 border-t border-border-soft flex items-center justify-between">
                    <div className="text-[11px] text-text-mute">Możliwa cena</div>
                    <div className="font-bold text-lg num text-mint">
                      {formatPLN(d.target_price_cents, { decimals: false })}
                    </div>
                  </div>
                )}

                {d.notes && (
                  <p className="mt-3 text-[12px] text-text-soft line-clamp-2">{d.notes}</p>
                )}

                <div className="mt-4 text-[10px] text-text-faint">
                  Opublikowano: {formatDate(d.published_at)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 card p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="label">Masz pasujące pozycje?</div>
          <div className="mt-1 font-semibold text-lg tracking-[-0.025em]">Dodaj je do Oferty.</div>
        </div>
        <ButtonLink href="/start" size="md">
          Nowa Oferta <ArrowRight size={14} />
        </ButtonLink>
      </section>
    </PanelShell>
  );
}

function FilterPills({
  label, current, options, param, existing,
}: {
  label: string;
  current: string;
  options: Array<{ v: string; l: string }>;
  param: keyof Filter;
  existing: Filter;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-[12px]">
      <span className="label">{label}:</span>
      {options.map((o) => {
        const active = current === o.v;
        const next: Record<string, string> = { ...existing };
        if (o.v) next[param as string] = o.v;
        else delete next[param as string];
        const query = new URLSearchParams(next).toString();
        const cls = active
          ? "bg-text text-bg font-semibold"
          : "bg-surface text-text-soft hover:bg-surface-2 hover:text-text";
        return (
          <Link
            key={o.v || "any"}
            href={`/panel/zapotrzebowanie${query ? "?" + query : ""}`}
            className={`px-2.5 py-1 rounded-[8px] transition-colors ${cls}`}
          >
            {o.l}
          </Link>
        );
      })}
    </div>
  );
}

// Reference imports to avoid TS unused-export errors in dev:
void Link;
