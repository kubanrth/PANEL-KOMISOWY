import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
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

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="fulfillment"
      breadcrumb={[{ label: "Fulfillment" }]}
    >
      <section>
        <div className="label">Model fulfillmentowy</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Fulfillment.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Pozwól Kickback obsłużyć pakowanie i wysyłkę Twoich zamówień. Na koniec każdego miesiąca
          otrzymasz fakturę za zrealizowane przesyłki.
        </p>
      </section>

      {tableMissing && (
        <section className="mt-6">
          <div className="card-bare bg-amber/5 border border-amber/30 rounded-[14px] p-5 flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div className="text-[13px]">
              <div className="font-semibold text-amber">Tabela fulfillment_orders nie istnieje</div>
              <p className="mt-1 text-text-soft">
                Uruchom migrację{" "}
                <span className="num">supabase/migrations/20260523_010_domain_and_demand.sql</span>{" "}
                w Supabase SQL Editor. Po wykonaniu reszta strony zacznie działać.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="label">Umowa fulfillmentowa</div>
          <div className="mt-1 font-semibold text-lg tracking-[-0.025em]">Wzór dokumentu</div>
          <p className="mt-2 text-[13px] text-text-soft">
            Standardowe warunki współpracy w modelu fulfillment. Po akceptacji warunki obowiązują dla
            wszystkich Twoich zamówień obsługiwanych przez Kickback.
          </p>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="pill pill-mute text-[11px]">PDF wkrótce</span>
            <span className="text-[11px] text-text-faint">·</span>
            <a href="mailto:hello@kickback.pl?subject=Aktywacja%20fulfillment" className="text-[13px] text-blue hover:underline">
              Zapytaj o aktywację →
            </a>
          </div>
        </div>

        <div className="card-elev p-6">
          <div className="label">Bieżący miesiąc</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">
            {monthly.length}
            <span className="text-text-mute text-lg ml-1.5 font-normal">zamówień</span>
          </div>
          <div className="mt-2 text-[13px] text-text-soft num">
            Koszt wysyłek: {formatPLN(monthlyShippingCost, { decimals: false })}
          </div>
          <div className="mt-1 text-[11px] text-text-mute">
            Faktura zostanie wystawiona ostatniego dnia miesiąca.
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">Historia zamówień</h2>
        {orders.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center text-[14px] text-text-soft">
            {tableMissing
              ? "Pojawi się tutaj po uruchomieniu migracji 010 i aktywacji modelu fulfillment u Twojego opiekuna."
              : "Nie masz jeszcze zamówień w modelu fulfillment. Skontaktuj się z opiekunem żeby aktywować ten model."}
          </div>
        ) : (
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[140px_minmax(180px,2fr)_120px_140px_120px_140px] gap-3 px-4 py-3 label border-b border-border-soft">
              <div>Numer LP</div>
              <div>Kupujący</div>
              <div>Przewoźnik</div>
              <div>Koszt</div>
              <div>Status</div>
              <div>Data</div>
            </div>
            {orders.map((o) => (
              <div
                key={o.id}
                className="grid grid-cols-[140px_minmax(180px,2fr)_120px_140px_120px_140px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
              >
                <div className="text-[12px] num text-text-soft">{o.tracking_number ?? "—"}</div>
                <div className="text-[13px]">{o.buyer_name ?? "—"}</div>
                <div className="text-[12px] text-text-soft">{o.carrier ?? "—"}</div>
                <div className="text-[13px] num">
                  {o.shipping_cost_cents != null ? formatPLN(o.shipping_cost_cents, { decimals: false }) : "—"}
                </div>
                <div>
                  <span className={`pill ${o.status === "delivered" ? "pill-mint" : o.status === "shipped" ? "pill-blue" : "pill-mute"}`}>
                    {o.status}
                  </span>
                </div>
                <div className="text-[12px] num text-text-soft">{formatDate(o.shipped_at ?? o.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PanelShell>
  );
}
