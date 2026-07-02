import type { Offer, OfferStatus } from "@/lib/types";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { formatPLN, formatDateTime } from "@/lib/format";

/* Vocab statusów ofert (Design System): yellow = do decyzji, mint = zaakceptowana,
   blue = kontrowana (w toku), coral = odrzucona, mute = wygasła/wycofana. */
const STATUS_PILL: Record<OfferStatus, { variant: PillVariant; label: string }> = {
  pending: { variant: "yellow", label: "Oczekuje" },
  accepted: { variant: "mint", label: "Zaakceptowana" },
  countered: { variant: "blue", label: "Kontrowana" },
  rejected: { variant: "coral", label: "Odrzucona" },
  expired: { variant: "mute", label: "Wygasła" },
  withdrawn: { variant: "mute", label: "Wycofana" },
};

/** viewerId: id zalogowanego użytkownika — "Ty" tylko przy wiadomościach,
    które faktycznie wysłał (responded_by), bo kontry seller-side piszą
    i klient, i admin. */
export function OfferThread({ offers, viewerId }: { offers: Offer[]; viewerId?: string }) {
  if (offers.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-[20px] p-8 text-center text-[13px] text-text-soft">
        Brak ofert dla tego produktu.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-[680px]">
      {offers.map((o) => {
        const seller = o.is_seller_message;
        const pill = STATUS_PILL[o.status] ?? STATUS_PILL.pending;
        return (
          <div key={o.id} className={`flex ${seller ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-[16px] px-5 py-4 ${
              seller
                ? "bg-lime/8 border border-lime/25"
                : "card"
            }`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className={`label !text-[10px] ${seller ? "!text-lime/80" : ""}`}>
                  {seller ? (viewerId && o.responded_by === viewerId ? "Ty (kontrpropozycja)" : "Strona sprzedająca (kontrpropozycja)") : (o.buyer_name ?? "Kupujący")}
                </span>
                <span className="text-[11px] text-text-mute num">{formatDateTime(o.created_at)}</span>
              </div>
              <div className="font-light text-[24px] leading-none tracking-[-0.02em] num">
                {formatPLN(o.amount_cents, { decimals: false })}
              </div>
              {o.message && (
                <div className="mt-2.5 text-[13px] text-text-soft leading-[1.55]">{o.message}</div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Pill variant={pill.variant}>{pill.label}</Pill>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
