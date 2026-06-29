"use client";

import { useRef, useState, useTransition } from "react";
import { createDemandListing } from "./actions";

type CatalogItem = { id: string; label: string };

type Props = {
  clubs: CatalogItem[];
  nationalTeams: CatalogItem[];
  players: CatalogItem[];
};

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "One Size", "Boys M", "Boys L"];

export function DemandForm({ clubs, nationalTeams, players }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"club" | "national_team" | "player">("club");
  const [sizes, setSizes] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const options =
    kind === "club" ? clubs : kind === "national_team" ? nationalTeams : players;

  function toggleSize(s: string) {
    setSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <form
      ref={ref}
      action={(formData) =>
        start(async () => {
          setMsg(null);
          formData.set("kind", kind);
          formData.set("sizes", sizes.join(","));
          const res = await createDemandListing(formData);
          if (res.ok) {
            setMsg({ kind: "ok", text: "Ogłoszenie opublikowane." });
            ref.current?.reset();
            setSizes([]);
          } else {
            setMsg({ kind: "err", text: res.error });
          }
        })
      }
      className="card-elev p-6 space-y-4"
    >
      <div>
        <div className="label">Nowe ogłoszenie</div>
        <div className="mt-1 font-semibold text-lg tracking-[-0.025em]">Co aktualnie poszukujemy</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="input-label">Rodzaj</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as "club" | "national_team" | "player")} className="input">
            <option value="club">Klub</option>
            <option value="national_team">Reprezentacja</option>
            <option value="player">Zawodnik</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="input-label">Z katalogu</label>
          <select name="target_id" className="input">
            <option value="">— wybierz lub wpisz ręcznie poniżej —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="input-label">…lub wpisz ręcznie (raw label)</label>
        <input name="raw_label" placeholder="np. Real Madryt CR7 #7" className="input" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="input-label">Sezon</label>
          <input name="season" placeholder="2024/25" className="input" />
        </div>
        <div>
          <label className="input-label">Możliwa cena (zł)</label>
          <input name="target_price" placeholder="2500" className="input" />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <input id="retro" type="checkbox" name="retro" className="cursor-pointer" />
          <label htmlFor="retro" className="text-[13px] text-text-soft cursor-pointer">Retro</label>
        </div>
      </div>

      <div>
        <label className="input-label">Rozmiary (opcjonalne — pusty = każdy rozmiar)</label>
        <div className="flex flex-wrap gap-2">
          {SIZE_OPTIONS.map((s) => {
            const active = sizes.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSize(s)}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors ${
                  active ? "bg-blue text-white" : "bg-surface text-text-soft hover:text-text border border-border"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 text-[10px] text-text-mute">
          {sizes.length === 0 ? "Brak filtra — szukamy wszystkich rozmiarów" : `Wybrano: ${sizes.join(", ")}`}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="input-label">Notatki publiczne (widoczne klientom)</label>
          <textarea name="notes" rows={2} className="input min-h-[60px] resize-y" />
        </div>
        <div>
          <label className="input-label">Notatki wewnętrzne (tylko admin)</label>
          <textarea name="notes_admin" rows={2} className="input min-h-[60px] resize-y" placeholder="np. kontakt do sprzedawcy" />
        </div>
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
