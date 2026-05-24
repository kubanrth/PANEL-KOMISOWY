"use client";

import { useMemo } from "react";
import type { InventorySnapshot } from "@/lib/types";
import { formatPLN } from "@/lib/format";

type Props = {
  snapshots: InventorySnapshot[];
};

/**
 * Minimalistyczny SVG line chart wartości magazynu w czasie. Bez
 * recharts/d3 — ~80 linii, robi co potrzeba. Skala Y dynamiczna,
 * tooltip na hover przez tytuł.
 */
export function InventoryChart({ snapshots }: Props) {
  const data = useMemo(() => {
    if (snapshots.length === 0) return null;
    const points = snapshots.map((s) => ({
      day: s.day,
      value: s.total_value_cents,
    }));
    const max = Math.max(...points.map((p) => p.value), 1);
    const min = Math.min(...points.map((p) => p.value), 0);
    const span = max - min || max;
    return { points, max, min, span };
  }, [snapshots]);

  if (!data) {
    return (
      <div className="h-[180px] flex items-center justify-center text-[12px] text-text-mute border border-dashed border-border rounded-[12px]">
        Brak danych do wykresu — wróć po kilku dniach.
      </div>
    );
  }

  const width = 100; // viewBox %
  const height = 100;
  const padX = 4;
  const padY = 8;

  const xStep = data.points.length > 1 ? (width - 2 * padX) / (data.points.length - 1) : 0;
  const yScale = (v: number) => {
    const t = (v - data.min) / data.span;
    return height - padY - t * (height - 2 * padY);
  };

  const path = data.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${padX + i * xStep} ${yScale(p.value)}`)
    .join(" ");

  const areaPath = `${path} L ${padX + (data.points.length - 1) * xStep} ${height - padY} L ${padX} ${height - padY} Z`;

  const latest = data.points[data.points.length - 1];
  const first = data.points[0];
  const trend = latest.value - first.value;
  const trendPct = first.value > 0 ? Math.round((trend / first.value) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-3 text-[12px] mb-3">
        <span className="text-text-mute">
          {data.points.length} {data.points.length === 1 ? "snapshot" : "snapshotów"}
        </span>
        <span className={trend >= 0 ? "text-mint" : "text-coral"}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trendPct)}% vs początek okresu
        </span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-[180px]" aria-label="Wartość magazynu w czasie">
        <defs>
          <linearGradient id="inv-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-blue)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#inv-fill)" />
        <path d={path} fill="none" stroke="var(--color-blue)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
        {data.points.map((p, i) => (
          <circle
            key={p.day}
            cx={padX + i * xStep}
            cy={yScale(p.value)}
            r="0.9"
            fill="var(--color-blue)"
          >
            <title>{p.day}: {formatPLN(p.value, { decimals: false })}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-text-mute num">
        <span>{first.day}</span>
        <span>{latest.day}</span>
      </div>
    </div>
  );
}
