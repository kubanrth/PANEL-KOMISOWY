import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
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
    <AdminShell user={user} profile={profile} active="qr" breadcrumb={[{ label: "Generator QR" }]}>
      <section>
        <div className="label">{products.length} produktów listed</div>
        <h1 className="mt-4 font-bold text-[28px] lg:text-[36px] leading-[1.02] tracking-[-0.04em]">
          Generator QR <span className="text-text-soft">/ metki.</span>
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          QR na metce produktu. Kupujący skanuje → otwiera /q/[slug] → może złożyć ofertę (Zerr) bezpośrednio.
        </p>
      </section>

      <section className="mt-12">
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
                    <div className="font-bold text-lg num">{qr?.scans_count ?? 0}</div>
                  </div>
                  <div className="col-span-3 md:col-span-2 text-right">
                    {qr ? (
                      <Link
                        href={`/admin/qr/${p.id}`}
                        className="text-[12px] px-3 py-2 rounded-[8px] bg-purple/15 text-purple hover:bg-purple/25 transition-colors inline-block"
                      >
                        Otwórz QR
                      </Link>
                    ) : (
                      <form action={generateQrForProduct}>
                        <input type="hidden" name="product_id" value={p.id} />
                        <button className="text-[12px] px-3 py-2 rounded-[8px] bg-blue/15 text-blue-soft hover:bg-blue/25 transition-colors w-full">
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
    </AdminShell>
  );
}
