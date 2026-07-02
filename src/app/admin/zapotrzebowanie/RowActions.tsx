"use client";

import { useState, useTransition } from "react";
import type { DemandListing } from "@/lib/types";
import {
  deactivateDemandListing,
  reactivateDemandListing,
  updateDemandListing,
} from "./actions";

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "One Size", "Boys M", "Boys L"];

/* ====================================================== */
/* Lightweight row actions: edit | deactivate | reactivate */
/* ====================================================== */

export function RowActions({ row }: { row: DemandListing }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return <EditDrawer row={row} onClose={() => setEditing(false)} />;
  }

  return (
    <div className="flex items-center gap-2 justify-end flex-wrap">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[11px] text-lime hover:underline"
      >
        Edytuj
      </button>
      <span className="text-[10px] text-text-faint">·</span>
      {row.active ? (
        <button
          type="button"
          onClick={() => start(async () => { await deactivateDemandListing(row.id); })}
          disabled={pending}
          className="text-[11px] text-text-mute hover:text-coral transition-colors"
        >
          {pending ? "…" : "Wyłącz"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => start(async () => { await reactivateDemandListing(row.id); })}
          disabled={pending}
          className="text-[11px] text-text-mute hover:text-mint transition-colors"
        >
          {pending ? "…" : "Aktywuj"}
        </button>
      )}
    </div>
  );
}

/* ====================================================== */
/* Inline edit drawer (renders inline below row)           */
/* ====================================================== */

function EditDrawer({ row, onClose }: { row: DemandListing; onClose: () => void }) {
  const [sizes, setSizes] = useState<string[]>(row.sizes ?? []);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggleSize(s: string) {
    setSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          setMsg(null);
          fd.set("sizes", sizes.join(","));
          const r = await updateDemandListing(row.id, fd);
          if (r.ok) {
            setMsg("Zapisano");
            setTimeout(onClose, 600);
          } else {
            setMsg(r.error);
          }
        })
      }
      className="col-span-full mt-3 px-3 py-3 bg-surface-2/40 rounded-[12px] space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="input-label">Sezon</label>
          <input name="season" defaultValue={row.season ?? ""} className="input" />
        </div>
        <div>
          <label className="input-label">Możliwa cena (zł)</label>
          <input
            name="target_price"
            defaultValue={row.target_price_cents ? (row.target_price_cents / 100).toString() : ""}
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[12px] text-text-soft inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="retro" defaultChecked={row.retro} className="cursor-pointer" />
          Retro
        </label>
      </div>

      <div>
        <label className="input-label">Raw label (jeśli poza katalogiem)</label>
        <input name="raw_label" defaultValue={row.raw_label ?? ""} className="input" />
      </div>

      <div>
        <label className="input-label">Rozmiary</label>
        <div className="flex flex-wrap gap-2">
          {SIZE_OPTIONS.map((s) => {
            const active = sizes.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSize(s)}
                className={`px-2.5 py-1 rounded-[8px] text-[11px] font-medium transition-colors ${
                  active ? "bg-lime text-[#05140B]" : "bg-surface text-text-soft hover:text-text border border-border"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="input-label">Notatki publiczne</label>
          <textarea name="notes" defaultValue={row.notes ?? ""} rows={2} className="input min-h-[56px] resize-y" />
        </div>
        <div>
          <label className="input-label">Notatki wewnętrzne</label>
          <textarea name="notes_admin" defaultValue={row.notes_admin ?? ""} rows={2} className="input min-h-[56px] resize-y" />
        </div>
      </div>

      {msg && <div className="text-[12px] text-text-soft">{msg}</div>}

      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={onClose} className="text-[12px] text-text-soft hover:text-text">
          Anuluj
        </button>
        <button type="submit" disabled={pending} className="btn-primary h-9 px-4 text-[13px]">
          {pending ? "Zapisuję…" : "Zapisz"}
        </button>
      </div>
    </form>
  );
}
