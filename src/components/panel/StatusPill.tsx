import type { SubmissionStatus, ProductStatus } from "@/lib/types";
import { SUBMISSION_STATUS_LABEL, PRODUCT_STATUS_LABEL } from "@/lib/types";

/* Vocab statusów (Design System): ten sam kolor = to samo znaczenie wszędzie.
   lime = aktywne/w sprzedaży · mint = sprzedane/wypłacone · blue = w toku/A&QC
   yellow = oczekuje/do decyzji · coral = odrzucone/zwrot · mute = draft/archiwum */
export type PillVariant = "lime" | "mint" | "blue" | "yellow" | "coral" | "amber" | "mute";

const SUB_VARIANT: Record<SubmissionStatus, PillVariant> = {
  draft: "mute",
  signed: "blue",
  in_transit: "blue",
  aqc: "blue",
  listed: "lime",
  sold: "mint",
  payout: "mint",
  withdrawn: "mute",
  returned: "coral",
};

const PROD_VARIANT: Record<ProductStatus, PillVariant> = {
  draft: "mute",
  aqc: "blue",
  listed: "lime",
  offer: "yellow",
  sold: "mint",
  withdrawn: "mute",
  returned: "coral",
};

const VARIANT_CLS: Record<PillVariant, string> = {
  lime: "pill-lime",
  mint: "pill-mint",
  blue: "pill-blue",
  yellow: "pill-yellow",
  coral: "pill-coral",
  amber: "pill-amber",
  mute: "pill-mute",
};

const DOT_BG: Record<PillVariant, string> = {
  lime: "bg-lime",
  mint: "bg-mint",
  blue: "bg-blue-soft",
  yellow: "bg-yellow",
  coral: "bg-coral",
  amber: "bg-amber",
  mute: "bg-text-mute",
};

/** Generyczna pigułka vocabu — do statusów spoza enumów (wypłaty, webhooki itd.). */
export function Pill({ variant, children }: { variant: PillVariant; children: React.ReactNode }) {
  return (
    <span className={`pill ${VARIANT_CLS[variant]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_BG[variant]}`} />
      {children}
    </span>
  );
}

export function SubmissionStatusPill({ status }: { status: SubmissionStatus }) {
  return <Pill variant={SUB_VARIANT[status]}>{SUBMISSION_STATUS_LABEL[status]}</Pill>;
}

export function ProductStatusPill({ status }: { status: ProductStatus }) {
  return <Pill variant={PROD_VARIANT[status]}>{PRODUCT_STATUS_LABEL[status]}</Pill>;
}
