import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { OfferThread } from "@/components/offers/OfferThread";
import { OfferComposer } from "@/components/offers/OfferComposer";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN } from "@/lib/format";
import type { Offer, Product } from "@/lib/types";
import { acceptOffer, rejectOffer, sellerCounterOffer } from "../actions";

export default async function ClientOfferThreadPage(props: { params: Promise<{ productId: string }> }) {
  const { productId } = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: product } = await supabase
    .from("products")
    .select("*, submissions ( id, klient_id, commission_rate )")
    .eq("id", productId)
    .maybeSingle();
  if (!product) notFound();

  const subData = product as Product & { submissions?: { id: string; klient_id: string; commission_rate: number } };
  if (subData.submissions?.klient_id !== user.id) redirect("/panel");

  const { data: offersRaw } = await supabase
    .from("offers")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });

  const offers = (offersRaw ?? []) as Offer[];
  const lastBuyer = [...offers].reverse().find((o) => !o.is_seller_message && o.status === "pending");

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="my-sales"
      breadcrumb={[
        { label: "Sprzedaże", href: "/panel/sprzedaze" },
        { label: subData.brand + " · " + subData.model, href: `/panel/products/${productId}` },
        { label: "Oferty" },
      ]}
    >
      <section className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-7 flex items-center gap-5">
          <ProductThumb photos={subData.photos} brand={subData.brand} size="lg" />
          <div>
            <h1 className="font-bold text-[26px] tracking-[-0.03em]">{subData.brand}</h1>
            <p className="text-text-soft text-[16px]">{subData.model}</p>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-5">
          <div className="card-gradient-blue p-6 rounded-[20px] text-white">
            <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Twój listing</div>
            <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">{formatPLN(subData.listing_price_cents ?? 0, { decimals: false })}</div>
            {lastBuyer && (
              <>
                <div className="mt-4 text-white/70 text-[11px]">Oferta kupującego</div>
                <div className="font-semibold text-xl mt-0.5 num">{formatPLN(lastBuyer.amount_cents, { decimals: false })}</div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <OfferThread offers={offers} />
      </section>

      {lastBuyer && (
        <section className="mt-8 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-6">
            <div className="card p-6">
              <div className="label mb-3">Akceptuj ofertę</div>
              <p className="text-[13px] text-text-soft mb-4">
                Po akceptacji {formatPLN(lastBuyer.amount_cents, { decimals: false })} produkt zostanie sprzedany. Środki w Wallet po 14d karencji.
              </p>
              <form action={acceptOffer}>
                <input type="hidden" name="offer_id" value={lastBuyer.id} />
                <button className="btn-primary h-11 px-5 text-[13px] inline-flex items-center gap-2 bg-mint text-bg hover:bg-mint">
                  Akceptuj {formatPLN(lastBuyer.amount_cents, { decimals: false })}
                </button>
              </form>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-6">
            <div className="card p-6">
              <div className="label mb-3">Kontruj</div>
              <OfferComposer
                productId={productId}
                action={sellerCounterOffer}
                actionName="sellerCounterOffer"
                currentPriceCents={subData.listing_price_cents ?? 0}
                buyerOfferCents={lastBuyer.amount_cents}
              />
            </div>
          </div>
          <div className="col-span-12">
            <form action={rejectOffer}>
              <input type="hidden" name="offer_id" value={lastBuyer.id} />
              <button className="text-[12px] text-coral hover:underline">Odrzuć ofertę</button>
            </form>
          </div>
        </section>
      )}

      {!lastBuyer && offers.length > 0 && (
        <section className="mt-8">
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-6 text-center text-text-soft">
            Brak ofert oczekujących na Twoją odpowiedź.
          </div>
        </section>
      )}
    </PanelShell>
  );
}
