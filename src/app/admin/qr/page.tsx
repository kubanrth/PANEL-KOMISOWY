import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN } from "@/lib/format";
import { generateQrForProduct } from "./actions";

export default async function AdminQrListPage() {
  const { user, profile, supabase } = await requireAdmin();

  const { data: listed } = await supabase
    .from("products")
    .select(`
      id, brand, model, listing_price_cents, photos,
      qr_codes ( slug, scans_count )
    `)
    .in("status", ["listed", "offer"])
    .order("updated_at", { ascending: false })
    .limit(50);

  type Row = {
    id: string;
    brand: string;
    model: string;
    listing_price_cents: number | null;
    photos: Array<{ url: string; name: string }> | null;
    qr_codes: Array<{ slug: string; scans_count: number }> | null;
  };

  const products = (listed ?? []) as Row[];

  return (
    <>
      <PageHeader
        label={`${products.length} produktów listed`}
        title="Generator QR"
        sub="QR na metce produktu. Kupujący skanuje → otwiera /q/[slug] → może złożyć ofertę (Zerr) bezpośrednio."
      />

      <section className="mt-8">
        {products.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Brak produktów w sprzedaży. Dodaj A&QC PASS żeby generować QR.
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((p) => {
              const qr = p.qr_codes?.[0];
              return (
                <div key={p.id} className="card p-5 grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-12 md:col-span-5 flex items-center gap-4">
                    <ProductThumb photos={p.photos as never} brand={p.brand} size="md" />
                    <div className="min-w-0">
                      <div className="font-semibold text-[15px] truncate">{p.brand} · {p.model}</div>
                      <div className="text-[12px] text-text-mute mt-1 num">
                        {formatPLN(p.listing_price_cents ?? 0, { decimals: false })}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    {qr ? (
                      <div>
                        <div className="text-[11px] text-text-mute">Slug</div>
                        <div className="font-mono text-[12px]">/q/{qr.slug}</div>
                      </div>
                    ) : (
                      <div className="text-[12px] text-text-mute">Brak QR</div>
                    )}
                  </div>
                  <div className="col-span-3 md:col-span-2 text-center">
                    <div className="text-[11px] text-text-mute">Skanowań</div>
                    <div className="font-medium text-lg num">{qr?.scans_count ?? 0}</div>
                  </div>
                  <div className="col-span-3 md:col-span-2 text-right">
                    {qr ? (
                      <Link
                        href={`/admin/qr/${p.id}`}
                        className="text-[12px] px-3 py-2 rounded-[8px] bg-lime/12 text-lime hover:bg-lime/20 transition-colors inline-block"
                      >
                        Otwórz QR
                      </Link>
                    ) : (
                      <form action={generateQrForProduct}>
                        <input type="hidden" name="product_id" value={p.id} />
                        <button className="text-[12px] px-3 py-2 rounded-[8px] bg-surface-2 border border-border text-text-soft hover:text-text hover:bg-surface-3 transition-colors w-full">
                          Generuj
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
