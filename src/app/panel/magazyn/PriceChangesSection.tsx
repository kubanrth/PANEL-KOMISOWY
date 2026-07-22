import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, formatDate } from "@/lib/format";
import type { PriceChangeRequest, PriceChangeStatus, Product } from "@/lib/types";
import { CancelButton } from "../zmiany-ceny/CancelButton";

/* Sugestie zmian cen — sekcja Magazynu (dawna zakładka Zmiany cen,
   scalona 2026-07-13). Zgłaszasz zmianę przyciskiem przy pozycji wyżej,
   tu śledzisz decyzje. Renderuje się tylko gdy są jakiekolwiek wnioski. */

export async function PriceChangesSection({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: reqsRaw } = await supabase
    .from("price_change_requests")
    .select("*")
    .eq("requested_by", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  const reqs = (reqsRaw ?? []) as PriceChangeRequest[];
  if (reqs.length === 0) return null;

  const productIds = Array.from(new Set(reqs.map((r) => r.product_id)));
  const { data: prodsRaw } = await supabase
    .from("products")
    .select("id, brand, model, size, photos")
    .in("id", productIds);
  const productById = new Map(
    ((prodsRaw ?? []) as Array<Pick<Product, "id" | "brand" | "model" | "size" | "photos">>).map((p) => [p.id, p]),
  );

  const pending = reqs.filter((r) => r.status === "pending").length;

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <div className="label">Zmiany cen</div>
          <h2 className="mt-2 font-light text-[22px] tracking-[-0.02em]">Twoje sugestie cen</h2>
        </div>
        <span className="text-[12px] text-text-mute num">
          {pending > 0 ? <span className="text-yellow">{pending} oczekuje · </span> : null}
          {reqs.length} łącznie
        </span>
      </div>

      <div className="card table-scroll">
        <div className="hidden md:grid grid-cols-[minmax(200px,2.5fr)_170px_minmax(150px,2fr)_140px_100px_110px] gap-3 px-4 h-11 label border-b border-border items-center">
          <div>Produkt</div>
          <div>Zmiana</div>
          <div>Powód</div>
          <div>Status</div>
          <div>Data</div>
          <div className="text-right">Akcja</div>
        </div>

        {reqs.map((r) => {
          const p = productById.get(r.product_id);
          const status = statusPill(r.status);
          const cur = r.current_price_cents;
          const tone =
            cur == null ? "" : r.suggested_price_cents < cur ? "text-coral" : r.suggested_price_cents > cur ? "text-mint" : "";
          return (
            <div
              key={r.id}
              className="grid grid-cols-1 md:grid-cols-[minmax(200px,2.5fr)_170px_minmax(150px,2fr)_140px_100px_110px] gap-x-3 gap-y-2 md:gap-y-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
            >
              {p ? (
                <Link href={`/panel/products/${p.id}`} className="flex items-center gap-3 min-w-0 hover:text-lime transition-colors">
                  <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium truncate">{p.brand} {p.model}</div>
                    {p.size && <div className="text-[11px] num text-text-mute truncate">{p.size}</div>}
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3 min-w-0 text-[13.5px] text-text-mute">
                  <ProductThumb photos={null} brand="?" size="sm" />
                  Produkt usunięty
                </div>
              )}

              <div className="text-[13px] num whitespace-nowrap">
                <span className="text-text-mute">{cur != null ? formatPLN(cur, { decimals: false }) : "—"}</span>
                <span className={`mx-1.5 ${tone || "text-text-mute"}`}>→</span>
                <span className={`font-medium ${tone}`}>{formatPLN(r.suggested_price_cents, { decimals: false })}</span>
              </div>

              <div className={`text-[12px] leading-[1.55] text-text-soft line-clamp-2 ${r.notes ? "" : "hidden md:block"}`}>
                {r.notes ?? "—"}
              </div>

              <div><Pill variant={status.variant}>{status.label}</Pill></div>

              <div className="hidden md:block text-[12px] num text-text-soft">{formatDate(r.created_at)}</div>

              <div className="flex items-center justify-between md:justify-end gap-3">
                <span className="md:hidden text-[11px] num text-text-mute">{formatDate(r.created_at)}</span>
                {r.status === "pending" && <CancelButton requestId={r.id} />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function statusPill(status: PriceChangeStatus): { variant: PillVariant; label: string } {
  switch (status) {
    case "pending":
      return { variant: "yellow", label: "Oczekuje" };
    case "accepted":
      return { variant: "mint", label: "Zaakceptowana" };
    case "rejected":
      return { variant: "coral", label: "Odrzucona" };
    case "cancelled":
      return { variant: "mute", label: "Anulowana" };
  }
}
