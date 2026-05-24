import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type { Product, AppReturn } from "@/lib/types";

/**
 * Lista produktów które klient wycofał z komisu (status='withdrawn').
 * Każda pozycja wystawia "WZ" doc (numer = product.id slice) + powiązanie z
 * wpisem w returns (powód, fee).
 */
export default async function KomisWyciagnietyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
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
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="komis-wyciagniety"
      breadcrumb={[{ label: "Komis wyciągnięty" }]}
    >
      <section>
        <div className="label">{products.length} wycofanych pozycji</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Komis wyciągnięty.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Lista dokumentów WZ (Wydanie Magazynowe) wystawionych przy wycofaniu Twoich produktów z komisu.
          Każdy WZ to potwierdzenie ruchu towaru z magazynu Kickback.
        </p>
      </section>

      {products.length === 0 ? (
        <Empty />
      ) : (
        <section className="mt-10">
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[140px_minmax(220px,3fr)_60px_120px_120px_120px] gap-3 px-4 py-3 label border-b border-border-soft">
              <div>Numer WZ</div>
              <div>Produkt</div>
              <div>Rozm.</div>
              <div>Wartość</div>
              <div>Opłata adm.</div>
              <div>Data WZ</div>
            </div>
            {products.map((p) => {
              const ret = returnById.get(p.id);
              const wzNumber = `WZ-${p.id.slice(0, 8).toUpperCase()}`;
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[140px_minmax(220px,3fr)_60px_120px_120px_120px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
                >
                  <Link href={`/panel/products/${p.id}`} className="text-[13px] num text-blue hover:underline">
                    {wzNumber}
                  </Link>
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{p.brand} · {p.model}</div>
                      {ret && (
                        <div className="text-[11px] text-text-mute truncate">
                          {ret.reason.replace(/_/g, " ")}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[12px] num text-text-soft">{p.size ?? "—"}</div>
                  <div className="text-[13px] font-semibold num">
                    {formatPLN(p.listing_price_cents ?? p.expected_price_cents ?? 0, { decimals: false })}
                  </div>
                  <div className={`text-[13px] num ${ret && ret.fee_cents > 0 ? "text-amber" : "text-text-mute"}`}>
                    {ret && ret.fee_cents > 0 ? formatPLN(ret.fee_cents, { decimals: false }) : "—"}
                  </div>
                  <div className="text-[12px] num text-text-soft">{formatDate(ret?.created_at ?? p.updated_at)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </PanelShell>
  );
}

function Empty() {
  return (
    <section className="mt-10">
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center">
        <div className="font-bold text-xl tracking-[-0.025em]">Brak wycofanych pozycji</div>
        <p className="mt-2 text-text-soft text-[14px]">
          Nie wycofywałeś jeszcze żadnych pozycji z komisu. Wycofania możesz zrobić bulk z poziomu Magazynu.
        </p>
        <div className="mt-6">
          <ButtonLink href="/panel/magazyn" size="md">
            Przejdź do magazynu <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
