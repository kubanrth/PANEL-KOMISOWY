import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { formatPLN, formatDate } from "@/lib/format";
import type { DemandListing, Club, NationalTeam, Player } from "@/lib/types";
import { DemandForm } from "./DemandForm";
import { RowActions } from "./RowActions";
import { BulkImport } from "./BulkImport";

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

  function labelOf(d: DemandListing): string {
    if (d.club_id) return clubById.get(d.club_id) ?? d.raw_label ?? "—";
    if (d.national_team_id) return teamById.get(d.national_team_id) ?? d.raw_label ?? "—";
    if (d.player_id) return playerById.get(d.player_id) ?? d.raw_label ?? "—";
    return d.raw_label ?? "—";
  }

  return (
    <AdminShell
      user={user}
      profile={profile}
      active="zapotrzebowanie"
      breadcrumb={[{ label: "Zapotrzebowanie" }]}
    >
      <section>
        <div className="label">{active.length} aktywnych · {inactive.length} archiwum</div>
        <h1 className="mt-3 font-light text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.02em]">
          Zapotrzebowanie.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Publikuj ogłoszenia „szukamy koszulek" widoczne dla wszystkich klientów w ich panelu.
          Możesz edytować istniejące wpisy, wyłączać i przywracać z archiwum, oraz hurtowo importować z CSV.
        </p>
      </section>

      <section className="mt-8">
        <DemandForm clubs={clubItems} nationalTeams={teamItems} players={playerItems} />
      </section>

      <section className="mt-6">
        <BulkImport />
      </section>

      {/* Aktywne */}
      <section className="mt-10">
        <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">
          Aktywne ogłoszenia ({active.length})
        </h2>
        {active.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-8 text-center text-[13px] text-text-soft">
            Brak aktywnych ogłoszeń.
          </div>
        ) : (
          <DemandList demands={active} labelOf={labelOf} />
        )}
      </section>

      {/* Archiwum */}
      {inactive.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">
            Archiwum ({inactive.length})
          </h2>
          <p className="text-[12px] text-text-mute mb-3">
            Wyłączone ogłoszenia. Możesz przywrócić każde z nich klikiem „Aktywuj".
          </p>
          <DemandList demands={inactive} labelOf={labelOf} muted />
        </section>
      )}
    </AdminShell>
  );
}

function DemandList({
  demands, labelOf, muted = false,
}: {
  demands: DemandListing[];
  labelOf: (d: DemandListing) => string;
  muted?: boolean;
}) {
  return (
    <div className={`card overflow-hidden ${muted ? "opacity-60" : ""}`}>
      {demands.map((d, i) => (
        <div
          key={d.id}
          className={`${i > 0 ? "border-t border-border-soft" : ""} px-4 py-4`}
        >
          <div className="grid grid-cols-1 md:grid-cols-[120px_minmax(200px,2.5fr)_100px_120px_minmax(120px,1fr)_120px_180px] gap-3 items-start">
            <div className="text-[12px] text-text-soft">
              {d.kind === "club" ? "Klub" : d.kind === "national_team" ? "Repr." : "Zawodnik"}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium truncate">{labelOf(d)}</div>
              {d.notes && <div className="text-[11px] text-text-mute mt-0.5 line-clamp-1">{d.notes}</div>}
            </div>
            <div className="text-[12px] num text-text-soft">{d.season ?? "—"}</div>
            <div className="text-[13px] num text-mint">
              {d.target_price_cents ? formatPLN(d.target_price_cents, { decimals: false }) : "—"}
            </div>
            <div className="flex flex-wrap gap-1">
              {d.sizes && d.sizes.length > 0 ? (
                d.sizes.map((s) => (
                  <span key={s} className="pill pill-mute text-[10px] px-1.5">{s}</span>
                ))
              ) : (
                <span className="text-[10px] text-text-faint">każdy</span>
              )}
              {d.retro && <span className="pill pill-amber text-[10px] px-1.5">retro</span>}
            </div>
            <div className="text-[11px] num text-text-mute">{formatDate(d.published_at)}</div>
            <div>
              <RowActions row={d} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
