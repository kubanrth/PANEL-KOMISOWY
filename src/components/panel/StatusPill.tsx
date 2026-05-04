import type { SubmissionStatus, ProductStatus } from "@/lib/types";
import { SUBMISSION_STATUS_LABEL, PRODUCT_STATUS_LABEL } from "@/lib/types";

type Variant = "mint" | "blue" | "amber" | "pink" | "mute";

const SUB_VARIANT: Record<SubmissionStatus, Variant> = {
  draft: "mute",
  signed: "blue",
  in_transit: "blue",
  aqc: "mute",
  listed: "mint",
  sold: "mint",
  payout: "mint",
  withdrawn: "amber",
  returned: "pink",
};

const PROD_VARIANT: Record<ProductStatus, Variant> = {
  draft: "mute",
  aqc: "mute",
  listed: "mint",
  offer: "amber",
  sold: "mint",
  withdrawn: "amber",
  returned: "pink",
};

const VARIANT_CLS: Record<Variant, string> = {
  mint: "pill-mint",
  blue: "pill-blue",
  amber: "pill-amber",
  pink: "pill-pink",
  mute: "pill-mute",
};

const DOT_BG: Record<Variant, string> = {
  mint: "bg-mint",
  blue: "bg-blue-soft",
  amber: "bg-amber",
  pink: "bg-pink",
  mute: "bg-text-mute",
};

export function SubmissionStatusPill({ status }: { status: SubmissionStatus }) {
  const v = SUB_VARIANT[status];
  return (
    <span className={`pill ${VARIANT_CLS[v]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_BG[v]}`} />
      {SUBMISSION_STATUS_LABEL[status]}
    </span>
  );
}

export function ProductStatusPill({ status }: { status: ProductStatus }) {
  const v = PROD_VARIANT[status];
  return (
    <span className={`pill ${VARIANT_CLS[v]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_BG[v]}`} />
      {PRODUCT_STATUS_LABEL[status]}
    </span>
  );
}
