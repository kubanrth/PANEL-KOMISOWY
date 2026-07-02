/**
 * KPI card wg Design Systemu: uppercase label → duża liczba (mono przy kwotach)
 * → opcjonalna delta-pill i sparkline (children).
 */
export function KpiCard({
  label,
  value,
  mono = false,
  delta,
  deltaTone = "mint",
  sub,
  children,
  alert = false,
}: {
  label: string;
  value: React.ReactNode;
  /** kwoty/liczby → IBM Plex Mono (klasa .num) */
  mono?: boolean;
  delta?: string;
  deltaTone?: "mint" | "coral" | "mute";
  sub?: string;
  /** slot na sparkline / dodatkową zawartość na dole karty */
  children?: React.ReactNode;
  /** coral ring dla wartości krytycznych (kolejka admina > progu) */
  alert?: boolean;
}) {
  const deltaCls =
    deltaTone === "mint" ? "pill-mint" : deltaTone === "coral" ? "pill-coral" : "pill-mute";
  return (
    <div className={`card p-5 ${alert ? "ring-1 ring-coral/40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="label">{label}</div>
        {delta && <span className={`pill ${deltaCls} !text-[10px] !px-2`}>{delta}</span>}
      </div>
      <div className={`mt-3 text-[28px] lg:text-[32px] font-light leading-none tracking-[-0.02em] ${mono ? "num" : ""}`}>
        {value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-text-mute">{sub}</div>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** Minimalistyczny sparkline SVG — jedna linia lime, bez osi (KPI cards). */
export function Sparkline({ points, className = "" }: { points: number[]; className?: string }) {
  if (points.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - 3 - ((p - min) / span) * (h - 6);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full h-8 ${className}`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="var(--color-lime)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
