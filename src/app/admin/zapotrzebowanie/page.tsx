import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { formatPLN, formatDate } from "@/lib/format";
import type { DemandListing, Club, NationalTeam, Player } from "@/lib/types";
import { DemandForm } from "./DemandForm";
import { DeactivateButton } from "./DeactivateButton";

export default async function AdminZapotrzebowaniePage() {
  const { user, profile, supabase } = await requireAdmin();

  const { data: demandsRaw } = await supabase
    .from("demand_listings")
    .select("*")
    .order("published_at", { ascending: false });
  const demands = (demandsRaw ?? []) as DemandListing[];

  const [clubs, teams, players] = await Promise.all([
    supabase.from("clubs").select("id, name, country, league").order("name"),
    supabase.from("national_teams").select("id, name").order("name"),
    supabase.from("players").select("id, full_name").order("full_name"),
  ]);

  const clubItems = ((clubs.data ?? []) as Pick<Club, "id" | "name" | "country" | "league">[]).map((c) => ({
    id: c.id,
    label: `${c.name}${c.league ? ` (${c.league})` : ""}`,
  }));
  const teamItems = ((teams.data ?? []) as Pick<NationalTeam, "id" | "name">[]).map((t) => ({ id: t.id, label: t.name }));
  const playerItems = ((players.data ?? []) as Pick<Player, "id" | "full_name">[]).map((p) => ({ id: p.id, label: p.full_name }));

  const clubById = new Map(clubItems.map((c) => [c.id, c.label]));
  const teamById = new Map(teamItems.map((t) => [t.id, t.label]));
  const playerById = new Map(playerItems.map((p) => [p.id, p.label]));

  const active = demands.filter((d) => d.active);
  const inactive = demands.filter((d) => !d.active);

  return (
    <AdminShell
      user={user}
      profile={profile}
      active="zapotrzebowanie"
      breadcrumb={[{ label: "Zapotrzebowanie" }]}
    >
      <section>
        <div className="label">{active.length} aktywnych · {inactive.length} archiwum</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Zapotrzebowanie.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Publikuj ogłoszenia "szukamy koszulek" widoczne dla wszystkich klientów w ich panelu.
        </p>
      </section>

      <section className="mt-8">
        <DemandForm clubs={clubItems} nationalTeams={teamItems} players={playerItems} />
      </section>

      <section className="mt-10">
        <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">Aktywne ogłoszenia</h2>
        {active.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-8 text-center text-[13px] text-text-soft">
            Brak aktywnych ogłoszeń.
          </div>
        ) : (
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[120px_minmax(200px,2fr)_100px_120px_140px_120px_100px] gap-3 px-4 py-3 label border-b border-border-soft">
              <div>Rodzaj</div>
              <div>Pozycja</div>
              <div>Sezon</div>
              <div>Cena</div>
              <div>Opublikowano</div>
              <div>Retro</div>
              <div className="text-right">Akcja</div>
            </div>
            {active.map((d) => {
              const label = d.club_id
                ? clubById.get(d.club_id)
                : d.national_team_id
                  ? teamById.get(d.national_team_id)
                  : d.player_id
                    ? playerById.get(d.player_id)
                    : d.raw_label;
              return (
                <div
                  key={d.id}
                  className="grid grid-cols-[120px_minmax(200px,2fr)_100px_120px_140px_120px_100px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
                >
                  <div className="text-[12px] text-text-soft">
                    {d.kind === "club" ? "Klub" : d.kind === "national_team" ? "Repr." : "Zawodnik"}
                  </div>
                  <div className="text-[13px] font-medium truncate">{label ?? "—"}</div>
                  <div className="text-[12px] num text-text-soft">{d.season ?? "—"}</div>
                  <div className="text-[13px] num text-mint">
                    {d.target_price_cents ? formatPLN(d.target_price_cents, { decimals: false }) : "—"}
                  </div>
                  <div className="text-[12px] num text-text-soft">{formatDate(d.published_at)}</div>
                  <div className="text-[12px] text-text-soft">{d.retro ? "Tak" : "—"}</div>
                  <div className="text-right">
                    <DeactivateButton id={d.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
