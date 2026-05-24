import Link from "next/link";

export function Logo({
  href = "/",
  showSuffix = true,
  className = "",
}: {
  href?: string;
  showSuffix?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={`inline-flex items-center gap-3 group ${className}`}>
      <img
        src="/brand_assets/kickback_logo.svg"
        alt="Kickback"
        className="logo-img h-5 w-auto select-none"
      />
      {showSuffix && (
        <span className="hidden sm:inline label text-text-faint">/ panel</span>
      )}
    </Link>
  );
}
