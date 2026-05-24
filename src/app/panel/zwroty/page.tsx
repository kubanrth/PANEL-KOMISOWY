import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import { RETURN_REASON_LABEL, type AppReturn, type Product } from "@/lib/types";

export default async function ZwrotyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  // Returns table — RLS via products (klient widzi swoje przez submission)
  const { data: returnsRaw } = await supabase
    .from("returns")
    .select("*")
    .order("created_at", { ascending: false });
  const returns = (returnsRaw ?? []) as AppReturn[];

  const productIds = returns.map((r) => r.product_id);
  const { data: prodsRaw } = productIds.length
    ? await supabase.from("products").select("*").in("id", productIds)
    : { data: [] as Product[] };
  const products = (prodsRaw ?? []) as Product[];
  const productById = new Map(products.map((p) => [p.id, p]));

  const totalFee = returns.reduce((acc, r) => acc + r.fee_cents, 0);

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="zwroty"
      breadcrumb={[{ label: "Zwroty" }]}
    >
      <section>
        <div className="label">{returns.length} zwrotów łącznie</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Zwroty <span className="text-text-soft">/ wycofane pozycje.</span>
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Produkty wycofane z komisu lub odrzucone w A&amp;QC. Każdy zwrot ma powód, datę i ewentualną opłatę administracyjną.
        </p>
      </section>

      {returns.length === 0 ? (
        <Empty />
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi label="Zwroty łącznie" value={returns.length.toString()} />
            <Kpi label="Oczekuje decyzji" value={returns.filter((r) => r.resolution === "pending").length.toString()} />
            <Kpi label="Opłaty" value={formatPLN(totalFee, { decimals: false })} accent="text-amber" />
          </section>

          <section className="mt-8">
            <div className="card table-scroll">
              <div className="hidden md:grid grid-cols-[minmax(240px,3fr)_60px_140px_180px_120px_120px] gap-3 px-4 py-3 label border-b border-border-soft">
                <div>Produkt</div>
                <div>Rozm.</div>
                <div>Cena</div>
                <div>Powód</div>
                <div>Opłata</div>
                <div>Zwrócono</div>
              </div>
              {returns.map((r) => {
                const p = productById.get(r.product_id);
                const reasonInfo = RETURN_REASON_LABEL[r.reason];
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[minmax(240px,3fr)_60px_140px_180px_120px_120px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {p && <ProductThumb photos={p.photos} brand={p.brand} size="sm" />}
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">
                          {p ? `${p.brand} · ${p.model}` : "Produkt niedostępny"}
                        </div>
                        <div className="text-[11px] text-text-mute num">
                          {p?.category ?? ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-[12px] num text-text-soft">{p?.size ?? "—"}</div>
                    <div className="text-[13px] font-semibold num">
                      {p ? formatPLN(p.listing_price_cents ?? p.expected_price_cents ?? 0, { decimals: false }) : "—"}
                    </div>
                    <div className="text-[12px] text-text-soft" title={reasonInfo.description}>
                      {reasonInfo.title}
                    </div>
                    <div className={`text-[13px] num ${r.fee_cents > 0 ? "text-amber" : "text-text-mute"}`}>
                      {r.fee_cents > 0 ? formatPLN(r.fee_cents, { decimals: false }) : "—"}
                    </div>
                    <div className="text-[12px] num text-text-soft">{formatDate(r.created_at)}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </PanelShell>
  );
}

function Kpi({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mt-2 font-bold text-2xl tracking-[-0.035em] num ${accent}`}>{value}</div>
    </div>
  );
}

function Empty() {
  return (
    <section className="mt-10">
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center">
        <div className="font-bold text-xl tracking-[-0.025em]">Brak zwrotów</div>
        <p className="mt-2 text-text-soft text-[14px]">Świetnie — wszystkie Twoje rzeczy są w sprzedaży lub sprzedane.</p>
        <div className="mt-6">
          <ButtonLink href="/panel/magazyn" size="md">
            Sprawdź magazyn <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
