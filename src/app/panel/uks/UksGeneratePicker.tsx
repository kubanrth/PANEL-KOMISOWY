"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPLN, plural } from "@/lib/format";

type SoldItem = {
  id: string;
  brand: string;
  model: string;
  size: string | null;
  price_cents: number;
};

/** Wybór sprzedanych pozycji → jedna umowa UKS na wszystkie zaznaczone. */
export function UksGeneratePicker({ items }: { items: SoldItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const count = selected.size;
  const sum = items.filter((i) => selected.has(i.id)).reduce((a, i) => a + i.price_cents, 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto no-scrollbar">
        {items.map((p) => {
          const active = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              aria-pressed={active}
              className={`w-full flex items-center justify-between gap-3 px-3.5 h-11 rounded-[11px] text-[13px] transition-colors border ${
                active ? "border-lime/40 bg-lime/8 text-text" : "border-transparent hover:bg-surface-2/60 text-text-soft"
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`h-4 w-4 rounded-[5px] border-2 flex-shrink-0 flex items-center justify-center ${
                    active ? "border-lime bg-lime" : "border-border"
                  }`}
                  aria-hidden
                >
                  {active && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="truncate">{p.brand} · {p.model}{p.size ? ` · ${p.size}` : ""}</span>
              </span>
              <span className="num text-text-mute flex-shrink-0">{formatPLN(p.price_cents, { decimals: false })}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={count === 0}
        onClick={() => router.push(`/panel/uks/generuj?products=${Array.from(selected).join(",")}`)}
        className="btn-primary h-10 px-4 text-[13px] w-full mt-3 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {count === 0
          ? "Zaznacz pozycje do umowy"
          : `Generuj umowę · ${count} ${plural(count, ["pozycja", "pozycje", "pozycji"])} · ${formatPLN(sum, { decimals: false })}`}
      </button>
    </div>
  );
}
