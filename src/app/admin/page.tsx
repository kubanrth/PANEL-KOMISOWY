import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatPLN, formatDate } from "@/lib/format";

export default async function AdminQueuePage() {
  const { profile, supabase } = await requireAdmin();

  // Counts
  const [{ count: pendingPayouts }, { count: openOffers }, { count: openReturns }] = await Promise.all([
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


  const { data: payoutQueue } = await supabase
    .from("payouts")
    .select("id, amount_cents, requested_at, klient_id, profiles(first_name, last_name, account_type)")
    .eq("status", "requested")
    .order("requested_at", { ascending: true })
    .limit(5);

  return (
    <>
      {/* Widok startuje od kafelków akcji — bez nagłówka (decyzja klienta). */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Wypłaty do autoryzacji" value={pendingPayouts ?? 0} sub="oczekuje" href="/admin/payouts" highlight />
        <KpiCard label="Oferty Zerr" value={openOffers ?? 0} sub="aktywne negocjacje" href="/admin/offers" />
        <KpiCard label="Zwroty" value={openReturns ?? 0} sub="czeka na decyzję" href="/admin/returns" />
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4">
        <div className="card p-6 border-mint/25 bg-mint/5">
          <div className="label !text-mint">GMV miesiąc</div>
          <div className="mt-2 font-light text-3xl tracking-[-0.02em] num text-mint">{formatPLN(monthGMV, { decimals: false })}</div>
          <div className="mt-2 text-text-soft text-[12px]">{(monthSold ?? []).length} sprzedanych w tym miesiącu</div>
        </div>
        <div className="card p-6">
          <div className="label">Twoja rola</div>
          <div className="mt-2 font-light text-3xl tracking-[-0.02em]">{profile.role === "super_admin" ? "Super-admin" : "Admin"}</div>
          <div className="mt-2 text-text-mute text-[12px]">Pełna autoryzacja operacji</div>
        </div>
      </section>

      {/* Payouts queue */}
      <section className="mt-12">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="label">Wypłaty do autoryzacji</div>
            <h2 className="mt-2 font-light text-[22px] tracking-[-0.02em]">Czeka na zielone światło</h2>
          </div>
          <Link href="/admin/payouts" className="text-[13px] text-text-soft hover:text-lime transition-colors">Wszystkie →</Link>
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
                  className="card p-5 flex items-center gap-4 hover:border-lime/30 transition-colors"
                >
                  <div className="h-10 w-10 rounded-[12px] bg-surface-2 border border-border flex items-center justify-center text-mint">
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
                    <div className="font-medium text-lg tracking-[-0.02em] num">{formatPLN(payout.amount_cents, { decimals: false })}</div>
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
    </>
  );
}

function KpiCard({ label, value, sub, href, highlight }: { label: string; value: number; sub: string; href: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`card p-6 hover:border-lime/40 transition-colors block ${highlight && value > 0 ? "ring-1 ring-coral/40" : ""}`}
    >
      <div className="label">{label}</div>
      <div className="mt-3 font-light text-3xl tracking-[-0.02em] num">{value}</div>
      <div className="mt-2 text-[12px] text-text-mute">{sub}</div>
    </Link>
  );
}
