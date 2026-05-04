import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, formatDate } from "@/lib/format";
import { createBuyerOffer } from "./actions";

type Row = {
  id: string;
  product_id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  buyer_name: string | null;
  is_seller_message: boolean;
  products: { id: string; brand: string; model: string; photos: Array<{ url: string; name: string }> | null; listing_price_cents: number | null; status: string; submission_id: string } | null;
};

export default async function AdminOffersPage() {
  const { user, profile, supabase } = await requireAdmin();

  // Latest offer per product (window function would be ideal; simple approach: order desc, dedupe in JS)
  const { data: offersRaw } = await supabase
    .from("offers")
    .select(`
      id, product_id, amount_cents, status, created_at, buyer_name, is_seller_message,
      products ( id, brand, model, photos, listing_price_cents, status, submission_id )
    `)
    .order("created_at", { ascending: false });

  type RawRow = Omit<Row, "products"> & { products?: Row["products"] | Row["products"][] | null };
  const all: Row[] = ((offersRaw ?? []) as unknown as RawRow[]).map((r) => ({
    ...r,
    products: Array.isArray(r.products) ? r.products[0] ?? null : (r.products ?? null),
  }));
  const seen = new Set<string>();
  const latest: Row[] = [];
  for (const o of all) {
    if (seen.has(o.product_id)) continue;
    seen.add(o.product_id);
    latest.push(o);
  }
  const active = latest.filter((o) => o.status === "pending" || o.status === "countered");

  // Listed products without any offer — for "make demo offer"
  const { data: listedProducts } = await supabase
    .from("products")
    .select("id, brand, model, listing_price_cents, photos")
    .eq("status", "listed")
    .limit(20);

  const listedNoOffer = (listedProducts ?? []).filter((p) => !seen.has(p.id));

  return (
    <AdminShell user={user} profile={profile} active="offers" breadcrumb={[{ label: "Offers (Zerr)" }]}>
      <section>
        <div className="label">{active.length} aktywnych negocjacji</div>
        <h1 className="mt-4 font-bold text-[40px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
          Zerr <span className="text-text-soft">/ targowanie.</span>
        </h1>
      </section>

      <section className="mt-12">
        <div className="label mb-5">Aktywne</div>
        {active.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Brak aktywnych negocjacji.
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((o) => (
              <Link
                key={o.product_id}
                href={`/admin/offers/${o.product_id}`}
                className="card p-5 grid grid-cols-12 gap-4 items-center hover:border-purple/40 transition-colors"
              >
                <div className="col-span-12 md:col-span-5 flex items-center gap-4">
                  {o.products && (
                    <ProductThumb photos={o.products.photos as never} brand={o.products.brand} size="md" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] truncate">
                      {o.products?.brand} · {o.products?.model}
                    </div>
                    <div className="text-[12px] text-text-mute mt-1 num">
                      {o.products?.submission_id ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="col-span-6 md:col-span-2 text-[13px]">
                  <div className="text-[11px] text-text-mute">Listing</div>
                  <div className="font-semibold num">{formatPLN(o.products?.listing_price_cents ?? 0, { decimals: false })}</div>
                </div>
                <div className="col-span-6 md:col-span-2 text-[13px]">
                  <div className="text-[11px] text-text-mute">Ostatnia oferta</div>
                  <div className="font-semibold num text-amber">{formatPLN(o.amount_cents, { decimals: false })}</div>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <span className="pill pill-amber">{o.status}</span>
                </div>
                <div className="col-span-6 md:col-span-1 text-right text-[12px] text-text-mute num">
                  {formatDate(o.created_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {listedNoOffer.length > 0 && (
        <section className="mt-12">
          <div className="label mb-5">Demo: stwórz ofertę kupującego (testowanie Zerr)</div>
          <p className="text-[13px] text-text-soft mb-4">
            Listed produkty bez ofert. Klik = utworzy testową ofertę 90% listing → klient zobaczy w panelu.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {listedNoOffer.slice(0, 6).map((p) => (
              <form key={p.id} action={createBuyerOffer} className="card p-4 flex items-center gap-3">
                <input type="hidden" name="product_id" value={p.id} />
                <ProductThumb photos={p.photos as never} brand={p.brand} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate">{p.brand} · {p.model}</div>
                  <div className="text-[11px] text-text-mute num">{formatPLN(p.listing_price_cents ?? 0, { decimals: false })}</div>
                </div>
                <button className="text-[12px] px-3 py-1.5 rounded-[8px] bg-amber/15 text-amber hover:bg-amber/25 transition-colors">
                  Symuluj ofertę
                </button>
              </form>
            ))}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
