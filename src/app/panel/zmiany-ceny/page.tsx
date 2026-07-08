import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type { PriceChangeRequest, PriceChangeStatus, Product } from "@/lib/types";
import { CancelButton } from "./CancelButton";

export default async function ZmianyCenyPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: reqsRaw } = await supabase
    .from("price_change_requests")
    .select("*")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });
  const reqs = (reqsRaw ?? []) as PriceChangeRequest[];

  const productIds = Array.from(new Set(reqs.map((r) => r.product_id)));
  const { data: prodsRaw } = productIds.length
    ? await supabase.from("products").select("id, brand, model, size, photos").in("id", productIds)
    : { data: [] as Array<Pick<Product, "id" | "brand" | "model" | "size" | "photos">> };
  const productById = new Map((prodsRaw ?? []).map((p) => [p.id, p]));

  const counts = {
    pending: reqs.filter((r) => r.status === "pending").length,
    accepted: reqs.filter((r) => r.status === "accepted").length,
    rejected: reqs.filter((r) => r.status === "rejected").length,
  };

  return (
    <>
      <PageHeader
        label={`${reqs.length} sugestii zmiany ceny`}
        title="Zmiany ceny"
        sub="Twoje sugestie zmiany ceny dla aktywnych pozycji. Administrator zatwierdza lub odrzuca każdą zmianę."
      />

      {reqs.length === 0 ? (
        <section className="mt-8">
          <EmptyState
            title="Brak sugestii zmiany ceny"
            sub="Zmiany cen zgłaszasz per pozycja z poziomu Magazynu."
            action={
              <ButtonLink href="/panel/magazyn" size="md">
                Przejdź do magazynu <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </section>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard
              label="Oczekujące"
              value={<span className={counts.pending > 0 ? "text-yellow" : ""}>{counts.pending}</span>}
            />
            <KpiCard
              label="Zaakceptowane"
              value={<span className={counts.accepted > 0 ? "text-mint" : ""}>{counts.accepted}</span>}
            />
            <KpiCard label="Odrzucone" value={counts.rejected} />
          </section>

          {/* Tabela kanoniczna (wzór sprzedaze): Produkt · Zmiana · Powód · Status · Data · Akcja */}
          <section className="mt-6">
            <div className="card table-scroll">
              <div className="hidden md:grid grid-cols-[minmax(200px,2.5fr)_170px_minmax(150px,2fr)_140px_100px_110px] gap-3 px-4 h-11 label border-b border-border items-center">
                <div>Produkt</div>
                <div>Zmiana</div>
                <div>Powód</div>
                <div>Status</div>
                <div>Data</div>
                <div className="text-right">Akcja</div>
              </div>

              {reqs.map((r) => {
                const p = productById.get(r.product_id);
                const status = statusPill(r.status);
                const cur = r.current_price_cents;
                const tone =
                  cur == null
                    ? ""
                    : r.suggested_price_cents < cur
                      ? "text-coral"
                      : r.suggested_price_cents > cur
                        ? "text-mint"
                        : "";
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-1 md:grid-cols-[minmax(200px,2.5fr)_170px_minmax(150px,2fr)_140px_100px_110px] gap-x-3 gap-y-2 md:gap-y-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                  >
                    {/* Produkt */}
                    {p ? (
                      <Link
                        href={`/panel/products/${p.id}`}
                        className="flex items-center gap-3 min-w-0 hover:text-lime transition-colors"
                      >
                        <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-medium truncate">{p.brand} {p.model}</div>
                          {p.size && <div className="text-[11px] num text-text-mute truncate">{p.size}</div>}
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 min-w-0 text-[13.5px] text-text-mute">
                        <ProductThumb photos={null} brand="?" size="sm" />
                        Produkt usunięty
                      </div>
                    )}

                    {/* Zmiana: stara → nowa */}
                    <div className="text-[13px] num whitespace-nowrap">
                      <span className="text-text-mute">
                        {cur != null ? formatPLN(cur, { decimals: false }) : "—"}
                      </span>
                      <span className={`mx-1.5 ${tone || "text-text-mute"}`}>→</span>
                      <span className={`font-medium ${tone}`}>
                        {formatPLN(r.suggested_price_cents, { decimals: false })}
                      </span>
                    </div>

                    {/* Powód — na mobile tylko gdy jest treść */}
                    <div
                      className={`text-[12px] leading-[1.55] text-text-soft line-clamp-2 ${r.notes ? "" : "hidden md:block"}`}
                    >
                      {r.notes ?? "—"}
                    </div>

                    {/* Status */}
                    <div>
                      <Pill variant={status.variant}>{status.label}</Pill>
                    </div>

                    {/* Data (desktop) */}
                    <div className="hidden md:block text-[12px] num text-text-soft">
                      {formatDate(r.created_at)}
                    </div>

                    {/* Akcja + data na mobile */}
                    <div className="flex items-center justify-between md:justify-end gap-3">
                      <span className="md:hidden text-[11px] num text-text-mute">{formatDate(r.created_at)}</span>
                      {r.status === "pending" && <CancelButton requestId={r.id} />}
                    </div>
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

/* Vocab: yellow = oczekuje, mint = ok, coral = odrzucone, mute = anulowane. */
function statusPill(status: PriceChangeStatus): { variant: PillVariant; label: string } {
  switch (status) {
    case "pending":
      return { variant: "yellow", label: "Oczekuje" };
    case "accepted":
      return { variant: "mint", label: "Zaakceptowana" };
    case "rejected":
      return { variant: "coral", label: "Odrzucona" };
    case "cancelled":
      return { variant: "mute", label: "Anulowana" };
  }
}
