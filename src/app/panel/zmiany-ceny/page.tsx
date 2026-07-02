import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type { PriceChangeRequest, PriceChangeStatus, Product } from "@/lib/types";
import { CancelButton } from "./CancelButton";

export default async function ZmianyCenyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
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
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="zmiany-ceny"
      breadcrumb={[{ label: "Zmiany ceny" }]}
    >
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

          {/* Timeline zmian: avatar-badge kto · stara → nowa cena · powód · data */}
          <section className="mt-6">
            <div className="card p-6">
              <ol className="space-y-0">
                {reqs.map((r, i) => {
                  const p = productById.get(r.product_id);
                  const last = i === reqs.length - 1;
                  const who = r.requested_by === user.id ? "TY" : "KICKBACK";
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
                    <li key={r.id} className="relative pl-12 pb-6 last:pb-0">
                      {!last && (
                        <span className="absolute left-[14px] top-9 bottom-0 w-px bg-border" aria-hidden />
                      )}
                      {/* Avatar-badge: kto zgłosił */}
                      <span
                        className="absolute left-0 top-0 h-7 w-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[8px] font-semibold tracking-[0.04em] text-text-soft"
                        aria-hidden
                      >
                        {who}
                      </span>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-[13.5px] font-medium">
                          {p ? `${p.brand} ${p.model}` : "Produkt usunięty"}
                        </span>
                        {p?.size && <span className="text-[11px] num text-text-mute">{p.size}</span>}
                        <Pill variant={status.variant}>{status.label}</Pill>
                      </div>

                      <div className="mt-1.5 text-[14px] num">
                        <span className="text-text-mute">
                          {cur != null ? formatPLN(cur, { decimals: false }) : "—"}
                        </span>
                        <span className={`mx-2 ${tone || "text-text-mute"}`}>→</span>
                        <span className={`font-medium ${tone}`}>
                          {formatPLN(r.suggested_price_cents, { decimals: false })}
                        </span>
                      </div>

                      {r.notes && (
                        <div className="mt-1 text-[12px] leading-[1.55] text-text-soft">{r.notes}</div>
                      )}

                      <div className="mt-1.5 flex items-center gap-4">
                        <span className="text-[11px] num text-text-mute">{formatDate(r.created_at)}</span>
                        {r.status === "pending" && <CancelButton requestId={r.id} />}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        </>
      )}
    </PanelShell>
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
