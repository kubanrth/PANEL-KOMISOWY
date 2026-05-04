import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { SubmissionStatusPill } from "@/components/panel/StatusPill";
import { formatPLN, formatDate, daysFromNow } from "@/lib/format";

export default async function AdminQueuePage() {
  const { user, profile, supabase } = await requireAdmin();

  // Counts
  const [{ count: pendingAqc }, { count: pendingPayouts }, { count: openOffers }, { count: openReturns }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "aqc"),
    supabase.from("payouts").select("*", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("offers").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("returns").select("*", { count: "exact", head: true }).eq("resolution", "pending"),
  ]);

  // GMV this month
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { data: monthSold } = await supabase
    .from("products")
    .select("listing_price_cents, expected_price_cents")
    .eq("status", "sold")
    .gte("updated_at", monthStart.toISOString());
  const monthGMV = (monthSold ?? []).reduce((acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0), 0);

  // Active queue (AQC + offers + payouts + returns recent)
  const { data: aqcQueue } = await supabase
    .from("products")
    .select("id, brand, model, condition, expected_price_cents, photos, created_at, submission_id, submissions(id, klient_id)")
    .eq("status", "aqc")
    .order("created_at", { ascending: true })
    .limit(5);

  const { data: payoutQueue } = await supabase
    .from("payouts")
    .select("id, amount_cents, requested_at, klient_id, profiles(first_name, last_name, account_type)")
    .eq("status", "requested")
    .order("requested_at", { ascending: true })
    .limit(5);

  return (
    <AdminShell user={user} profile={profile} active="queue">
      <section>
        <div className="label">Operacje · {formatDate(new Date())}</div>
        <h1 className="mt-4 font-bold text-[44px] lg:text-[64px] leading-[1.02] tracking-[-0.04em]">
          Queue · <span className="text-text-soft">{(pendingAqc ?? 0) + (pendingPayouts ?? 0) + (openOffers ?? 0) + (openReturns ?? 0)} sprawy.</span>
        </h1>
      </section>

      {/* KPI strip */}
      <section className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="A&QC w kolejce" value={pendingAqc ?? 0} sub="produkty do audytu" href="/admin/aqc" />
        <KpiCard label="Wypłaty do autoryzacji" value={pendingPayouts ?? 0} sub="oczekuje" href="/admin/payouts" highlight />
        <KpiCard label="Oferty Zerr" value={openOffers ?? 0} sub="aktywne negocjacje" href="/admin/offers" />
        <KpiCard label="Zwroty" value={openReturns ?? 0} sub="czeka na decyzję" href="/admin/returns" />
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4">
        <div className="card-gradient-blue p-6 rounded-[20px] text-white">
          <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">GMV miesiąc</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">{formatPLN(monthGMV, { decimals: false })}</div>
          <div className="mt-2 text-white/80 text-[12px]">{(monthSold ?? []).length} sprzedanych w tym miesiącu</div>
        </div>
        <div className="card-gradient-purple p-6 rounded-[20px] text-white">
          <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Twoja rola</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em]">{profile.role === "super_admin" ? "Super-admin" : "Admin"}</div>
          <div className="mt-2 text-white/80 text-[12px]">Pełna autoryzacja operacji</div>
        </div>
      </section>

      {/* AQC queue */}
      <section className="mt-12">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="label">Kolejka A&QC</div>
            <h2 className="mt-2 font-bold text-2xl tracking-[-0.025em]">Czeka na audyt</h2>
          </div>
          <Link href="/admin/aqc" className="text-[13px] text-text-soft hover:text-text">Wszystkie →</Link>
        </div>
        {aqcQueue && aqcQueue.length > 0 ? (
          <div className="space-y-3">
            {aqcQueue.map((p) => {
              type Q = typeof aqcQueue[number];
              const product = p as Q & { submissions?: { id: string } | null };
              const slaDays = daysFromNow(new Date(new Date(product.created_at).getTime() + 5 * 86_400_000).toISOString());
              return (
                <Link
                  key={product.id}
                  href={`/admin/aqc/${product.id}`}
                  className="card p-5 flex items-center gap-4 hover:border-purple/40 transition-colors"
                >
                  <ProductThumb photos={product.photos as Q["photos"]} brand={product.brand} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[15px] truncate">{product.brand} · {product.model}</div>
                    <div className="text-[12px] text-text-mute mt-1 num">
                      {product.submissions?.id ?? "—"} · stan {product.condition ?? "?"}/10 · {formatDate(product.created_at)}
                    </div>
                  </div>
                  <span className={`pill ${slaDays != null && slaDays < 1 ? "pill-pink" : slaDays != null && slaDays < 2 ? "pill-amber" : "pill-mute"}`}>
                    SLA {slaDays != null ? `${slaDays}d` : "—"}
                  </span>
                  <div className="text-right hidden sm:block">
                    <div className="text-[11px] text-text-mute">Oczekiwana</div>
                    <div className="font-semibold text-[14px] num">{formatPLN(product.expected_price_cents ?? 0, { decimals: false })}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Brak produktów w kolejce A&QC.
          </div>
        )}
      </section>

      {/* Payouts queue */}
      <section className="mt-12">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="label">Wypłaty do autoryzacji</div>
            <h2 className="mt-2 font-bold text-2xl tracking-[-0.025em]">Czeka na zielone światło</h2>
          </div>
          <Link href="/admin/payouts" className="text-[13px] text-text-soft hover:text-text">Wszystkie →</Link>
        </div>
        {payoutQueue && payoutQueue.length > 0 ? (
          <div className="space-y-3">
            {payoutQueue.map((p) => {
              type Q = typeof payoutQueue[number];
              const payout = p as Q & { profiles?: { first_name: string | null; last_name: string | null; account_type: "individual" | "business" | null } | null };
              const name = [payout.profiles?.first_name, payout.profiles?.last_name].filter(Boolean).join(" ") || "—";
              return (
                <Link
                  key={payout.id}
                  href={`/admin/payouts`}
                  className="card p-5 flex items-center gap-4 hover:border-purple/40 transition-colors"
                >
                  <div className="h-10 w-10 rounded-[12px] bg-blue/15 border border-blue/30 flex items-center justify-center text-blue-soft">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[15px] truncate">{name}</div>
                    <div className="text-[12px] text-text-mute mt-1 num">
                      {payout.profiles?.account_type === "business" ? "Biznesowe" : "Indywidualne"} · {formatDate(payout.requested_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-text-mute">Kwota</div>
                    <div className="font-bold text-lg tracking-[-0.025em] num">{formatPLN(payout.amount_cents, { decimals: false })}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Brak wypłat do autoryzacji.
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function KpiCard({ label, value, sub, href, highlight }: { label: string; value: number; sub: string; href: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`card p-6 hover:border-purple/40 transition-colors block ${highlight && value > 0 ? "border-purple/30 bg-purple/5" : ""}`}
    >
      <div className="label">{label}</div>
      <div className="mt-3 font-bold text-3xl tracking-[-0.04em] num">{value}</div>
      <div className="mt-2 text-[12px] text-text-mute">{sub}</div>
    </Link>
  );
}
