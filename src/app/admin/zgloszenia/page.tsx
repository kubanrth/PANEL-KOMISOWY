import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { DecideButtons } from "../zmiany-ceny/DecideButtons";
import { resolveReturn } from "../returns/actions";
import { markFulfillmentShipped, markFulfillmentDelivered } from "./actions";
import { formatPLN, formatDate } from "@/lib/format";
import { RETURN_REASON_LABEL, type Photo, type PriceChangeRequest, type ReturnReason } from "@/lib/types";

/* Zgłoszenia (segment 2) — wszystko, co generują komisanci, w jednym
   miejscu, podzielone na segmenty: Odsyłka (wycofania z komisu) /
   Zmiana ceny / Fulfillment (zlecenia wysyłek). Reużywa akcji z
   admin/returns i admin/zmiany-ceny — jedna logika, dwa wejścia. */

type Segment = "odsylka" | "cena" | "fulfillment";
const WITHDRAW_REASONS = ["withdraw_short_term", "withdraw_long_term", "client_rejection"];

export default async function AdminZgloszeniaPage(props: { searchParams: Promise<{ typ?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await props.searchParams;

  const [returnsRes, priceRes, fulfillRes] = await Promise.all([
    supabase
      .from("returns")
      .select("id, reason, fee_cents, resolution, created_at, products ( id, brand, model, photos, submissions ( profiles:klient_id ( first_name, last_name ) ) )")
      .eq("resolution", "pending")
      .in("reason", WITHDRAW_REASONS)
      .order("created_at", { ascending: true }),
    supabase
      .from("price_change_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("fulfillment_orders")
      .select("id, product_id, status, request_type, label_url, recipient_name, recipient_city, recipient_postal_code, recipient_address_line, recipient_phone, notes, tracking_number, carrier, created_at, klient_id, products ( brand, model, photos ), profiles:klient_id ( first_name, last_name )")
      .in("status", ["pending", "shipped"])
      .not("request_type", "is", null)
      .order("created_at", { ascending: true }),
  ]);

  const withdrawals = returnsRes.data ?? [];
  const priceReqs = (priceRes.data ?? []) as PriceChangeRequest[];
  const fulfillments = fulfillRes.data ?? [];

  // Dane do wierszy zmian cen (produkt + wnioskodawca)
  const pcProductIds = Array.from(new Set(priceReqs.map((r) => r.product_id)));
  const pcRequesterIds = Array.from(new Set(priceReqs.map((r) => r.requested_by)));
  const [pcProds, pcProfs] = await Promise.all([
    pcProductIds.length
      ? supabase.from("products").select("id, brand, model, photos").in("id", pcProductIds)
      : Promise.resolve({ data: [] }),
    pcRequesterIds.length
      ? supabase.from("profiles").select("id, first_name, last_name").in("id", pcRequesterIds)
      : Promise.resolve({ data: [] }),
  ]);
  const pcProductById = new Map((pcProds.data ?? []).map((p) => [p.id, p]));
  const pcProfileById = new Map((pcProfs.data ?? []).map((p) => [p.id, p]));

  const counts: Record<Segment, number> = {
    odsylka: withdrawals.length,
    cena: priceReqs.length,
    fulfillment: fulfillments.length,
  };
  const SEGMENTS: Array<{ key: Segment; label: string }> = [
    { key: "odsylka", label: "Odsyłka" },
    { key: "cena", label: "Zmiana ceny" },
    { key: "fulfillment", label: "Fulfillment" },
  ];
  const seg: Segment = SEGMENTS.some((s) => s.key === sp.typ) ? (sp.typ as Segment) : "odsylka";
  const total = counts.odsylka + counts.cena + counts.fulfillment;

  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

  return (
    <>
      <PageHeader
        label={`${total} otwartych zgłoszeń`}
        title="Zgłoszenia"
        sub="Wszystko, co generują komisanci: wycofania towaru, sugestie cen i zlecenia wysyłek — do obsłużenia z jednego miejsca."
      />

      <section className="mt-8">
        <FilterDropdown
          prefix="Segment"
          activeKey={seg}
          options={SEGMENTS.map((s) => ({
            key: s.key,
            label: s.label,
            count: counts[s.key],
            href: `/admin/zgloszenia?typ=${s.key}`,
          }))}
        />
      </section>

      <section className="mt-6 space-y-3 kb-stagger">
        {/* ---- Odsyłka ---- */}
        {seg === "odsylka" && (withdrawals.length === 0 ? (
          <Empty text="Brak oczekujących wycofań." />
        ) : (
          withdrawals.map((r) => {
            const prod = one(r.products);
            const sub = one((prod as { submissions?: unknown } | null)?.submissions as never);
            const prof = one((sub as { profiles?: unknown } | null)?.profiles as never) as { first_name: string | null; last_name: string | null } | null;
            const info = RETURN_REASON_LABEL[r.reason as ReturnReason];
            return (
              <div key={r.id} className="card p-5 flex flex-wrap items-center gap-4">
                {prod && <ProductThumb photos={(prod as { photos: Photo[] | null }).photos as never} brand={(prod as { brand: string }).brand} size="md" />}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[15px] truncate">{(prod as { brand?: string })?.brand} · {(prod as { model?: string })?.model}</div>
                  <div className="mt-1 text-[12px] text-text-mute">
                    {[prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "—"} · {formatDate(r.created_at)} · {info?.title}
                  </div>
                </div>
                <div className="text-right mr-2">
                  <div className="text-[11px] text-text-mute">Opłata</div>
                  <div className="font-semibold text-[14px] num">{formatPLN(r.fee_cents, { decimals: false })}</div>
                </div>
                <div className="flex gap-1.5">
                  <form action={resolveReturn}>
                    <input type="hidden" name="return_id" value={r.id} />
                    <input type="hidden" name="resolution" value="pickup_paid" />
                    <button className="text-[12px] px-3 h-9 rounded-[10px] bg-blue/12 text-blue-soft hover:bg-blue/20 transition-colors">Odbiór</button>
                  </form>
                  <form action={resolveReturn}>
                    <input type="hidden" name="return_id" value={r.id} />
                    <input type="hidden" name="resolution" value="disposal_free" />
                    <button className="text-[12px] px-3 h-9 rounded-[10px] bg-surface-2 text-text-soft hover:bg-surface-3 transition-colors">Utylizacja</button>
                  </form>
                </div>
              </div>
            );
          })
        ))}

        {/* ---- Zmiana ceny ---- */}
        {seg === "cena" && (priceReqs.length === 0 ? (
          <Empty text="Brak oczekujących sugestii cen." />
        ) : (
          priceReqs.map((r) => {
            const prod = pcProductById.get(r.product_id) as { brand: string; model: string; photos: Photo[] | null } | undefined;
            const prof = pcProfileById.get(r.requested_by) as { first_name: string | null; last_name: string | null } | undefined;
            return (
              <div key={r.id} className="card p-5 flex flex-wrap items-center gap-4">
                {prod && <ProductThumb photos={prod.photos as never} brand={prod.brand} size="md" />}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[15px] truncate">{prod?.brand} · {prod?.model}</div>
                  <div className="mt-1 text-[12px] text-text-mute">
                    {[prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "—"} · {formatDate(r.created_at)}
                  </div>
                </div>
                <div className="text-right mr-2">
                  <div className="text-[11px] text-text-mute">Obecna → proponowana</div>
                  <div className="font-semibold text-[14px] num">
                    {formatPLN(r.current_price_cents ?? 0, { decimals: false })} → <span className="text-lime">{formatPLN(r.suggested_price_cents, { decimals: false })}</span>
                  </div>
                </div>
                <DecideButtons requestId={r.id} />
              </div>
            );
          })
        ))}

        {/* ---- Fulfillment ---- */}
        {seg === "fulfillment" && (fulfillments.length === 0 ? (
          <Empty text="Brak otwartych zleceń wysyłki." />
        ) : (
          fulfillments.map((f) => {
            const prod = one(f.products) as { brand: string; model: string; photos: Photo[] | null } | null;
            const prof = one(f.profiles) as { first_name: string | null; last_name: string | null } | null;
            return (
              <div key={f.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-4">
                  {prod && <ProductThumb photos={prod.photos as never} brand={prod.brand} size="md" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[15px] truncate">{prod?.brand} · {prod?.model}</div>
                    <div className="mt-1 text-[12px] text-text-mute">
                      {[prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "—"} · {formatDate(f.created_at)} ·{" "}
                      {f.request_type === "label_provided" ? "własny list przewozowy" : "wygenerować etykietę"}
                    </div>
                    {f.recipient_name && (
                      <div className="mt-1 text-[12px] text-text-soft">
                        → {f.recipient_name}, {f.recipient_address_line}, {f.recipient_postal_code} {f.recipient_city}
                        {f.recipient_phone ? ` · tel. ${f.recipient_phone}` : ""}
                      </div>
                    )}
                    {f.notes && <div className="mt-1 text-[12px] text-text-mute italic line-clamp-2">„{f.notes}"</div>}
                  </div>
                  <span className={`pill ${f.status === "pending" ? "pill-yellow" : "pill-blue"}`}>
                    {f.status === "pending" ? "Do wysłania" : `Wysłane · ${f.tracking_number}`}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-border-soft flex items-center gap-2 flex-wrap">
                  {f.label_url && (
                    <a href={f.label_url} target="_blank" rel="noreferrer" className="text-[12px] px-3 h-9 inline-flex items-center rounded-[10px] bg-surface-2 text-text-soft hover:text-text hover:bg-surface-3 transition-colors">
                      Pobierz etykietę
                    </a>
                  )}
                  {f.status === "pending" ? (
                    <form action={markFulfillmentShipped} className="flex items-center gap-2 flex-wrap">
                      <input type="hidden" name="order_id" value={f.id} />
                      <input name="tracking_number" placeholder="Nr trackingu *" required className="input !h-9 !w-[180px] text-[12px] num" />
                      <input name="carrier" placeholder="Kurier (np. DPD)" className="input !h-9 !w-[140px] text-[12px]" />
                      <button className="text-[12px] px-3 h-9 rounded-[10px] bg-lime/12 text-lime hover:bg-lime/20 transition-colors">
                        Oznacz jako wysłane
                      </button>
                    </form>
                  ) : (
                    <form action={markFulfillmentDelivered}>
                      <input type="hidden" name="order_id" value={f.id} />
                      <button className="text-[12px] px-3 h-9 rounded-[10px] bg-mint/12 text-mint hover:bg-mint/20 transition-colors">
                        Oznacz jako doręczone
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        ))}
      </section>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-10 text-center text-text-soft">
      {text}
    </div>
  );
}
