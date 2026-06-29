"use client";

import { useState, useTransition } from "react";
import { bulkImportDemandListings } from "./actions";

const SAMPLE_CSV = `kind,nazwa,sezon,retro,cena,rozmiary,notatki
club,Real Madryt,2003/04,1,2500,M;L,Zidane jersey
player,Robert Lewandowski,2024/25,0,1800,L,Barcelona
national_team,Polska,Euro 2024,0,900,M;L;XL,`;

export function BulkImport() {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; skipped?: string[] } | null>(null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[14px] p-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-[14px]">Bulk import z CSV</div>
          <div className="text-[12px] text-text-mute mt-0.5">Wkleisz CSV → system tworzy wpisy hurtowo.</div>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost h-9 px-4 text-[13px]">
          Otwórz import
        </button>
      </div>
    );
  }

  return (
    <div className="card-elev p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="font-semibold text-[15px]">Bulk import z CSV</div>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-text-mute hover:text-text">
          ×
        </button>
      </div>

      <div className="text-[12px] text-text-soft">
        Format: <span className="num">kind,nazwa,sezon,retro,cena,rozmiary,notatki</span>
      </div>
      <div className="text-[11px] text-text-mute">
        <strong>kind</strong> = club / national_team / player. <strong>nazwa</strong> matchowana po
        dokładnej nazwie z katalogu (np. „Real Madryt"). Jeśli brak — wpis trafia jako raw label.
        <strong> rozmiary</strong> separowane średnikiem (np. <span className="num">M;L;XL</span>).
        <strong> retro</strong> = 1/0/yes/no.
      </div>

      <button
        type="button"
        onClick={() => setText(SAMPLE_CSV)}
        className="text-[11px] text-blue hover:underline"
      >
        Wklej przykład
      </button>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Wklej CSV tutaj..."
        className="input min-h-[200px] resize-y font-mono text-[12px]"
      />

      {msg && (
        <div className="space-y-1">
          <div className={`text-[13px] ${msg.kind === "ok" ? "text-mint" : "text-coral"}`}>{msg.text}</div>
          {msg.skipped && msg.skipped.length > 0 && (
            <div className="text-[11px] text-amber">
              Pominięte: {msg.skipped.join(" · ")}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setText("");
            setMsg(null);
          }}
          className="text-[12px] text-text-soft hover:text-text"
        >
          Wyczyść
        </button>
        <button
          type="button"
          onClick={() =>
            start(async () => {
              setMsg(null);
              const r = await bulkImportDemandListings(text);
              if (r.ok) {
                setMsg({ kind: "ok", text: r.message ?? "OK", skipped: r.skipped });
                if (r.importedCount && r.importedCount > 0) setText("");
              } else {
                setMsg({ kind: "err", text: r.error });
              }
            })
          }
          disabled={pending || !text.trim()}
          className="btn-primary h-10 px-5 text-[14px]"
        >
          {pending ? "Importuję…" : "Importuj"}
        </button>
      </div>
    </div>
  );
}
