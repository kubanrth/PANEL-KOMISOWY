import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, formatDateTime } from "@/lib/format";
import QRCode from "qrcode";

export default async function AdminQrDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { user, profile, supabase } = await requireAdmin();

  const { data: product } = await supabase
    .from("products")
    .select(`
      id, brand, model, sku, listing_price_cents, photos, condition, status,
      qr_codes ( slug, scans_count, last_scanned_at, created_at )
    `)
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  type Row = {
    id: string; brand: string; model: string; sku: string; listing_price_cents: number | null;
    photos: Array<{ url: string; name: string }> | null; condition: number | null; status: string;
    qr_codes: Array<{ slug: string; scans_count: number; last_scanned_at: string | null; created_at: string }> | null;
  };
  const p = product as Row;
  const qr = p.qr_codes?.[0];
  if (!qr) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://panel-komisowy.vercel.app";
  const url = `${baseUrl}/q/${qr.slug}`;

  // Generate QR as data URL (server-side, for SSR-clean output)
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 480,
    margin: 1,
    color: { dark: "#0A0B10", light: "#FFFFFF" },
  });

  return (
    <>
      <section className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-12 lg:col-span-7">
          <div className="flex items-center gap-3 mb-3">
            <span className="pill pill-blue">stan {p.condition ?? "?"}/10</span>
            <span className="pill pill-mute">{p.status}</span>
          </div>
          <h1 className="font-light text-[26px] lg:text-[36px] leading-[1.05] tracking-[-0.02em]">
            {p.brand} <span className="text-text-soft">·</span> {p.model}
          </h1>
          <div className="mt-2 text-[12px] num text-text-mute">SKU: {p.sku}</div>

          <div className="mt-8 card p-6">
            <div className="label mb-3">Statystyki QR</div>
            <div className="grid grid-cols-3 gap-5">
              <div>
                <div className="text-[11px] text-text-mute">Skanowań</div>
                <div className="font-light text-3xl tracking-[-0.02em] num">{qr.scans_count}</div>
              </div>
              <div>
                <div className="text-[11px] text-text-mute">Ostatni skan</div>
                <div className="text-[14px] mt-1.5">
                  {qr.last_scanned_at ? formatDateTime(qr.last_scanned_at) : <span className="text-text-faint">brak</span>}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-text-mute">Wygenerowano</div>
                <div className="text-[14px] mt-1.5">{formatDateTime(qr.created_at)}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 card p-6">
            <div className="label mb-3">URL skanu</div>
            <div className="font-mono text-[14px] break-all bg-surface-2 rounded-[8px] px-4 py-3">{url}</div>
            <p className="mt-3 text-[12px] text-text-mute">
              Kupujący skanuje QR telefonem → otwiera publiczną stronę produktu → może złożyć ofertę (Zerr).
            </p>
          </div>
        </div>

        {/* QR card — printable */}
        <div className="col-span-12 lg:col-span-5">
          <div className="card p-6">
            <div className="label mb-4">Etykieta drukowalna</div>
            <div id="qr-print" className="bg-white rounded-[16px] p-7 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`QR ${p.brand} ${p.model}`} className="mx-auto w-[260px] h-[260px]" />
              <div className="mt-4 pt-4 border-t border-black/15">
                <div className="text-[10px] uppercase tracking-[0.2em] text-black/60">Kickback · Zerr</div>
                <div className="font-bold text-[20px] tracking-[-0.025em] text-black mt-1.5">
                  {p.brand}
                </div>
                <div className="text-[14px] text-black/80">{p.model}</div>
                <div className="font-bold text-2xl tracking-[-0.04em] num text-black mt-3">
                  {formatPLN(p.listing_price_cents ?? 0, { decimals: false })}
                </div>
                <div className="text-[10px] text-black/50 mt-2 font-mono">{qr.slug}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary h-10 px-4 text-[12px] inline-flex items-center gap-2"
                data-print-qr
              >
                Drukuj
              </button>
              <a
                href={qrDataUrl}
                download={`qr-${qr.slug}.png`}
                className="h-10 px-4 text-[12px] inline-flex items-center gap-2 rounded-[10px] bg-surface-2 border border-border hover:border-blue transition-colors"
              >
                Pobierz PNG
              </a>
            </div>
          </div>
        </div>
      </section>

      <PrintScript />
    </>
  );
}

function PrintScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          document.querySelectorAll('[data-print-qr]').forEach(el => {
            el.addEventListener('click', () => window.print());
          });
        `,
      }}
    />
  );
}
