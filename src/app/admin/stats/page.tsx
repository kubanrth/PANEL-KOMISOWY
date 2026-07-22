import { requireAdmin } from "@/lib/admin";
import { formatPLN, plural } from "@/lib/format";

/* Statystyki (admin) — uporządkowane wg tego, co Kickback musi wiedzieć:
   1. ile jesteśmy winni komisantom (do wypłaty + karencja),
   2. wartość ich sprzedaży (GMV),
   3. prowizja wygenerowana na ich produktach (po realnych stawkach z umów),
   4. ile koszulek mają u nas na stanie (i ile ten stan jest wart),
   + rozbicie per komisant. */

const STOCK_STATUSES = ["listed", "offer", "aqc"] as const;
const AVAILABLE_TX = new Set(["sale_unlocked", "payout_request", "payout_done", "payout_cancelled", "return_fee", "deposit_topup", "manual_adjustment"]);

export default async function AdminStatsPage() {
  const { supabase } = await requireAdmin();

  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [txRes, prodRes, profRes, payoutRes, subCountRes, returnsCountRes] = await Promise.all([
    supabase.from("wallet_transactions").select("klient_id, amount_cents, type"),
    supabase.from("products").select("status, listing_price_cents, expected_price_cents, sold_at, submissions!inner ( klient_id, commission_rate )"),
    supabase.from("profiles").select("id, first_name, last_name").eq("role", "klient"),
    supabase.from("payouts").select("amount_cents, status"),
    supabase.from("submissions").select("*", { count: "exact", head: true }),
    supabase.from("returns").select("*", { count: "exact", head: true }),
  ]);

  // ---- Portfele komisantów (jedno przejście po wszystkich transakcjach) ----
  type WalletAgg = { balance: number; available: number; pending: number };
  const walletByKlient = new Map<string, WalletAgg>();
  const walletTotal: WalletAgg = { balance: 0, available: 0, pending: 0 };
  for (const tx of txRes.data ?? []) {
    const w = walletByKlient.get(tx.klient_id) ?? { balance: 0, available: 0, pending: 0 };
    w.balance += tx.amount_cents;
    walletTotal.balance += tx.amount_cents;
    if (AVAILABLE_TX.has(tx.type)) { w.available += tx.amount_cents; walletTotal.available += tx.amount_cents; }
    if (tx.type === "sale_pending") { w.pending += tx.amount_cents; walletTotal.pending += tx.amount_cents; }
    walletByKlient.set(tx.klient_id, w);
  }

  // ---- Produkty: sprzedaż, prowizja, stan magazynu ----
  type ProdRow = {
    status: string;
    listing_price_cents: number | null;
    expected_price_cents: number | null;
    sold_at: string | null;
    submissions: { klient_id: string; commission_rate: number } | { klient_id: string; commission_rate: number }[];
  };
  type KlientAgg = { stock: number; stockValue: number; gmv: number; commission: number; sold: number };
  const byKlient = new Map<string, KlientAgg>();
  let gmv = 0, gmvMonth = 0, soldCount = 0, soldMonthCount = 0, commission = 0, stockCount = 0, stockValue = 0;

  for (const p of (prodRes.data ?? []) as unknown as ProdRow[]) {
    const sub = Array.isArray(p.submissions) ? p.submissions[0] : p.submissions;
    if (!sub) continue;
    const price = p.listing_price_cents ?? p.expected_price_cents ?? 0;
    const agg = byKlient.get(sub.klient_id) ?? { stock: 0, stockValue: 0, gmv: 0, commission: 0, sold: 0 };

    if ((STOCK_STATUSES as readonly string[]).includes(p.status)) {
      agg.stock += 1; agg.stockValue += price;
      stockCount += 1; stockValue += price;
    }
    if (p.status === "sold") {
      const fee = Math.round(price * (sub.commission_rate ?? 0.2));
      agg.gmv += price; agg.commission += fee; agg.sold += 1;
      gmv += price; commission += fee; soldCount += 1;
      if (p.sold_at && p.sold_at >= monthAgo) { gmvMonth += price; soldMonthCount += 1; }
    }
    byKlient.set(sub.klient_id, agg);
  }

  // ---- Wypłaty ----
  const payouts = payoutRes.data ?? [];
  const paidOut = payouts.filter((p) => p.status === "done").reduce((a, p) => a + p.amount_cents, 0);
  const payoutsInFlight = payouts.filter((p) => p.status === "requested" || p.status === "authorized").reduce((a, p) => a + p.amount_cents, 0);

  // ---- Tabela per komisant (portfel ∪ produkty) ----
  const nameById = new Map((profRes.data ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "—"]));
  const klientIds = new Set([...byKlient.keys(), ...walletByKlient.keys()]);
  const rows = Array.from(klientIds)
    .map((id) => ({
      id,
      name: nameById.get(id) ?? "—",
      ...(byKlient.get(id) ?? { stock: 0, stockValue: 0, gmv: 0, commission: 0, sold: 0 }),
      wallet: walletByKlient.get(id) ?? { balance: 0, available: 0, pending: 0 },
    }))
    .sort((a, b) => b.gmv - a.gmv);

  return (
    <>
      <section>
        <div className="label">Cała platforma</div>
        <h1 className="mt-4 font-display font-bold uppercase text-[18px] lg:text-[24px] leading-[1.15] tracking-[0.01em]">
          Statystyki
        </h1>
      </section>

      {/* Zobowiązania i wynik — to, co trzeba wiedzieć najpierw */}
      <section className="mt-12">
        <div className="label mb-4">Komisanci · zobowiązania i wynik</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-gradient-dark p-6 rounded-[20px] relative overflow-hidden">
            <div className="glow-blob" aria-hidden />
            <div className="relative">
              <div className="label !text-mint/80">Do wypłaty (dostępne)</div>
              <div className="mt-2 font-light text-3xl tracking-[-0.02em] num text-mint">{formatPLN(walletTotal.available, { decimals: false })}</div>
              <div className="mt-2 text-[11px] text-text-soft">Suma dostępnych sald · zlecone wypłaty: {formatPLN(payoutsInFlight, { decimals: false })}</div>
            </div>
          </div>
          <div className="card p-6">
            <div className="label">W karencji (pending)</div>
            <div className="mt-2 font-light text-3xl tracking-[-0.02em] num text-yellow">{formatPLN(walletTotal.pending, { decimals: false })}</div>
            <div className="mt-2 text-[11px] text-text-mute">Trafi do dostępnych po 14 dniach</div>
          </div>
          <div className="card-gradient-blue p-6 rounded-[20px] text-white">
            <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Wartość sprzedaży (GMV)</div>
            <div className="mt-2 font-light text-3xl tracking-[-0.02em] num">{formatPLN(gmv, { decimals: false })}</div>
            <div className="mt-2 text-white/80 text-[11px]">{soldCount} sprzedanych · 30 dni: {formatPLN(gmvMonth, { decimals: false })} ({soldMonthCount})</div>
          </div>
          <div className="card-gradient-purple p-6 rounded-[20px] text-white">
            <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Prowizja Kickback</div>
            <div className="mt-2 font-light text-3xl tracking-[-0.02em] num">{formatPLN(commission, { decimals: false })}</div>
            <div className="mt-2 text-white/80 text-[11px]">Po stawkach z umów komisowych</div>
          </div>
        </div>
      </section>

      {/* Stan magazynu */}
      <section className="mt-8">
        <div className="label mb-4">Stan magazynu</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-6">
            <div className="label">Koszulki na stanie</div>
            <div className="mt-2 font-light text-3xl tracking-[-0.02em] num text-lime">{stockCount}</div>
            <div className="mt-2 text-[11px] text-text-mute">W sprzedaży, w ofercie i w weryfikacji</div>
          </div>
          <div className="card p-6">
            <div className="label">Wartość stanu</div>
            <div className="mt-2 font-light text-3xl tracking-[-0.02em] num">{formatPLN(stockValue, { decimals: false })}</div>
            <div className="mt-2 text-[11px] text-text-mute">Po cenach listingowych</div>
          </div>
          <div className="card p-6">
            <div className="label">Komisanci</div>
            <div className="mt-2 font-light text-3xl tracking-[-0.02em] num">{(profRes.data ?? []).length}</div>
            <div className="mt-2 text-[11px] text-text-mute">{subCountRes.count ?? 0} {plural(subCountRes.count ?? 0, ["submission", "submissions", "submissions"])} · {returnsCountRes.count ?? 0} zwrotów</div>
          </div>
          <div className="card p-6">
            <div className="label">Wypłacone łącznie</div>
            <div className="mt-2 font-light text-3xl tracking-[-0.02em] num text-mint">{formatPLN(paidOut, { decimals: false })}</div>
            <div className="mt-2 text-[11px] text-text-mute">Zrealizowane wypłaty (done)</div>
          </div>
        </div>
      </section>

      {/* Per komisant */}
      <section className="mt-12">
        <div className="label mb-5">Per komisant · sortowane po sprzedaży</div>
        {rows.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Brak danych — jeszcze żaden komisant nie ma produktów ani transakcji.
          </div>
        ) : (
          <div className="card table-scroll">
            <div className="grid grid-cols-12 gap-4 px-6 h-11 items-center label border-b border-border min-w-[860px]">
              <div className="col-span-3">Komisant</div>
              <div className="col-span-2 text-right">Na stanie</div>
              <div className="col-span-2 text-right">Sprzedaż (GMV)</div>
              <div className="col-span-2 text-right">Prowizja</div>
              <div className="col-span-3 text-right">Do wypłaty · karencja</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.id}
                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center min-w-[860px] ${i < rows.length - 1 ? "border-b border-border-soft" : ""}`}
              >
                <div className="col-span-3 text-[14px] truncate">{r.name}</div>
                <div className="col-span-2 text-right text-[13px] num">
                  {r.stock} szt <span className="text-text-mute">· {formatPLN(r.stockValue, { decimals: false })}</span>
                </div>
                <div className="col-span-2 text-right text-[14px] num">
                  {formatPLN(r.gmv, { decimals: false })} <span className="text-text-mute text-[11px]">({r.sold})</span>
                </div>
                <div className="col-span-2 text-right text-[14px] num text-mint">{formatPLN(r.commission, { decimals: false })}</div>
                <div className="col-span-3 text-right text-[14px] num">
                  <span className={r.wallet.available > 0 ? "text-lime" : ""}>{formatPLN(r.wallet.available, { decimals: false })}</span>
                  <span className="text-text-mute text-[12px]"> · {formatPLN(r.wallet.pending, { decimals: false })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
