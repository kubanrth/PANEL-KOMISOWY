import type { Photo } from "@/lib/types";

const SIZE_PX: Record<NonNullable<ProductThumbProps["size"]>, number> = {
  sm: 40,
  md: 56,
  lg: 96,
};

const SIZE_RADIUS: Record<NonNullable<ProductThumbProps["size"]>, string> = {
  sm: "rounded-[10px]",
  md: "rounded-[12px]",
  lg: "rounded-[16px]",
};

const SIZE_TYPO: Record<NonNullable<ProductThumbProps["size"]>, string> = {
  sm: "text-[14px]",
  md: "text-lg",
  lg: "text-2xl",
};

type ProductThumbProps = {
  photos: Photo[] | null | undefined;
  brand: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Product thumbnail: shows the first photo if any, otherwise a gradient
 * placeholder with the brand's initials. Hash of brand → stable color.
 */
export function ProductThumb({ photos, brand, size = "md", className = "" }: ProductThumbProps) {
  const px = SIZE_PX[size];
  const photo = photos?.[0];
  const cls = `relative flex-shrink-0 overflow-hidden ${SIZE_RADIUS[size]} ${className}`;

  if (photo) {
    return (
      <span className={cls} style={{ width: px, height: px }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={brand} className="absolute inset-0 w-full h-full object-cover" />
      </span>
    );
  }

  const initials = brand
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("") || "??";

  const gradient = brandGradient(brand);

  return (
    <span
      className={`${cls} flex items-center justify-center font-semibold text-white/85 ${SIZE_TYPO[size]}`}
      style={{
        width: px,
        height: px,
        background: gradient,
      }}
    >
      {initials}
    </span>
  );
}

/** Deterministic gradient palette per brand string. */
function brandGradient(brand: string): string {
  const palettes: Array<[string, string]> = [
    ["#0066FF", "#9358FF"],
    ["#9358FF", "#FF3D71"],
    ["#FF3D71", "#FF8A3D"],
    ["#FF8A3D", "#00D29F"],
    ["#00D29F", "#0066FF"],
    ["#3F4661", "#1F2638"],
    ["#605342", "#3D3328"],
    ["#5A6B85", "#2D3848"],
  ];
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = (hash * 31 + brand.charCodeAt(i)) | 0;
  const [a, b] = palettes[Math.abs(hash) % palettes.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
