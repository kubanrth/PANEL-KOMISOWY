import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import type { KickbackPick } from "@/lib/types";
import { CreatePickForm, EditPickRow } from "./ClientForms";

export default async function AdminCoWartoDodacPage() {
  const { supabase } = await requireAdmin();

  const { data: picksRaw } = await supabase
    .from("kickback_picks")
    .select("*")
    .order("priority", { ascending: false })
    .order("published_at", { ascending: false });

  const picks = (picksRaw ?? []) as KickbackPick[];
  const active = picks.filter((p) => p.active);
  const inactive = picks.filter((p) => !p.active);

  return (
    <>
      <section>
        <div className="label">{active.length} aktywnych · {inactive.length} wyłączonych</div>
        <h1 className="mt-3 font-display font-bold uppercase text-[18px] lg:text-[24px] leading-[1.15] tracking-[0.01em]">
          Co warto dodać do komisu.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[64ch]">
          Manualnie kurowana lista rekomendacji wyświetlana komisantom NAD heurystycznymi
          „Sugestiami Kickback" w panelu Plany sprzedaży. Posortowana po polu Priority desc.
        </p>
      </section>

      <section className="mt-8">
        <CreatePickForm />
      </section>

      {/* Active picks */}
      <section className="mt-10">
        <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">
          Aktywne ({active.length})
        </h2>
        {active.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-8 text-center text-[13px] text-text-soft">
            Brak aktywnych picks. Komisanty widzą tylko heurystyki dopóki coś tu nie dodasz.
          </div>
        ) : (
          <PicksList picks={active} />
        )}
      </section>

      {/* Inactive */}
      {inactive.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">Wyłączone / archiwum</h2>
          <PicksList picks={inactive} muted />
        </section>
      )}
    </>
  );
}

function PicksList({ picks, muted = false }: { picks: KickbackPick[]; muted?: boolean }) {
  return (
    <div className={`card overflow-hidden ${muted ? "opacity-60" : ""}`}>
      {picks.map((p, i) => (
        <div
          key={p.id}
          className={`px-4 py-4 grid grid-cols-1 md:grid-cols-[60px_minmax(220px,3fr)_140px_120px_140px_200px] gap-3 items-start ${
            i > 0 ? "border-t border-border-soft" : ""
          }`}
        >
          {/* Priority */}
          <div className="text-[11px]">
            <div className="label">Pri.</div>
            <div className="mt-1 font-bold text-base num">{p.priority}</div>
          </div>

          {/* Title + description */}
          <div className="min-w-0">
            <div className="font-semibold text-[15px] tracking-[-0.015em]">{p.title}</div>
            {p.description && (
              <div className="mt-1 text-[12px] text-text-soft line-clamp-2">{p.description}</div>
            )}
            {p.cta_label && p.cta_href && (
              <div className="mt-1.5 text-[11px] text-blue">{p.cta_label} → <span className="text-text-mute num">{p.cta_href}</span></div>
            )}
          </div>

          {/* Category */}
          <div>
            <div className="label">Kategoria</div>
            <div className="mt-1 text-[12px]">
              {p.category ? <span className="pill pill-mute">{p.category}</span> : <span className="text-text-faint text-[11px]">—</span>}
            </div>
          </div>

          {/* Status + active */}
          <div>
            <div className="label">Status</div>
            <div className="mt-1">
              <span className={`pill ${p.active ? "pill-mint" : "pill-mute"}`}>
                {p.active ? "Aktywny" : "Wyłączony"}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div>
            <div className="label">Dat</div>
            <div className="mt-1 text-[11px] num text-text-soft">
              opub. {formatDate(p.published_at)}
            </div>
            {p.expires_at && (
              <div className="text-[10px] num text-amber">wyg. {formatDate(p.expires_at)}</div>
            )}
          </div>

          {/* Actions */}
          <div className="md:text-right">
            <EditPickRow pick={p} />
          </div>
        </div>
      ))}
    </div>
  );
}
