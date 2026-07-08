/**
 * Okrągły znak klubowy Kickback („KICKBACK · EST. 2023") — używany przy
 * rekomendacjach (Co warto dodać, Zapotrzebowanie, dashboard).
 * Plik: public/brand_assets/kickback-club-icon.webp (256×256).
 */
export function KickbackMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand_assets/kickback-club-icon.webp"
      alt=""
      width={size}
      height={size}
      className={`rounded-full flex-shrink-0 select-none ${className}`}
      aria-hidden
    />
  );
}
