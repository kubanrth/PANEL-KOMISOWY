import Link from "next/link";

/* Dropdown filtrów (frosted glass) — natywny <details>, zero JS.
   Server-friendly: opcje to zwykłe linki z href, wybór = nawigacja,
   która resetuje details do stanu zamkniętego.
   ponytail: bez light-dismiss (klik obok nie zamyka) — JS dodać,
   gdy zacznie przeszkadzać. */

export type FilterOption = {
  key: string;
  label: string;
  count: number;
  href: string;
};

export function FilterDropdown({
  prefix, options, activeKey,
}: {
  prefix: string;
  options: FilterOption[];
  activeKey: string;
}) {
  const active = options.find((o) => o.key === activeKey) ?? options[0];
  return (
    <details className="relative inline-block group">
      <summary className="list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-medium border border-lime/40 bg-lime/10 text-lime cursor-pointer select-none transition-colors hover:bg-lime/15 active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime/60">
        {prefix}: {active.label}
        <span className="num text-lime/70">· {active.count}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-180" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      {/* Frosted glass: mocny blur + saturacja, przezroczyste tło, inset-highlight u góry */}
      <div className="absolute left-0 top-full mt-2 z-30 min-w-[280px] rounded-[22px] border border-white/10 bg-surface/35 backdrop-blur-2xl backdrop-saturate-150 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.10),0_28px_70px_-18px_rgba(0,0,0,0.75)] p-2">
        {options.map((o) => (
          <Link
            key={o.key}
            href={o.href}
            className={`flex items-center justify-between gap-6 px-3.5 h-10 rounded-[11px] text-[13px] font-medium transition-colors ${
              o.key === active.key ? "bg-lime/12 text-lime" : "text-text-soft hover:text-text hover:bg-white/8"
            }`}
          >
            {o.label}
            <span className={`num ${o.key === active.key ? "text-lime/70" : "text-text-mute"}`}>{o.count}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}
