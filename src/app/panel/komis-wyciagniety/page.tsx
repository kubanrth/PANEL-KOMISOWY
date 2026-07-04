import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import { RETURN_REASON_LABEL, type Product, type AppReturn, type ReturnResolution } from "@/lib/types";

/**
 * Lista produktów które klient wycofał z komisu (status='withdrawn').
 * Każda pozycja wystawia "WZ" doc (numer = product.id slice) + powiązanie z
 * wpisem w returns (powód, fee).
 */
export default async function KomisWyciagnietyPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: productsRaw } = await supabase
    .from("products")
    .select("*")
    .in("status", ["withdrawn", "returned"])
    .order("updated_at", { ascending: false });
  const products = (productsRaw ?? []) as Product[];

  const productIds = products.map((p) => p.id);
  const { data: returnsRaw } = productIds.length
    ? await supabase.from("returns").select("*").in("product_id", productIds)
    : { data: [] as AppReturn[] };
  const returnById = new Map((returnsRaw ?? []).map((r) => [r.product_id, r as AppReturn]));

  return (
    <>
      <PageHeader
        label={`${products.length} wycofanych pozycji`}
        title="Komis wyciągnięty"
        sub="Lista dokumentów WZ (Wydanie Magazynowe) wystawionych przy wycofaniu Twoich produktów z komisu. Każdy WZ to potwierdzenie ruchu towaru z magazynu Kickback."
      />

      {products.length === 0 ? (
        <section className="mt-8">
          <EmptyState
            title="Brak wycofanych pozycji"
            sub="Nie wycofywałeś jeszcze żadnych pozycji z komisu. Wycofania możesz zrobić bulk z poziomu Magazynu."
            action={
              <ButtonLink href="/panel/magazyn" size="md">
                Przejdź do magazynu <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </section>
      ) : (
        <section className="mt-8">
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[140px_minmax(220px,3fr)_60px_110px_100px_140px_110px] gap-3 px-4 h-11 label border-b border-border items-center">
              <div>Numer WZ</div>
              <div>Produkt</div>
              <div>Rozm.</div>
              <div>Wartość</div>
              <div>Opłata adm.</div>
              <div>Odbiór</div>
              <div>Data WZ</div>
            </div>
            {products.map((p) => {
              const ret = returnById.get(p.id);
              const wzNumber = `WZ-${p.id.slice(0, 8).toUpperCase()}`;
              const pickup = pickupPill(ret?.resolution);
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-1 md:grid-cols-[140px_minmax(220px,3fr)_60px_110px_100px_140px_110px] gap-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <Link
                    href={`/panel/products/${p.id}`}
                    className="text-[13px] num font-medium hover:text-lime transition-colors"
                  >
                    {wzNumber}
                  </Link>
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium truncate">{p.brand} {p.model}</div>
                      {ret && (
                        <div className="text-[11px] text-text-mute truncate">
                          {RETURN_REASON_LABEL[ret.reason].title}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="hidden md:block text-[12px] num text-text-soft">{p.size ?? "—"}</div>
                  <div className="hidden md:block text-[13px] num">
                    {formatPLN(p.listing_price_cents ?? p.expected_price_cents ?? 0, { decimals: false })}
                  </div>
                  <div className={`hidden md:block text-[13px] num ${ret && ret.fee_cents > 0 ? "text-yellow" : "text-text-faint"}`}>
                    {ret && ret.fee_cents > 0 ? formatPLN(ret.fee_cents, { decimals: false }) : "—"}
                  </div>
                  <div>
                    <Pill variant={pickup.variant}>{pickup.label}</Pill>
                  </div>
                  <div className="text-[12px] num text-text-soft">{formatDate(ret?.created_at ?? p.updated_at)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

/* Status odbioru z returns.resolution — vocab: yellow = oczekuje,
   blue = w toku, mint = odebrane/ok, mute = archiwum. */
function pickupPill(res: ReturnResolution | undefined): { variant: PillVariant; label: string } {
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
    default:
      return { variant: "mute", label: "Archiwum" };
  }
}
