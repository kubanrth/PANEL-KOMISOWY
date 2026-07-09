import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, formatDate } from "@/lib/format";
import type { PriceChangeRequest, Product, Profile } from "@/lib/types";
import { DecideButtons } from "./DecideButtons";

export default async function AdminZmianyCenyPage() {
  const { supabase } = await requireAdmin();

  const { data: reqsRaw } = await supabase
    .from("price_change_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const reqs = (reqsRaw ?? []) as PriceChangeRequest[];

  const productIds = Array.from(new Set(reqs.map((r) => r.product_id)));
  const requesterIds = Array.from(new Set(reqs.map((r) => r.requested_by)));

  const [prodsRes, profsRes] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, brand, model, size, photos").in("id", productIds)
      : Promise.resolve({ data: [] as Array<Pick<Product, "id" | "brand" | "model" | "size" | "photos">> }),
    requesterIds.length
      ? supabase.from("profiles").select("id, first_name, last_name, company_name").in("id", requesterIds)
      : Promise.resolve({ data: [] as Array<Pick<Profile, "id" | "first_name" | "last_name" | "company_name">> }),
  ]);

  const productById = new Map((prodsRes.data ?? []).map((p) => [p.id, p]));
  const profileById = new Map((profsRes.data ?? []).map((p) => [p.id, p]));

  const pending = reqs.filter((r) => r.status === "pending");
  const resolved = reqs.filter((r) => r.status !== "pending");

  return (
    <>
      <section>
        <div className="label">{pending.length} oczekujących · {resolved.length} zdecydowanych</div>
        <h1 className="mt-3 font-display font-bold uppercase text-[18px] lg:text-[24px] leading-[1.15] tracking-[0.01em]">
          Zmiany ceny.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Sugestie cenowe od komisantów. Akceptacja propaguje listing_price_cents do produktu i
          notyfikuje klienta. Odrzucenie tylko zapisuje decyzję.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">Oczekujące</h2>
        {pending.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-8 text-center text-[14px] text-text-soft">
            Wszystko rozliczone — brak oczekujących sugestii.
          </div>
        ) : (
          <RequestsTable reqs={pending} productById={productById} profileById={profileById} showActions />
        )}
      </section>

      {resolved.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">Historia</h2>
          <RequestsTable reqs={resolved} productById={productById} profileById={profileById} />
        </section>
      )}
    </>
  );
}

function RequestsTable({
  reqs, productById, profileById, showActions = false,
}: {
  reqs: PriceChangeRequest[];
  productById: Map<string, Pick<Product, "id" | "brand" | "model" | "size" | "photos">>;
  profileById: Map<string, Pick<Profile, "id" | "first_name" | "last_name" | "company_name">>;
  showActions?: boolean;
}) {
  return (
    <div className="card table-scroll">
      <div className={`hidden md:grid gap-3 px-4 h-11 items-center label border-b border-border ${
        showActions
          ? "grid-cols-[minmax(220px,3fr)_140px_120px_120px_120px_140px_160px]"
          : "grid-cols-[minmax(220px,3fr)_140px_120px_120px_120px_140px_120px]"
      }`}>
        <div>Produkt</div>
        <div>Klient</div>
        <div>Obecna</div>
        <div>Sugerowana</div>
        <div>Status</div>
        <div>Data</div>
        <div className="text-right">Akcja</div>
      </div>
      {reqs.map((r) => {
        const p = productById.get(r.product_id);
        const requester = profileById.get(r.requested_by);
        const requesterLabel = requester
          ? `${requester.first_name ?? ""} ${requester.last_name ?? ""}`.trim() || requester.company_name || "—"
          : "—";
        const statusCls =
          r.status === "accepted" ? "pill-mint" : r.status === "rejected" ? "pill-mute" : r.status === "pending" ? "pill-amber" : "pill-mute";
        return (
          <div
            key={r.id}
            className={`grid gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0 ${
              showActions
                ? "grid-cols-[minmax(220px,3fr)_140px_120px_120px_120px_140px_160px]"
                : "grid-cols-[minmax(220px,3fr)_140px_120px_120px_120px_140px_120px]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {p && <ProductThumb photos={p.photos} brand={p.brand} size="sm" />}
              <div className="min-w-0">
                <Link href={p ? `/panel/products/${p.id}` : "#"} className="text-[13px] font-medium truncate hover:text-blue">
                  {p ? `${p.brand} · ${p.model}` : "Produkt usunięty"}
                </Link>
                {p?.size && <div className="text-[11px] text-text-mute num">{p.size}</div>}
              </div>
            </div>
            <div className="text-[12px] text-text-soft truncate">
              <Link href={`/admin/crm/${r.requested_by}`} className="hover:text-blue">{requesterLabel}</Link>
            </div>
            <div className="text-[13px] num text-text-mute line-through">
              {r.current_price_cents ? formatPLN(r.current_price_cents, { decimals: false }) : "—"}
            </div>
            <div className="text-[13px] num font-semibold text-blue">
              {formatPLN(r.suggested_price_cents, { decimals: false })}
            </div>
            <div>
              <span className={`pill ${statusCls}`}>
                {r.status === "pending" ? "Oczekuje" : r.status === "accepted" ? "Zaakceptowana" : r.status === "rejected" ? "Odrzucona" : "Anulowana"}
              </span>
            </div>
            <div className="text-[12px] num text-text-soft">{formatDate(r.created_at)}</div>
            <div className="text-right">
              {showActions && r.status === "pending" ? (
                <DecideButtons requestId={r.id} />
              ) : (
                <span className="text-[11px] text-text-faint">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
