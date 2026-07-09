import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatPLN } from "@/lib/format";
import type { Profile, Product, Submission } from "@/lib/types";

/**
 * Admin CRM master list — all klienci z agregatami (oferty/produkty/GMV).
 * Klik wiersza → /admin/crm/[klient_id] z pełną historią.
 */
export default async function AdminCrmPage(props: { searchParams: Promise<{ q?: string }> }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();

  const { supabase } = await requireAdmin();

  const { data: klienciRaw } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, company_name, account_type, onboarded_at, master_agreement_signed_at, created_at")
    .eq("role", "klient")
    .order("created_at", { ascending: false });
  const klienci = (klienciRaw ?? []) as Array<Pick<Profile, "id" | "first_name" | "last_name" | "company_name" | "account_type" | "onboarded_at" | "master_agreement_signed_at" | "created_at">>;

  // Aggregate products + submissions per klient
  const { data: submissions } = await supabase.from("submissions").select("id, klient_id, status");
  const { data: products } = await supabase
    .from("products")
    .select("submission_id, status, listing_price_cents, expected_price_cents");

  type Agg = { submissions: number; products: number; sold: number; gmv: number; stock: number };
  const subToKlient = new Map((submissions ?? []).map((s) => [s.id, s.klient_id]));
  const aggByKlient = new Map<string, Agg>();
  for (const s of submissions ?? []) {
    const a = aggByKlient.get(s.klient_id) ?? { submissions: 0, products: 0, sold: 0, gmv: 0, stock: 0 };
    a.submissions += 1;
    aggByKlient.set(s.klient_id, a);
  }
  for (const p of products ?? []) {
    const kId = subToKlient.get(p.submission_id);
    if (!kId) continue;
    const a = aggByKlient.get(kId) ?? { submissions: 0, products: 0, sold: 0, gmv: 0, stock: 0 };
    a.products += 1;
    if (p.status === "sold") {
      a.sold += 1;
      a.gmv += p.listing_price_cents ?? 0;
    }
    if (["aqc", "listed", "offer"].includes(p.status)) {
      a.stock += p.listing_price_cents ?? p.expected_price_cents ?? 0;
    }
    aggByKlient.set(kId, a);
  }

  const filtered = q
    ? klienci.filter((k) => {
        const name = `${k.first_name ?? ""} ${k.last_name ?? ""} ${k.company_name ?? ""}`.toLowerCase();
        return name.includes(q);
      })
    : klienci;

  const totals = Array.from(aggByKlient.values()).reduce(
    (acc, a) => ({
      gmv: acc.gmv + a.gmv,
      stock: acc.stock + a.stock,
      products: acc.products + a.products,
    }),
    { gmv: 0, stock: 0, products: 0 },
  );

  return (
    <>
      <section>
        <div className="label">{klienci.length} klientów</div>
        <h1 className="mt-3 font-display font-bold uppercase text-[18px] lg:text-[24px] leading-[1.15] tracking-[0.01em]">
          CRM <span className="text-text-soft">/ master-detail.</span>
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Pełen przegląd wszystkich klientów z agregatami sprzedaży. Kliknij wiersz, żeby zobaczyć szczegóły
          (oferty, magazyn, sprzedaże, wallet, dokumenty, audit).
        </p>
      </section>

      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Klientów" value={klienci.length.toString()} />
        <Kpi label="Onboarded" value={klienci.filter((k) => k.onboarded_at).length.toString()} sub="po onboardingu" />
        <Kpi label="Łączny GMV" value={formatPLN(totals.gmv, { decimals: false })} accent="text-mint" />
        <Kpi label="Stock w magazynie" value={formatPLN(totals.stock, { decimals: false })} />
      </section>

      <section className="mt-8">
        <form className="flex items-center gap-2 max-w-[480px]">
          <input
            name="q"
            placeholder="Szukaj po imieniu, nazwisku, firmie…"
            defaultValue={sp.q ?? ""}
            className="input"
          />
          <button type="submit" className="btn-ghost h-10 px-4 text-[13px]">Szukaj</button>
        </form>
      </section>

      <section className="mt-6">
        <div className="card table-scroll">
          <div className="hidden md:grid grid-cols-[minmax(200px,2fr)_120px_100px_100px_140px_140px_60px] gap-3 px-4 h-11 items-center label border-b border-border">
            <div>Klient</div>
            <div>Typ konta</div>
            <div>Oferty</div>
            <div>Sprzed.</div>
            <div>GMV</div>
            <div>Stock</div>
            <div className="text-right">Akcja</div>
          </div>
          {filtered.map((k) => {
            const agg = aggByKlient.get(k.id) ?? { submissions: 0, products: 0, sold: 0, gmv: 0, stock: 0 };
            const name =
              [k.first_name, k.last_name].filter(Boolean).join(" ") ||
              k.company_name ||
              "—";
            return (
              <div
                key={k.id}
                className="grid grid-cols-[minmax(200px,2fr)_120px_100px_100px_140px_140px_60px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/30"
              >
                <div className="min-w-0">
                  <Link href={`/admin/crm/${k.id}`} className="font-medium text-[13px] truncate hover:text-blue">
                    {name}
                  </Link>
                  <div className="text-[11px] text-text-mute">
                    {k.master_agreement_signed_at ? "Umowa podpisana" : "Bez umowy"}
                  </div>
                </div>
                <div className="text-[12px]">
                  <span className="pill pill-mute">
                    {k.account_type === "individual" ? "Indywidualne" : k.account_type === "business" ? "Biznesowe" : "—"}
                  </span>
                </div>
                <div className="text-[13px] num text-text-soft">{agg.submissions}</div>
                <div className="text-[13px] num text-text-soft">{agg.sold}</div>
                <div className="text-[13px] num font-semibold text-mint">{formatPLN(agg.gmv, { decimals: false })}</div>
                <div className="text-[12px] num text-text-soft">{formatPLN(agg.stock, { decimals: false })}</div>
                <div className="text-right">
                  <Link href={`/admin/crm/${k.id}`} className="text-[12px] text-lime hover:underline">
                    →
                  </Link>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-[13px] text-text-soft">
              Brak klientów pasujących do zapytania.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, sub, accent = "" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mt-2 font-light text-[24px] tracking-[-0.02em] num ${accent}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-text-mute">{sub}</div>}
    </div>
  );
}
