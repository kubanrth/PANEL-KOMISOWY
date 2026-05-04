import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN } from "@/lib/format";
import { Logo } from "@/components/ui/Logo";
import { ArrowRight } from "@/components/ui/Button";
import { submitBuyerOffer } from "./actions";

export default async function PublicQrLandingPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const supabase = await createClient();

  const { data: qr } = await supabase
    .from("qr_codes")
    .select(`
      slug, scans_count, product_id,
      products ( id, brand, model, category, size, condition, description, listing_price_cents, photos, status, submission_id,
                 submissions ( commission_rate, profiles!klient_id ( first_name ) )
      )
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (!qr) notFound();

  type QrRow = {
    slug: string; scans_count: number; product_id: string;
    products: {
      id: string; brand: string; model: string; category: string | null; size: string | null;
      condition: number | null; description: string | null; listing_price_cents: number | null;
      photos: Array<{ url: string; name: string }> | null;
      status: string; submission_id: string;
      submissions: { commission_rate: number; profiles: { first_name: string | null } | null } | null;
    } | null;
  };

  type RawQr = Omit<QrRow, "products"> & {
    products?: (Omit<NonNullable<QrRow["products"]>, "submissions"> & {
      submissions?: NonNullable<QrRow["products"]>["submissions"]
                  | NonNullable<QrRow["products"]>["submissions"][]
                  | null;
    })[] | (Omit<NonNullable<QrRow["products"]>, "submissions"> & {
      submissions?: NonNullable<QrRow["products"]>["submissions"]
                  | NonNullable<QrRow["products"]>["submissions"][]
                  | null;
    }) | null;
  };
  const raw = qr as unknown as RawQr;
  const productJoin = Array.isArray(raw.products) ? raw.products[0] : raw.products;
  if (!productJoin) notFound();
  const subRaw = productJoin.submissions;
  const subData = Array.isArray(subRaw) ? subRaw[0] : subRaw;
  type ProfileObj = { first_name: string | null };
  const profilesRaw = (subData as { profiles?: ProfileObj | ProfileObj[] | null } | null)?.profiles;
  const profileSingle = Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw;
  const product = {
    ...productJoin,
    submissions: subData ? { commission_rate: subData.commission_rate, profiles: profileSingle ?? null } : null,
  };
  const data = { slug: raw.slug, scans_count: raw.scans_count, product_id: raw.product_id };

  const sellerName = product.submissions?.profiles?.first_name || "Sprzedawca";
  const isAvailable = product.status === "listed" || product.status === "offer";

  // Increment scan counter (fire-and-forget). RPC is SECURITY DEFINER so anon may call.
  try {
    await supabase.rpc("increment_qr_scan", { p_slug: slug });
  } catch {
    /* ignore */
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-soft">
        <div className="mx-auto max-w-[920px] px-6 h-[68px] flex items-center justify-between">
          <Logo />
          <span className="text-[12px] text-text-mute">Skan QR · {data.scans_count + 1}</span>
        </div>
      </header>

      <main className="flex-1 px-6 py-10 lg:py-16">
        <div className="mx-auto max-w-[920px]">
          <div className="grid grid-cols-12 gap-8 items-start">
            <div className="col-span-12 md:col-span-5">
              {product.photos && product.photos.length > 0 ? (
                <div className="aspect-square rounded-[20px] overflow-hidden border border-border bg-surface relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.photos[0].url} alt={`${product.brand} ${product.model}`} className="absolute inset-0 w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-square rounded-[20px] flex items-center justify-center border border-border bg-surface">
                  <ProductThumb photos={[]} brand={product.brand} size="lg" />
                </div>
              )}
            </div>
            <div className="col-span-12 md:col-span-7">
              <div className="flex items-center gap-3 mb-3">
                <span className="pill pill-blue">Konsygnacja Kickback</span>
                {isAvailable ? (
                  <span className="pill pill-mint">Dostępne</span>
                ) : (
                  <span className="pill pill-mute">Niedostępne</span>
                )}
              </div>
              <h1 className="font-bold text-[40px] lg:text-[52px] leading-[1.02] tracking-[-0.04em]">
                {product.brand}
              </h1>
              <p className="text-[20px] text-text-soft mt-1">{product.model}</p>

              <div className="mt-6 card p-5 space-y-2">
                {product.category && <Detail label="Kategoria" value={product.category} />}
                {product.size && <Detail label="Rozmiar" value={product.size} />}
                {product.condition && <Detail label="Stan" value={`${product.condition}/10`} />}
                <Detail label="Sprzedający" value={sellerName} />
              </div>

              {product.description && (
                <p className="mt-6 text-[14px] text-text-soft leading-[1.7] max-w-[60ch]">{product.description}</p>
              )}

              <div className="mt-8 card-gradient-blue p-6 rounded-[20px] text-white">
                <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">Cena listing</div>
                <div className="mt-2 font-bold text-4xl tracking-[-0.04em] num">
                  {formatPLN(product.listing_price_cents ?? 0, { decimals: false })}
                </div>
              </div>
            </div>
          </div>

          {isAvailable && (
            <section className="mt-10">
              <div className="card p-6 lg:p-8">
                <div className="label mb-2">Złóż ofertę (Zerr)</div>
                <h3 className="font-bold text-2xl tracking-[-0.025em]">Negocjuj cenę bezpośrednio</h3>
                <p className="mt-2 text-[14px] text-text-soft max-w-[60ch]">
                  Sprzedający dostanie powiadomienie i może zaakceptować, kontrować lub odrzucić Twoją ofertę. Bez konieczności rejestracji.
                </p>

                <form action={submitBuyerOffer} className="mt-6 grid grid-cols-12 gap-4">
                  <input type="hidden" name="product_id" value={product.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <div className="col-span-12 md:col-span-4">
                    <label className="input-label">Twoja oferta (zł)</label>
                    <input
                      name="amount"
                      type="text"
                      required
                      placeholder="0"
                      className="input"
                      defaultValue={Math.round((product.listing_price_cents ?? 0) * 0.9 / 100).toString()}
                    />
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <label className="input-label">Twoje imię (opcjonalne)</label>
                    <input name="buyer_name" type="text" className="input" placeholder="Anonim" maxLength={40} />
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <label className="input-label">E-mail kontaktowy</label>
                    <input name="email" type="email" className="input" placeholder="kuba@…" />
                  </div>
                  <div className="col-span-12">
                    <label className="input-label">Wiadomość (opcjonalna)</label>
                    <input name="message" type="text" className="input" maxLength={280} placeholder="Mogę odebrać dziś, płatność BLIK od ręki…" />
                  </div>
                  <div className="col-span-12">
                    <button className="btn-primary h-12 px-7 text-[14px] inline-flex items-center gap-3">
                      Wyślij ofertę <ArrowRight size={16} />
                    </button>
                    <span className="ml-3 text-[11px] text-text-mute">
                      Oferta ważna 24h. Sprzedający dostanie powiadomienie natychmiast.
                    </span>
                  </div>
                </form>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="border-t border-border-soft py-6 text-center text-[12px] text-text-mute">
        © Kickback sp. z o. o. · Konsygnacja
      </footer>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12px] text-text-mute">{label}</span>
      <span className="text-[13px] font-medium">{value}</span>
    </div>
  );
}
