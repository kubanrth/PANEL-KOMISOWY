import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { formatPLN, formatDate } from "@/lib/format";
import type { FulfillmentOrder } from "@/lib/types";

export default async function FulfillmentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  // Defensive query: if the table doesn't exist yet (migration 010 partial /
  // not applied), surface the error in UI instead of crashing the page.
  const ordersQuery = await supabase
    .from("fulfillment_orders")
    .select("*")
    .order("created_at", { ascending: false });

  const tableMissing = ordersQuery.error?.code === "42P01"; // relation does not exist
  const orders = (ordersQuery.data ?? []) as FulfillmentOrder[];

  // Monthly summary (current month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthly = orders.filter((o) => new Date(o.created_at).getTime() >= monthStart);
  const monthlyShippingCost = monthly.reduce((a, o) => a + (o.shipping_cost_cents ?? 0), 0);

  const latest = orders[0] ?? null;

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="fulfillment"
      breadcrumb={[{ label: "Fulfillment" }]}
    >
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
        sub="Pozwól Kickback obsłużyć pakowanie i wysyłkę Twoich zamówień. Na koniec każdego miesiąca otrzymasz fakturę za zrealizowane przesyłki."
      />

      {/* Hero tracker — ostatnie zamówienie */}
      {latest && (
        <section className="mt-8">
          <div className="card p-6">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="label">Ostatnie zamówienie</div>
              <div className="text-[11px] num text-text-mute">
                {formatDate(latest.shipped_at ?? latest.created_at)}
              </div>
            </div>

            <div className="mt-5">
              <Tracker activeIdx={stepIndex(latest.status)} />
            </div>

            {/* Karta szczegółów */}
            <div className="mt-6 pt-5 border-t border-border-soft grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Detail label="Kupujący" value={latest.buyer_name ?? "—"} />
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

      <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="label">Umowa fulfillmentowa</div>
          <div className="mt-2 font-medium text-[17px] tracking-[-0.015em]">Wzór dokumentu</div>
          <p className="mt-2 text-[13px] leading-[1.55] text-text-soft">
            Standardowe warunki współpracy w modelu fulfillment. Po akceptacji warunki obowiązują dla
            wszystkich Twoich zamówień obsługiwanych przez Kickback.
          </p>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <Pill variant="mute">PDF wkrótce</Pill>
            <a
              href="mailto:hello@kickback.pl?subject=Aktywacja%20fulfillment"
              className="text-[13px] text-text-soft hover:text-lime transition-colors"
            >
              Zapytaj o aktywację →
            </a>
          </div>
        </div>

        <div className="card p-6">
          <div className="label">Bieżący miesiąc</div>
          <div className="mt-3 text-[28px] lg:text-[32px] font-light leading-none tracking-[-0.02em] num">
            {monthly.length}
            <span className="text-text-mute text-[15px] ml-2 font-normal">zamówień</span>
          </div>
          <div className="mt-3 text-[13px] text-text-soft num">
            Koszt wysyłek: {formatPLN(monthlyShippingCost, { decimals: false })}
          </div>
          <div className="mt-1 text-[12px] text-text-mute">
            Faktura zostanie wystawiona ostatniego dnia miesiąca.
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="label mb-3">Historia zamówień</div>
        {orders.length === 0 ? (
          <div className="border border-dashed border-border rounded-[20px] px-8 py-12 text-center text-[13px] text-text-soft">
            {tableMissing
              ? "Pojawi się tutaj po uruchomieniu migracji 010 i aktywacji modelu fulfillment u Twojego opiekuna."
              : "Nie masz jeszcze zamówień w modelu fulfillment. Skontaktuj się z opiekunem żeby aktywować ten model."}
          </div>
        ) : (
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[140px_minmax(180px,2fr)_120px_120px_150px_110px] gap-3 px-4 h-11 label border-b border-border items-center">
              <div>Numer LP</div>
              <div>Kupujący</div>
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
                  <div className="text-[13.5px] font-medium truncate">{o.buyer_name ?? "—"}</div>
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
    </PanelShell>
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

function Detail({ label, value, num = false }: { label: string; value: string; num?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`mt-1.5 text-[13px] ${num ? "num text-text-soft" : "font-medium"}`}>{value}</div>
    </div>
  );
}
