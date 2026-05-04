import type { Offer } from "@/lib/types";
import { formatPLN, formatDateTime } from "@/lib/format";

export function OfferThread({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) {
    return (
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
        Brak ofert dla tego produktu.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[680px]">
      {offers.map((o) => {
        const seller = o.is_seller_message;
        return (
          <div key={o.id} className={`flex ${seller ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-[16px] px-5 py-4 ${
              seller
                ? "bg-blue/15 border border-blue/30"
                : "bg-surface border border-border"
            }`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${seller ? "text-blue-soft" : "text-text-mute"}`}>
                  {seller ? "Sprzedający (admin)" : (o.buyer_name ?? "Kupujący")}
                </span>
                <span className="text-[11px] text-text-mute num">{formatDateTime(o.created_at)}</span>
              </div>
              <div className="font-bold text-2xl tracking-[-0.025em] num">
                {formatPLN(o.amount_cents, { decimals: false })}
              </div>
              {o.message && (
                <div className="mt-2 text-[13px] text-text-soft leading-[1.5]">{o.message}</div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <span className={`pill ${
                  o.status === "accepted" ? "pill-mint" :
                  o.status === "rejected" ? "pill-pink" :
                  o.status === "countered" ? "pill-blue" :
                  o.status === "expired" ? "pill-mute" :
                  "pill-amber"
                }`}>
                  {o.status}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
