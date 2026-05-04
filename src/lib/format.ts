/**
 * Formatting helpers — Polish locale, PLN currency, tabular numerics.
 */

const PLN = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PLN_INT = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat("pl-PL");

export function formatPLN(cents: number | null | undefined, opts?: { decimals?: boolean }): string {
  if (cents == null) return "—";
  const zl = cents / 100;
  const useDecimals = opts?.decimals ?? zl % 1 !== 0;
  return useDecimals ? PLN.format(zl) : PLN_INT.format(zl);
}

export function formatPLNNumber(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return NUM.format(cents / 100);
}

export function parsePriceToCents(input: string | null | undefined): number | null {
  if (!input) return null;
  // Accept "2 480", "2,480.50", "2 480,50 zł", "2 480.50 PLN" etc.
  const cleaned = String(input).replace(/[^\d,.\-]/g, "").replace(/\s/g, "");
  // If both . and , present, assume , is decimal separator (Polish)
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Both → assume thousands . and decimal ,
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    // Only , → it's decimal sep
    normalized = cleaned.replace(",", ".");
  }
  const num = parseFloat(normalized);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

const DATE = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const DATETIME = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return DATE.format(date);
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return DATETIME.format(date);
}

/** Days between now and date (positive = future, negative = past). */
export function daysFromNow(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - Date.now()) / 86_400_000);
}

/** Compute take-home (klient share) = price * (1 - commission). */
export function takeHomeCents(priceCents: number | null | undefined, commissionRate: number): number | null {
  if (priceCents == null) return null;
  return Math.round(priceCents * (1 - commissionRate));
}

/** Compute commission (Kickback share) = price * commission. */
export function commissionCents(priceCents: number | null | undefined, commissionRate: number): number | null {
  if (priceCents == null) return null;
  return Math.round(priceCents * commissionRate);
}
