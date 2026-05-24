import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, formatDate } from "@/lib/format";
import type { PriceChangeRequest, Product } from "@/lib/types";
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
      <section>
        <div className="label">{reqs.length} sugestii zmiany ceny</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Zmiany ceny.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Twoje sugestie zmiany ceny dla aktywnych pozycji. Administrator zatwierdza lub odrzuca każdą zmianę.
        </p>
      </section>

      {reqs.length === 0 ? (
        <div className="mt-10 card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center">
          <div className="font-bold text-xl tracking-[-0.025em]">Brak sugestii zmiany ceny</div>
          <p className="mt-2 text-text-soft text-[14px]">
            Zmiany cen możesz zgłaszać per pozycja z poziomu{" "}
            <Link href="/panel/magazyn" className="text-blue hover:underline">Magazynu</Link>.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi label="Oczekujące" value={counts.pending.toString()} accent="text-amber" />
            <Kpi label="Zaakceptowane" value={counts.accepted.toString()} accent="text-mint" />
            <Kpi label="Odrzucone" value={counts.rejected.toString()} />
          </section>

          <section className="mt-8">
            <div className="card overflow-hidden">
              <div className="hidden md:grid grid-cols-[minmax(220px,3fr)_44px_120px_120px_120px_120px_140px] gap-3 px-4 py-3 label border-b border-border-soft">
                <div>Produkt</div>
                <div>Il.</div>
                <div>Twoja cena</div>
                <div>Sugerowana</div>
                <div>Status</div>
                <div>Data</div>
                <div className="text-right">Akcje</div>
              </div>
              {reqs.map((r) => {
                const p = productById.get(r.product_id);
                const variant =
                  r.status === "accepted"
                    ? "mint"
                    : r.status === "pending"
                      ? "amber"
                      : "mute";
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[minmax(220px,3fr)_44px_120px_120px_120px_120px_140px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {p && <ProductThumb photos={p.photos} brand={p.brand} size="sm" />}
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">
                          {p ? `${p.brand} · ${p.model}` : "Produkt usunięty"}
                        </div>
                        {p?.size && <div className="text-[11px] text-text-mute num">{p.size}</div>}
                      </div>
                    </div>
                    <div className="text-[13px] num text-text-soft">1</div>
                    <div className="text-[13px] num text-text-mute line-through">
                      {r.current_price_cents ? formatPLN(r.current_price_cents, { decimals: false }) : "—"}
                    </div>
                    <div className="text-[13px] num font-semibold text-blue">
                      {formatPLN(r.suggested_price_cents, { decimals: false })}
                    </div>
                    <div>
                      <span className={`pill pill-${variant}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${variant === "mint" ? "bg-mint" : variant === "amber" ? "bg-amber" : "bg-text-mute"}`} />
                        {r.status === "pending" ? "Oczekuje" : r.status === "accepted" ? "Zaakceptowana" : r.status === "rejected" ? "Odrzucona" : "Anulowana"}
                      </span>
                    </div>
                    <div className="text-[12px] num text-text-soft">{formatDate(r.created_at)}</div>
                    <div className="text-right">
                      {r.status === "pending" ? (
                        <CancelButton requestId={r.id} />
                      ) : (
                        <span className="text-[11px] text-text-faint">—</span>
                      )}
                    </div>
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
