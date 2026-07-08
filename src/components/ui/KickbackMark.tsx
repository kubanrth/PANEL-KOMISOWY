/**
 * Okrągły znak Kickback — do rekomendacji (Co warto dodać, Zapotrzebowanie).
 * „K" w Druk Wide na gradiencie CTA, jak ikona aplikacji.
 * ponytail: gdy powstanie dedykowany okrągły znak SVG, podmienić tylko tutaj.
 */
export function KickbackMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`rounded-full flex items-center justify-center flex-shrink-0 [background:var(--gradient-cta)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="font-display font-bold text-on-accent select-none"
        style={{ fontSize: Math.round(size * 0.42), lineHeight: 1 }}
      >
        K
      </span>
    </span>
  );
}
