import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { OfferThread } from "@/components/offers/OfferThread";
import { OfferComposer } from "@/components/offers/OfferComposer";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, daysFromNow } from "@/lib/format";
import type { Offer, Product } from "@/lib/types";
import { acceptOffer, rejectOffer, sellerCounterOffer } from "../actions";

/* Kontr-oferta — redesign: split 50/50 (Twoja propozycja przekreślona /
   kontr-oferta na gradiencie lime→mint), countdown ważności, 2 CTA.
   Akcje acceptOffer/rejectOffer/sellerCounterOffer bez zmian. */

export default async function ClientOfferThreadPage(props: { params: Promise<{ productId: string }> }) {
  const { productId } = await props.params;
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
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

  const listingCents = subData.listing_price_cents ?? 0;
  const daysLeft = lastBuyer ? daysFromNow(lastBuyer.expires_at) : null;

  return (
    <>
      <section className="flex items-start gap-5">
        <div className="hidden sm:block flex-shrink-0">
          <ProductThumb photos={subData.photos} brand={subData.brand} size="lg" />
        </div>
        <PageHeader
          label={subData.sku ?? "Negocjacja ceny"}
          title={`${subData.brand} ${subData.model}`}
          sub="Otrzymaliśmy propozycję zakupu. Zdecyduj: zaakceptuj kontr-ofertę albo zaproponuj inną cenę."
        />
      </section>

      {lastBuyer ? (
        <>
          {/* Split 50/50 — decyzja */}
          <section className="mt-8 grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-6">
              <div className="card p-7 h-full">
                <div className="label">Twoja propozycja</div>
                <div className="mt-3 font-light text-[34px] lg:text-[42px] leading-none tracking-[-0.02em] num line-through text-text-mute">
                  {formatPLN(listingCents, { decimals: false })}
                </div>
                <p className="mt-4 text-[13px] leading-[1.6] text-text-soft">
                  Aktualna cena listingu. Rynek zareagował ofertą poniżej — po prawej nasza
                  rekomendowana kontr-oferta.
                </p>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-6">
              {/* card-gradient-purple = var(--gradient-cta): linear-gradient(135deg,#6ECC1F,#22DD99), tekst #05140B */}
              <div className="card-gradient-purple p-7 h-full">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-accent/70">
                  Nasza kontr-oferta
                </div>
                <div className="mt-3 font-medium text-[38px] lg:text-[48px] leading-none tracking-[-0.02em] num">
                  {formatPLN(lastBuyer.amount_cents, { decimals: false })}
                </div>
                <p className="mt-4 text-[13px] leading-[1.6] text-on-accent/80">
                  {lastBuyer.message?.trim() ||
                    "Kwota oparta o aktualne transakcje porównywalnych egzemplarzy — realna do zamknięcia sprzedaży teraz."}
                </p>
              </div>
            </div>
          </section>

          {/* Countdown + CTA */}
          <section className="mt-6">
            {daysLeft != null && daysLeft >= 0 && (
              <p className="text-[13px] text-text-soft">
                Oferta ważna jeszcze{" "}
                <span className="num font-medium text-yellow">
                  {daysLeft === 0 ? "mniej niż 1 dzień" : daysLeft === 1 ? "1 dzień" : `${daysLeft} dni`}
                </span>
                .
              </p>
            )}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <form action={acceptOffer}>
                <input type="hidden" name="offer_id" value={lastBuyer.id} />
                <button className="btn-primary h-12 px-7 text-[14px] inline-flex items-center gap-2">
                  Akceptuję {formatPLN(lastBuyer.amount_cents, { decimals: false })}
                </button>
              </form>
              <a href="#kontr" className="btn-ghost h-12 px-7 text-[14px] inline-flex items-center">
                Proponuję inną cenę
              </a>
            </div>
            <p className="mt-3 text-[12px] text-text-mute">
              Po akceptacji produkt zostaje sprzedany — środki trafią do Wallet po 14 dniach karencji.
            </p>
          </section>

          {/* Kontrpropozycja */}
          <section id="kontr" className="mt-8 scroll-mt-24">
            <div className="card p-6 lg:p-7">
              <div className="label mb-4">Zaproponuj inną cenę</div>
              <OfferComposer
                productId={productId}
                action={sellerCounterOffer}
                actionName="sellerCounterOffer"
                currentPriceCents={listingCents}
                buyerOfferCents={lastBuyer.amount_cents}
              />
            </div>
            <form action={rejectOffer} className="mt-4">
              <input type="hidden" name="offer_id" value={lastBuyer.id} />
              <button className="text-[12px] text-coral hover:underline">Odrzuć ofertę</button>
            </form>
          </section>
        </>
      ) : (
        <section className="mt-8">
          <EmptyState
            title="Brak ofert do decyzji"
            sub={
              offers.length > 0
                ? "Żadna oferta nie czeka na Twoją odpowiedź. Historia negocjacji poniżej."
                : "Gdy pojawi się propozycja zakupu tego produktu, zobaczysz ją tutaj."
            }
          />
        </section>
      )}

      {/* Historia negocjacji */}
      {offers.length > 0 && (
        <section className="mt-10">
          <div className="label mb-4">Historia negocjacji</div>
          <OfferThread offers={offers} viewerId={user.id} />
        </section>
      )}
    </>
  );
}
