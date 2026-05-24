import type { Product, DerivedStatus, SubmissionStatus } from "@/lib/types";

/**
 * Maps the raw 7-value product status (plus optional submission context) into
 * the 5-value "operational" status the client sees in Magazyn:
 *
 *   draft + submission in_transit  → w_trakcie_dostawy
 *   draft + submission aqc/listed  → przyjeto
 *   aqc                            → zdjecia (admin is in the middle of A&QC)
 *   aqc with recommended price     → oczekuje_publikacji (admin done but not listed)
 *   listed | offer                 → aktywny
 *
 * Falls back to "przyjeto" for anything unusual so we never crash UI.
 */
export function deriveStatus(
  product: Pick<Product, "status">,
  submissionStatus?: SubmissionStatus | string,
  hasRecommendedPrice = false,
): DerivedStatus {
  if (product.status === "listed" || product.status === "offer") return "aktywny";
  if (product.status === "aqc") {
    return hasRecommendedPrice ? "oczekuje_publikacji" : "zdjecia";
  }
  if (product.status === "draft") {
    if (submissionStatus === "in_transit" || submissionStatus === "signed") {
      return "w_trakcie_dostawy";
    }
    return "przyjeto";
  }
  // sold / withdrawn / returned aren't "in stock" so callers should filter
  // those out; we fall through for safety.
  return "przyjeto";
}

/** Pill variant per derived status (consumed by the StatusPill render). */
export const DERIVED_STATUS_VARIANT: Record<DerivedStatus, "blue" | "mint" | "amber" | "mute"> = {
  w_trakcie_dostawy: "blue",
  przyjeto: "mute",
  zdjecia: "amber",
  oczekuje_publikacji: "amber",
  aktywny: "mint",
};
