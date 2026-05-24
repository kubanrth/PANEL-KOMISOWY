"use client";

import { useState } from "react";
import { formatPLN } from "@/lib/format";

type Props = {
  /** Last-30-day revenue in cents (anchor of the simulation). */
  currentRevenue30d: number;
  /** Count of items currently in stock — used as the multiplier base. */
  currentStockCount: number;
  /** Value of items currently in stock. */
  currentStockValueCents: number;
};

/**
 * "Co jeśli zwiększysz komis o X%" symulator. Heurystyka: zakładamy
 * liniową korelację między wartością magazynu a przychodem 30-dniowym.
 * Slider 0-50% — projekcja = revenue × (1 + slider).
 * To proste i deterministyczne; nie udajemy ML — pokazujemy zależność,
 * którą klient sam może zweryfikować w swoich danych.
 */
export function RevenueSimulator({ currentRevenue30d, currentStockCount, currentStockValueCents }: Props) {
  const [pct, setPct] = useState(20);
  const projected = Math.round(currentRevenue30d * (1 + pct / 100));
  const delta = projected - currentRevenue30d;
  const addedStock = Math.round((currentStockValueCents * pct) / 100);

  return (
    <div className="card-elev p-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="label">Symulator przychodu</div>
          <div className="mt-1 font-semibold text-xl tracking-[-0.025em]">
            Co jeśli zwiększysz komis o <span className="text-blue num">{pct}%</span>?
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-text-mute">Obecne 30d</div>
          <div className="font-bold text-2xl tracking-[-0.035em] num">
            {formatPLN(currentRevenue30d, { decimals: false })}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <input
          type="range"
          min={0}
          max={50}
          step={5}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="w-full accent-blue cursor-pointer"
        />
        <div className="mt-1 flex justify-between text-[10px] text-text-mute num">
          <span>0%</span><span>10%</span><span>20%</span><span>30%</span><span>40%</span><span>50%</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 pt-5 border-t border-border-soft">
        <Cell label="Projekcja 30d" value={formatPLN(projected, { decimals: false })} accent="text-mint" />
        <Cell label="Dodatkowy przychód" value={`+${formatPLN(delta, { decimals: false })}`} />
        <Cell
          label="Dodatkowy stock"
          value={formatPLN(addedStock, { decimals: false })}
          sub={`~${Math.round(currentStockCount * (pct / 100))} pozycji`}
        />
      </div>

      <p className="mt-4 text-[11px] text-text-mute">
        Heurystyka: zakładamy proporcjonalność wartości magazynu i przychodu 30-dniowego.
        Realne wyniki zależą od rotacji per marka — szczegóły w karcie „Wskaźnik rotacji”.
      </p>
    </div>
  );
}

function Cell({ label, value, sub, accent = "" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div>
      <div className="text-[10px] text-text-mute font-semibold uppercase tracking-wider">{label}</div>
      <div className={`mt-1.5 font-bold text-2xl tracking-[-0.035em] num ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-text-mute">{sub}</div>}
    </div>
  );
}
