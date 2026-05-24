import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { formatPLN } from "@/lib/format";

export default async function AdminStatsPage() {
  const { user, profile, supabase } = await requireAdmin();

  // Total counts
  const [
    { count: totalKlienci },
    { count: totalSubmissions },
    { count: totalProducts },
    { count: totalSold },
    { count: totalListed },
    { count: totalAqc },
    { count: totalReturns },
    { count: totalOffers },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "klient"),
    supabase.from("submissions").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "sold"),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "listed"),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "aqc"),
    supabase.from("returns").select("*", { count: "exact", head: true }),
    supabase.from("offers").select("*", { count: "exact", head: true }),
  ]);

  // GMV total
  const { data: soldProducts } = await supabase
    .from("products")
    .select("listing_price_cents, expected_price_cents")
    .eq("status", "sold");
  const gmv = (soldProducts ?? []).reduce((acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0), 0);
  const commissions = Math.round(gmv * 0.20);

  // GMV last 30 days
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: monthSold } = await supabase
    .from("products")
    .select("listing_price_cents, expected_price_cents")
    .eq("status", "sold")
    .gte("updated_at", monthAgo);
  const gmvMonth = (monthSold ?? []).reduce((acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0), 0);

  // Top klienci by GMV
  const { data: subsWithKlient } = await supabase
    .from("submissions")
    .select("klient_id, profiles!klient_id ( first_name, last_name ), products ( listing_price_cents, expected_price_cents, status )")
    .limit(50);

  type SubRow = {
    klient_id: string;
    profiles?: { first_name: string | null; last_name: string | null } | null;
    products: Array<{ listing_price_cents: number | null; expected_price_cents: number | null; status: string }>;
  };
  type RawSub = Omit<SubRow, "profiles"> & {
    profiles?: SubRow["profiles"] | SubRow["profiles"][] | null;
  };
  const subs: SubRow[] = ((subsWithKlient ?? []) as unknown as RawSub[]).map((s) => ({
    ...s,
    profiles: Array.isArray(s.profiles) ? s.profiles[0] ?? null : (s.profiles ?? null),
  }));

  const klientGMV = new Map<string, { name: string; gmv: number; sold: number }>();
  for (const s of subs) {
    const name = [s.profiles?.first_name, s.profiles?.last_name].filter(Boolean).join(" ") || "—";
    const sold = s.products.filter((p) => p.status === "sold");
    const gmv = sold.reduce((acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0), 0);
    const cur = klientGMV.get(s.klient_id) ?? { name, gmv: 0, sold: 0 };
    cur.gmv += gmv; cur.sold += sold.length;
    klientGMV.set(s.klient_id, cur);
  }
  const topKlienci = Array.from(klientGMV.entries())
    .filter(([, v]) => v.gmv > 0)
    .sort((a, b) => b[1].gmv - a[1].gmv)
    .slice(0, 5);

  // Total payouts
  const { data: payoutsData } = await supabase.from("payouts").select("amount_cents, status");
  const payouts = payoutsData ?? [];
  const totalPaidOut = payouts.filter((p) => p.status === "done").reduce((acc, p) => acc + p.amount_cents, 0);
  const pendingPaidOut = payouts.filter((p) => p.status === "requested" || p.status === "authorized").reduce((acc, p) => acc + p.amount_cents, 0);

  return (
    <AdminShell user={user} profile={profile} active="stats" breadcrumb={[{ label: "Statystyki" }]}>
      <section>
        <div className="label">Cała platforma</div>
        <h1 className="mt-4 font-bold text-[28px] lg:text-[36px] leading-[1.02] tracking-[-0.04em]">
          Metryki Kickback
        </h1>
      </section>

      {/* Big numbers */}
      <section className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-gradient-blue p-6 rounded-[20px] text-white">
          <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">GMV total</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">{formatPLN(gmv, { decimals: false })}</div>
          <div className="mt-2 text-white/80 text-[11px]">{totalSold ?? 0} sprzedanych</div>
        </div>
        <div className="card-gradient-purple p-6 rounded-[20px] text-white">
          <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Prowizje (20%)</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">{formatPLN(commissions, { decimals: false })}</div>
          <div className="mt-2 text-white/80 text-[11px]">Przychód Kickback</div>
        </div>
        <div className="card p-6">
          <div className="label">GMV · 30 dni</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">{formatPLN(gmvMonth, { decimals: false })}</div>
          <div className="mt-2 text-[11px] text-text-mute">{(monthSold ?? []).length} sprzedanych</div>
        </div>
        <div className="card p-6">
          <div className="label">Wypłacone</div>
          <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">{formatPLN(totalPaidOut, { decimals: false })}</div>
          <div className="mt-2 text-[11px] text-text-mute">+ pending: {formatPLN(pendingPaidOut, { decimals: false })}</div>
        </div>
      </section>

      {/* Counts */}
      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Klienci" value={totalKlienci ?? 0} />
        <Stat label="Submissions" value={totalSubmissions ?? 0} />
        <Stat label="Produkty łącznie" value={totalProducts ?? 0} />
        <Stat label="W A&QC" value={totalAqc ?? 0} />
        <Stat label="W sprzedaży" value={totalListed ?? 0} accent="mint" />
        <Stat label="Sprzedane" value={totalSold ?? 0} accent="mint" />
        <Stat label="Oferty (Zerr)" value={totalOffers ?? 0} accent="amber" />
        <Stat label="Zwroty" value={totalReturns ?? 0} accent="pink" />
      </section>

      {/* Top klienci */}
      {topKlienci.length > 0 && (
        <section className="mt-12">
          <div className="label mb-5">Top klienci · po GMV</div>
          <div className="card overflow-hidden">
            {topKlienci.map(([id, data], i) => (
              <div
                key={id}
                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center ${
                  i < topKlienci.length - 1 ? "border-b border-border-soft" : ""
                }`}
              >
                <div className="col-span-1 font-bold text-text-mute num">#{i + 1}</div>
                <div className="col-span-7 text-[15px]">{data.name}</div>
                <div className="col-span-2 text-[13px] text-text-mute num">{data.sold} sprzedanych</div>
                <div className="col-span-2 text-right font-bold text-lg num">{formatPLN(data.gmv, { decimals: false })}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AdminShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "mint" | "amber" | "pink" }) {
  const colorCls = accent === "mint" ? "text-mint" : accent === "amber" ? "text-amber" : accent === "pink" ? "text-pink" : "";
  return (
    <div className="card p-5">
      <div className="label">{label}</div>
      <div className={`mt-2 font-bold text-3xl tracking-[-0.04em] num ${colorCls}`}>{value}</div>
    </div>
  );
}
