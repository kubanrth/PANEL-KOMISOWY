import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import { RETURN_REASON_LABEL, type AppReturn, type Product, type ReturnResolution } from "@/lib/types";

export default async function ZwrotyPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
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
    <>
      <PageHeader
        label={`${returns.length} zwrotów łącznie`}
        title="Zwroty"
        sub="Produkty wycofane z komisu lub odrzucone w A&QC. Każdy zwrot ma powód, datę i ewentualną opłatę administracyjną."
      />

      {returns.length === 0 ? (
        <section className="mt-8">
          <EmptyState
            title="Nic. Twoje koszulki nie wracają."
            sub="Wszystkie Twoje rzeczy są w sprzedaży albo już sprzedane — dokładnie tak, jak ma być."
            action={
              <ButtonLink href="/panel/magazyn" size="md">
                Sprawdź magazyn <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </section>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label="Zwroty łącznie" value={returns.length} />
            <KpiCard
              label="Oczekuje decyzji"
              value={returns.filter((r) => r.resolution === "pending").length}
            />
            <KpiCard
              label="Opłaty"
              value={<span className={totalFee > 0 ? "text-yellow" : ""}>{formatPLN(totalFee, { decimals: false })}</span>}
              mono
            />
          </section>

          <section className="mt-6">
            <div className="card table-scroll">
              <div className="hidden md:grid grid-cols-[minmax(240px,3fr)_60px_120px_170px_100px_140px_110px] gap-3 px-4 h-11 label border-b border-border items-center">
                <div>Produkt</div>
                <div>Rozm.</div>
                <div>Cena</div>
                <div>Powód</div>
                <div>Opłata</div>
                <div>Status</div>
                <div>Zwrócono</div>
              </div>
              {returns.map((r) => {
                const p = productById.get(r.product_id);
                const reasonInfo = RETURN_REASON_LABEL[r.reason];
                const res = resolutionPill(r.resolution);
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-1 md:grid-cols-[minmax(240px,3fr)_60px_120px_170px_100px_140px_110px] gap-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {p && <ProductThumb photos={p.photos} brand={p.brand} size="sm" />}
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium truncate">
                          {p ? `${p.brand} ${p.model}` : "Produkt niedostępny"}
                        </div>
                        {p?.category && (
                          <div className="text-[11px] text-text-mute truncate">{p.category}</div>
                        )}
                      </div>
                    </div>
                    <div className="hidden md:block text-[12px] num text-text-soft">{p?.size ?? "—"}</div>
                    <div className="hidden md:block text-[13px] num">
                      {p ? formatPLN(p.listing_price_cents ?? p.expected_price_cents ?? 0, { decimals: false }) : "—"}
                    </div>
                    <div className="hidden md:block text-[12px] text-text-soft truncate" title={reasonInfo.description}>
                      {reasonInfo.title}
                    </div>
                    <div className={`hidden md:block text-[13px] num ${r.fee_cents > 0 ? "text-yellow" : "text-text-faint"}`}>
                      {r.fee_cents > 0 ? formatPLN(r.fee_cents, { decimals: false }) : "—"}
                    </div>
                    <div>
                      <Pill variant={res.variant}>{res.label}</Pill>
                    </div>
                    <div className="text-[12px] num text-text-soft">{formatDate(r.created_at)}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </>
  );
}

/* Vocab pigułek: yellow = oczekuje, blue = w toku, mint = ok, mute = archiwum. */
function resolutionPill(res: ReturnResolution): { variant: PillVariant; label: string } {
  switch (res) {
    case "pending":
      return { variant: "yellow", label: "Do decyzji" };
    case "pickup_paid":
      return { variant: "blue", label: "Do odbioru" };
    case "returned":
      return { variant: "mint", label: "Odebrane" };
    case "disposal_free":
      return { variant: "mute", label: "Utylizacja" };
    case "cancelled":
      return { variant: "mute", label: "Anulowany" };
  }
}
