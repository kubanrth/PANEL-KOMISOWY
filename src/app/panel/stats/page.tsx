import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { formatPLN, formatDate, takeHomeCents, daysFromNow } from "@/lib/format";
import type { Product, Submission } from "@/lib/types";

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: submissionsRaw } = await supabase
    .from("submissions")
    .select("id, status, created_at, signed_at, commission_rate")
    .order("created_at", { ascending: false });
  const submissions = (submissionsRaw ?? []) as Submission[];

  const { data: productsRaw } = await supabase
    .from("products")
    .select("id, submission_id, brand, status, expected_price_cents, listing_price_cents, created_at, updated_at")
    .order("created_at", { ascending: false });
  const products = (productsRaw ?? []) as Product[];

  // Wallet summary
  const { data: summary } = await supabase.rpc("wallet_summary", { klient: user.id });
  const balance = (summary?.[0]?.balance_cents as number | undefined) ?? 0;

  // Aggregates
  const sold = products.filter((p) => p.status === "sold");
  const listed = products.filter((p) => p.status === "listed");
  const aqc = products.filter((p) => p.status === "aqc");
  const offer = products.filter((p) => p.status === "offer");

  const totalGMV = sold.reduce((acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0), 0);
  const totalEarnings = sold.reduce((acc, p) => {
    const sub = submissions.find((s) => s.id === p.submission_id);
    return acc + (takeHomeCents(p.listing_price_cents ?? p.expected_price_cents ?? 0, sub?.commission_rate ?? 0.2) ?? 0);
  }, 0);

  // Top brands
  const brandTally = new Map<string, { count: number; gmv: number }>();
  for (const p of sold) {
    const cur = brandTally.get(p.brand) ?? { count: 0, gmv: 0 };
    cur.count += 1;
    cur.gmv += p.listing_price_cents ?? p.expected_price_cents ?? 0;
    brandTally.set(p.brand, cur);
  }
  const topBrands = Array.from(brandTally.entries()).sort((a, b) => b[1].gmv - a[1].gmv).slice(0, 5);

  // Conversion rate
  const conversion = products.length > 0 ? Math.round((sold.length / products.length) * 100) : 0;

  // Avg time submitted → sold (simplified: created_at → updated_at when sold)
  const avgDaysToSell = sold.length > 0
    ? Math.round(
        sold.reduce((acc, p) => {
          const ms = new Date(p.updated_at).getTime() - new Date(p.created_at).getTime();
          return acc + ms / 86_400_000;
        }, 0) / sold.length,
      )
    : null;

  // Account age
  const accountAge = profile.created_at ? Math.abs(daysFromNow(profile.created_at) ?? 0) : null;

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      walletBalance={balance}
      active="stats"
      breadcrumb={[{ label: "Statystyki" }]}
    >
      <section>
        <div className="label">Twoja sprzedaż w liczbach</div>
        <h1 className="mt-4 font-bold text-[40px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
          Statystyki <span className="text-text-soft">/ podsumowanie.</span>
        </h1>
        <p className="mt-4 text-[15px] text-text-soft max-w-[60ch]">
          Konto aktywne {accountAge != null ? `${accountAge} dni` : "—"} · {submissions.length} Submissions · {products.length} produktów łącznie
        </p>
      </section>

      {/* Top KPIs */}
      <section className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-gradient-blue p-6 rounded-[20px] text-white">
          <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">GMV (sprzedaż)</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">{formatPLN(totalGMV, { decimals: false })}</div>
          <div className="mt-2 text-white/80 text-[12px] num">{sold.length} sprzedanych</div>
        </div>
        <div className="card-gradient-purple p-6 rounded-[20px] text-white">
          <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Twoje przychody</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">{formatPLN(totalEarnings, { decimals: false })}</div>
          <div className="mt-2 text-white/80 text-[12px]">Po prowizji 20%</div>
        </div>
        <div className="card p-6">
          <div className="label">Konwersja</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">{conversion}%</div>
          <div className="mt-2 text-[12px] text-text-mute">z {products.length} produktów</div>
        </div>
        <div className="card p-6">
          <div className="label">Avg czas do sprzedaży</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">
            {avgDaysToSell != null ? `${avgDaysToSell} dni` : "—"}
          </div>
          <div className="mt-2 text-[12px] text-text-mute">od dodania</div>
        </div>
      </section>

      {/* Status breakdown */}
      <section className="mt-12">
        <div className="label mb-4">Pipeline</div>
        <div className="card p-6">
          <Bar label="W A&QC" value={aqc.length} total={products.length} color="mute" />
          <Bar label="W sprzedaży (Listed)" value={listed.length} total={products.length} color="blue" />
          <Bar label="Z ofertami" value={offer.length} total={products.length} color="amber" />
          <Bar label="Sprzedane" value={sold.length} total={products.length} color="mint" />
        </div>
      </section>

      {/* Top brands */}
      {topBrands.length > 0 && (
        <section className="mt-12">
          <div className="label mb-4">Top marki (po GMV)</div>
          <div className="card overflow-hidden">
            {topBrands.map(([brand, stats], i) => (
              <div key={brand} className={`grid grid-cols-12 gap-4 px-6 py-4 items-center ${i < topBrands.length - 1 ? "border-b border-border-soft" : ""}`}>
                <div className="col-span-1 font-semibold text-[14px] text-text-mute num">#{i + 1}</div>
                <div className="col-span-6 text-[15px] font-medium">{brand}</div>
                <div className="col-span-2 text-[13px] text-text-mute num">{stats.count} szt.</div>
                <div className="col-span-3 text-right font-bold text-lg tracking-[-0.025em] num">
                  {formatPLN(stats.gmv, { decimals: false })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      {submissions.length > 0 && (
        <section className="mt-12">
          <div className="label mb-4">Ostatnie 5 Submissions</div>
          <div className="space-y-2">
            {submissions.slice(0, 5).map((s) => (
              <div key={s.id} className="card p-4 flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-mono">{s.id}</div>
                  <div className="text-[12px] text-text-mute">{formatDate(s.created_at)}</div>
                </div>
                <div className="text-[12px] text-text-soft">{s.status}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </PanelShell>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: "blue" | "mint" | "amber" | "mute" }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const fillCls = {
    blue: "bg-blue",
    mint: "bg-mint",
    amber: "bg-amber",
    mute: "bg-text-mute",
  }[color];
  return (
    <div className="py-2.5 border-b border-border-soft last:border-0">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[14px]">{label}</span>
        <span className="text-[12px] text-text-soft num">{value} <span className="text-text-mute">/ {total}</span></span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div className={`h-full ${fillCls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
