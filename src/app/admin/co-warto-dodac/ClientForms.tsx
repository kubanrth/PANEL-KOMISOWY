"use client";

import { useRef, useState, useTransition } from "react";
import type { KickbackPick } from "@/lib/types";
import { createPick, updatePick, togglePickActive, deletePick } from "./actions";

/* ====================================================== */
/* Create form                                             */
/* ====================================================== */

const CATEGORIES = ["Trend", "Hot brand", "Sezon", "Rzadkość", "Polskie kluby", "Retro", "Reprezentacje"];

export function CreatePickForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  return (
    <form
      ref={ref}
      action={(fd) =>
        start(async () => {
          setMsg(null);
          const r = await createPick(fd);
          if (r.ok) {
            setMsg({ kind: "ok", text: r.message ?? "OK" });
            ref.current?.reset();
          } else setMsg({ kind: "err", text: r.error });
        })
      }
      className="card-elev p-6 space-y-4"
    >
      <div>
        <div className="label">Nowy pick</div>
        <div className="mt-1 font-semibold text-lg tracking-[-0.025em]">Dodaj sugestię „co warto"</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="input-label">Tytuł *</label>
          <input name="title" required maxLength={120} className="input" placeholder="Polskie kluby retro 90s" />
        </div>
        <div>
          <label className="input-label">Kategoria</label>
          <input name="category" list="pick-categories" className="input" placeholder="Trend" />
          <datalist id="pick-categories">
            {CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>

      <div>
        <label className="input-label">Opis (markdown light)</label>
        <textarea
          name="description"
          rows={3}
          className="input min-h-[88px] resize-y"
          placeholder="Koszulki polskiej Ekstraklasy z lat 90 są w cenie — wyceny od 800 do 2500 zł."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="input-label">Priority (wyższy = wyżej)</label>
          <input name="priority" type="number" min={0} max={10000} defaultValue={100} className="input" />
        </div>
        <div className="md:col-span-2">
          <label className="input-label">Image URL (opcjonalne)</label>
          <input name="image_url" className="input" placeholder="https://..." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="input-label">CTA label</label>
          <input name="cta_label" maxLength={40} className="input" placeholder="Zobacz w zapotrzebowaniu" />
        </div>
        <div className="md:col-span-2">
          <label className="input-label">CTA href</label>
          <input name="cta_href" className="input" placeholder="/panel/zapotrzebowanie?kind=club" />
        </div>
      </div>

      <div>
        <label className="input-label">Wygasa (opcjonalne, YYYY-MM-DD)</label>
        <input name="expires_at" type="date" className="input" />
      </div>

      {msg && (
        <div className={`text-[13px] ${msg.kind === "ok" ? "text-mint" : "text-coral"}`}>{msg.text}</div>
      )}

      <div className="flex items-center justify-end">
        <button type="submit" disabled={pending} className="btn-primary h-10 px-5 text-[14px]">
          {pending ? "Publikuję…" : "Opublikuj"}
        </button>
      </div>
    </form>
  );
}

/* ====================================================== */
/* Edit form (inside drawer/modal-like inline card)        */
/* ====================================================== */

export function EditPickRow({ pick }: { pick: KickbackPick }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-blue hover:underline"
        >
          Edytuj
        </button>
        <span className="text-text-faint text-[10px]">·</span>
        <button
          type="button"
          onClick={() =>
            start(async () => {
              await togglePickActive(pick.id, !pick.active);
            })
          }
          className={`text-[11px] ${pick.active ? "text-amber" : "text-mint"} hover:underline`}
        >
          {pick.active ? "Wyłącz" : "Włącz"}
        </button>
        <span className="text-text-faint text-[10px]">·</span>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Usunąć pick "${pick.title}"?`)) {
              start(async () => { await deletePick(pick.id); });
            }
          }}
          className="text-[11px] text-coral hover:underline"
        >
          Usuń
        </button>
      </div>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          setMsg(null);
          const r = await updatePick(pick.id, fd);
          if (r.ok) {
            setMsg("Zapisano");
            setTimeout(() => setEditing(false), 600);
          } else setMsg(r.error);
        })
      }
      className="col-span-full -mx-4 -my-3 px-4 py-4 bg-surface-2/40 border-t border-border-soft space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="input-label">Tytuł *</label>
          <input name="title" required defaultValue={pick.title} className="input" />
        </div>
        <div>
          <label className="input-label">Kategoria</label>
          <input name="category" defaultValue={pick.category ?? ""} className="input" />
        </div>
      </div>
      <div>
        <label className="input-label">Opis</label>
        <textarea name="description" defaultValue={pick.description ?? ""} rows={2} className="input min-h-[64px] resize-y" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="input-label">Priority</label>
          <input name="priority" type="number" defaultValue={pick.priority} className="input" />
        </div>
        <div className="md:col-span-2">
          <label className="input-label">Image URL</label>
          <input name="image_url" defaultValue={pick.image_url ?? ""} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="input-label">CTA label</label>
          <input name="cta_label" defaultValue={pick.cta_label ?? ""} className="input" />
        </div>
        <div className="md:col-span-2">
          <label className="input-label">CTA href</label>
          <input name="cta_href" defaultValue={pick.cta_href ?? ""} className="input" />
        </div>
      </div>
      <div>
        <label className="input-label">Wygasa</label>
        <input
          name="expires_at"
          type="date"
          defaultValue={pick.expires_at ? pick.expires_at.slice(0, 10) : ""}
          className="input"
        />
      </div>
      {msg && <div className="text-[12px] text-text-soft">{msg}</div>}
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => setEditing(false)} className="text-[13px] text-text-soft hover:text-text">
          Anuluj
        </button>
        <button type="submit" disabled={pending} className="btn-primary h-9 px-4 text-[13px]">
          {pending ? "Zapisuję…" : "Zapisz"}
        </button>
      </div>
    </form>
  );
}
