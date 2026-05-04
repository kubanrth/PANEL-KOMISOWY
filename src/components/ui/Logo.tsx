import Link from "next/link";

export function Logo({ href = "/", showSuffix = true }: { href?: string; showSuffix?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-baseline gap-2 group">
      <span className="font-bold text-[22px] tracking-[-0.04em] text-text">Kickback</span>
      {showSuffix && (
        <span className="hidden sm:inline label text-text-faint">/ panel</span>
      )}
    </Link>
  );
}
