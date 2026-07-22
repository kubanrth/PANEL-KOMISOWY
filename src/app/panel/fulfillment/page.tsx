import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { formatPLN, formatDate } from "@/lib/format";
import type { Product } from "@/lib/types";
import { FulfillmentRequestForm, type FulfillmentProduct } from "./FulfillmentRequestForm";

// Statusy produktów dostępnych do zlecenia wysyłki z magazynu.
// Tylko „w sprzedaży" i z packshotem — decyzja 2026-07-13 (intuicyjny wybór po zdjęciach).
const SHIPPABLE = ["listed"] as const;

export default async function FulfillmentPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  // (a) Produkty klienta w magazynie do wyboru (RLS zawęża do klienta,
  // jak w magazyn/page.tsx).
  const { data: productsRaw } = await supabase
    .from("products")
    .select("id, brand, model, size, sku, listing_price_cents, expected_price_cents, photos, status")
    .in("status", [...SHIPPABLE])
    .not("photos", "is", null)
    .neq("photos", "[]")
    .order("created_at", { ascending: false });

  const products: FulfillmentProduct[] = (
    (productsRaw ?? []) as Array<
      Pick<Product, "id" | "brand" | "model" | "size" | "sku" | "listing_price_cents" | "expected_price_cents" | "photos" | "status">
    >
  ).map((p) => ({
    id: p.id,
    brand: p.brand,
    model: p.model,
    size: p.size,
    sku: p.sku,
    price_cents: p.listing_price_cents ?? p.expected_price_cents ?? 0,
    photo_url: (p.photos as { url?: string }[] | null)?.[0]?.url ?? null,
    status: p.status,
  }));

  // (b) + (c) Zlecenia fulfillment — defensywnie: tabela może nie istnieć na
  // starych env (migracja 010) — pokaż baner zamiast crasha.
  const ordersQuery = await supabase
    .from("fulfillment_orders")
    .select("id, product_id, buyer_name, recipient_name, recipient_city, tracking_number, carrier, shipping_cost_cents, status, request_type, created_at, shipped_at, delivered_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const tableMissing = ordersQuery.error?.code === "42P01"; // relation does not exist
  const orders = (ordersQuery.data ?? []) as unknown as OrderRow[];

  // Otwarte zlecenia → produkty już zlecone (disabled + pigułka „Zlecone").
  const busyIds = Array.from(
    new Set(
      orders
        .filter((o) => o.status === "pending" || o.status === "shipped")
        .map((o) => o.product_id)
        .filter((id): id is string => id != null),
    ),
  );

  const latest = orders[0] ?? null;

  return (
    <>
      {tableMissing && (
        <div className="mb-6 rounded-[14px] bg-yellow/8 border border-yellow/25 p-4 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow mt-0.5 flex-shrink-0" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <div className="text-[12px]">
            <div className="font-medium text-yellow">Tabela fulfillment_orders nie istnieje</div>
            <p className="mt-1 text-text-soft">
              Uruchom migrację{" "}
              <span className="num">supabase/migrations/20260523_010_domain_and_demand.sql</span>{" "}
              w Supabase SQL Editor. Po wykonaniu reszta strony zacznie działać.
            </p>
          </div>
        </div>
      )}

      <PageHeader
        label="Model fulfillmentowy"
        title="Fulfillment"
        sub="Zleć wysyłkę towaru z magazynu Kickback — prześlij własny list przewozowy albo podaj dane, a my wygenerujemy etykietę."
      />

      {/* Zlecanie wysyłki */}
      <section className="mt-8">
        {products.length === 0 ? (
          <EmptyState
            title="Brak produktów do wysyłki"
            sub="Pokazujemy tylko pozycje w sprzedaży z wgranymi packshotami. Gdy Twoje produkty zostaną wystawione i sfotografowane, zlecisz stąd ich wysyłkę — własną etykietą albo wygenerowaną przez nas."
            action={
              <ButtonLink href="/start" size="md">
                Nowa oferta <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        ) : (
          <FulfillmentRequestForm products={products} busyIds={busyIds} />
        )}
      </section>

      {/* Hero tracker — ostatnia wysyłka */}
      {latest && (
        <section className="mt-10">
          <div className="card p-6">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="label">Ostatnia wysyłka</div>
              <div className="text-[11px] num text-text-mute">
                {formatDate(latest.shipped_at ?? latest.created_at)}
              </div>
            </div>

            <div className="mt-5">
              <Tracker activeIdx={stepIndex(latest.status)} />
            </div>

            {/* Karta szczegółów */}
            <div className="mt-6 pt-5 border-t border-border-soft grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Detail label="Odbiorca" value={recipientOf(latest)} />
              <Detail label="Kurier" value={latest.carrier ?? "—"} />
              <Detail label="Tracking" value={latest.tracking_number ?? "—"} num />
              <Detail
                label="Koszt wysyłki"
                value={latest.shipping_cost_cents != null ? formatPLN(latest.shipping_cost_cents, { decimals: false }) : "—"}
                num
              />
            </div>
          </div>
        </section>
      )}

      {/* Historia — Twoje wysyłki */}
      <section className="mt-10">
        <div className="label mb-3">Twoje wysyłki</div>
        {orders.length === 0 ? (
          <div className="border border-dashed border-border rounded-[20px] px-8 py-12 text-center text-[13px] text-text-soft">
            {tableMissing
              ? "Pojawi się tutaj po uruchomieniu migracji 010."
              : "Nie masz jeszcze wysyłek. Zaznacz produkty powyżej i zleć pierwszą."}
          </div>
        ) : (
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[140px_minmax(180px,2fr)_120px_120px_150px_110px] gap-3 px-4 h-11 label border-b border-border items-center">
              <div>Numer LP</div>
              <div>Odbiorca</div>
              <div>Przewoźnik</div>
              <div>Koszt</div>
              <div>Status</div>
              <div>Data</div>
            </div>
            {orders.map((o) => {
              const pill = statusPill(o.status);
              return (
                <div
                  key={o.id}
                  className="grid grid-cols-1 md:grid-cols-[140px_minmax(180px,2fr)_120px_120px_150px_110px] gap-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <div className="text-[12px] num text-text-soft">{o.tracking_number ?? "—"}</div>
                  <div className="text-[13.5px] font-medium truncate">{recipientOf(o)}</div>
                  <div className="hidden md:block text-[12px] text-text-soft">{o.carrier ?? "—"}</div>
                  <div className="hidden md:block text-[13px] num">
                    {o.shipping_cost_cents != null ? formatPLN(o.shipping_cost_cents, { decimals: false }) : "—"}
                  </div>
                  <div>
                    <Pill variant={pill.variant}>{pill.label}</Pill>
                  </div>
                  <div className="text-[12px] num text-text-soft">{formatDate(o.shipped_at ?? o.created_at)}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

/* --- prezentacja statusów fulfillment (mapowanie na vocab pigułek) --- */

const STEPS = ["Pakowanie", "Wysyłka", "Tranzyt", "Dostawa"] as const;

function stepIndex(status: string): number {
  if (status === "delivered") return 3;
  if (status === "shipped" || status === "in_transit") return 2;
  if (status === "packed" || status === "ready") return 1;
  return 0;
}

function statusPill(status: string): { variant: PillVariant; label: string } {
  switch (status) {
    case "delivered":
      return { variant: "mint", label: "Doręczone" };
    case "shipped":
    case "in_transit":
      return { variant: "blue", label: "Wysłane" };
    case "returned":
      return { variant: "coral", label: "Zwrot" };
    case "failed":
      return { variant: "coral", label: "Nieudana" };
    case "pending":
      return { variant: "blue", label: "W realizacji" };
    default:
      return { variant: "mute", label: "Przygotowane" };
  }
}

/* Poziomy tracker 4 kroków: done = lime dot + label, aktywny = pigułka na
   gradiencie lime→mint z ciemnym tekstem, pending = hollow dot. */
function Tracker({ activeIdx }: { activeIdx: number }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      {STEPS.map((label, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={label} className="flex items-center gap-2 sm:gap-3">
            {i > 0 && (
              <span
                className={`h-px w-5 sm:w-10 ${i <= activeIdx ? "bg-lime/40" : "bg-border"}`}
                aria-hidden
              />
            )}
            {active ? (
              <span className="inline-flex items-center h-7 px-3.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.06em] text-on-accent [background:var(--gradient-cta)]">
                {label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span
                  className={`h-[11px] w-[11px] rounded-full flex-shrink-0 ${
                    done ? "bg-lime" : "border border-border bg-transparent"
                  }`}
                  aria-hidden
                />
                <span className={`text-[12px] ${done ? "" : "text-text-mute"}`}>{label}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Odbiorca: sprzedaż = buyer_name; zlecenie klienta = dane z formularza. */
type OrderRow = {
  id: string;
  product_id: string | null;
  buyer_name: string | null;
  recipient_name: string | null;
  recipient_city: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shipping_cost_cents: number | null;
  status: string;
  request_type: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
};

function recipientOf(o: { buyer_name: string | null; recipient_name?: string | null; recipient_city?: string | null }): string {
  if (o.buyer_name) return o.buyer_name;
  if (o.recipient_name) return o.recipient_city ? `${o.recipient_name} (${o.recipient_city})` : o.recipient_name;
  return "—";
}

function Detail({ label, value, num = false }: { label: string; value: string; num?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`mt-1.5 text-[13px] ${num ? "num text-text-soft" : "font-medium"}`}>{value}</div>
    </div>
  );
}
