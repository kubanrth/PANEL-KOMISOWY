import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { OfferThread } from "@/components/offers/OfferThread";
import { OfferComposer } from "@/components/offers/OfferComposer";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN } from "@/lib/format";
import type { Offer, Product } from "@/lib/types";
import { adminCounterOffer } from "../actions";

export default async function AdminOfferThreadPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { user, profile, supabase } = await requireAdmin();

  const { data: product } = await supabase
    .from("products")
    .select("*, submissions ( id, klient_id, profiles!klient_id ( first_name, last_name ) )")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const { data: offersRaw } = await supabase
    .from("offers")
    .select("*")
    .eq("product_id", id)
    .order("created_at", { ascending: true });

  const offers = (offersRaw ?? []) as Offer[];
  const klientName = [
    (product as { submissions?: { profiles?: { first_name: string | null; last_name: string | null } } }).submissions?.profiles?.first_name,
    (product as { submissions?: { profiles?: { first_name: string | null; last_name: string | null } } }).submissions?.profiles?.last_name,
  ].filter(Boolean).join(" ") || "—";

  const productData = product as Product & { submissions?: { id: string } };
  const lastBuyerOffer = [...offers].reverse().find((o) => !o.is_seller_message);

  return (
    <>
      <section className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-7 flex items-center gap-5">
          <ProductThumb photos={productData.photos} brand={productData.brand} size="lg" />
          <div>
            <div className="text-text-mute text-[12px] num">{productData.submissions?.id ?? "—"} · klient: {klientName}</div>
            <h1 className="font-display font-bold uppercase text-[18px] lg:text-[24px] leading-[1.15] tracking-[0.01em] mt-1">{productData.brand}</h1>
            <p className="text-text-soft text-[16px]">{productData.model}</p>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="card-gradient-blue p-6 rounded-[20px] text-white">
            <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Listing</div>
            <div className="mt-2 font-light text-3xl tracking-[-0.02em] num">{formatPLN(productData.listing_price_cents ?? 0, { decimals: false })}</div>
            {lastBuyerOffer && (
              <>
                <div className="mt-4 text-white/70 text-[11px]">Ostatnia oferta kupującego</div>
                <div className="font-semibold text-xl mt-0.5 num">{formatPLN(lastBuyerOffer.amount_cents, { decimals: false })}</div>
                <div className="mt-1 text-white/60 text-[11px]">
                  {Math.round((lastBuyerOffer.amount_cents / (productData.listing_price_cents || 1)) * 100)}% listingu
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <OfferThread offers={offers} viewerId={user.id} />
      </section>

      <section className="mt-8">
        <div className="card p-6">
          <div className="label mb-4">Kontroferta w imieniu klienta</div>
          <OfferComposer
            productId={productData.id}
            actionName="adminCounterOffer"
            action={adminCounterOffer}
            currentPriceCents={productData.listing_price_cents ?? 0}
            buyerOfferCents={lastBuyerOffer?.amount_cents ?? null}
          />
        </div>
      </section>
    </>
  );
}
