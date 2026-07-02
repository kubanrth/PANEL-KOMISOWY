import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, formatDate, daysFromNow } from "@/lib/format";
import { RETURN_REASON_LABEL } from "@/lib/types";
import { resolveReturn } from "./actions";

export default async function AdminReturnsPage() {
  const { user, profile, supabase } = await requireAdmin();

  const { data: returnsRaw } = await supabase
    .from("returns")
    .select(`
      id, reason, fee_cents, decision_deadline, resolution, notes, created_at,
      products ( id, brand, model, photos, condition, submission_id ),
      profiles:initiated_by ( first_name, last_name )
    `)
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    reason: keyof typeof RETURN_REASON_LABEL;
    fee_cents: number;
    decision_deadline: string | null;
    resolution: string;
    notes: string | null;
    created_at: string;
    products?: { id: string; brand: string; model: string; photos: Array<{ url: string; name: string }> | null; condition: number | null; submission_id: string } | null;
    profiles?: { first_name: string | null; last_name: string | null } | null;
  };

  type RawRow = Omit<Row, "products" | "profiles"> & {
    products?: Row["products"] | Row["products"][] | null;
    profiles?: Row["profiles"] | Row["profiles"][] | null;
  };
  const returns: Row[] = ((returnsRaw ?? []) as unknown as RawRow[]).map((r) => ({
    ...r,
    products: Array.isArray(r.products) ? r.products[0] ?? null : (r.products ?? null),
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : (r.profiles ?? null),
  }));
  const pending = returns.filter((r) => r.resolution === "pending");
  const resolved = returns.filter((r) => r.resolution !== "pending");

  return (
    <AdminShell user={user} profile={profile} active="returns" breadcrumb={[{ label: "Returns" }]}>
      <PageHeader label={`${pending.length} czeka · ${resolved.length} rozwiązanych`} title="Returns" sub="Zwroty od kupujących i wycofania — decyzje i historia." />

      {/* Pending */}
      <section className="mt-8">
        <div className="label mb-5">Wymagające decyzji</div>
        {pending.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Brak zwrotów oczekujących.
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => {
              const reasonInfo = RETURN_REASON_LABEL[r.reason];
              const deadline = r.decision_deadline ? daysFromNow(r.decision_deadline) : null;
              return (
                <div key={r.id} className="card p-6 grid grid-cols-12 gap-5 items-center">
                  <div className="col-span-12 md:col-span-5 flex items-center gap-4">
                    {r.products && (
                      <ProductThumb photos={r.products.photos as never} brand={r.products.brand} size="md" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-[15px] truncate">{r.products?.brand} · {r.products?.model}</div>
                      <div className="text-[11px] text-text-mute mt-1 num">{formatDate(r.created_at)}</div>
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <div className="text-[13px] font-semibold">{reasonInfo.title}</div>
                    <div className="text-[12px] text-text-soft mt-0.5 line-clamp-2">{reasonInfo.description}</div>
                  </div>

                  <div className="col-span-6 md:col-span-1 text-center">
                    <div className="text-[11px] text-text-mute">Opłata</div>
                    <div className="font-semibold text-[14px] num">{formatPLN(r.fee_cents, { decimals: false })}</div>
                  </div>

                  <div className="col-span-6 md:col-span-2 text-right">
                    <div className="text-[11px] text-text-mute">SLA decyzji</div>
                    <div className="text-[13px] num">{deadline != null ? `${deadline}d` : "—"}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5 justify-end">
                      <form action={resolveReturn}>
                        <input type="hidden" name="return_id" value={r.id} />
                        <input type="hidden" name="resolution" value="pickup_paid" />
                        <button className="text-[11px] px-2.5 py-1 rounded-[8px] bg-blue/10 text-blue-soft hover:bg-blue/20 transition-colors">Odbiór</button>
                      </form>
                      <form action={resolveReturn}>
                        <input type="hidden" name="return_id" value={r.id} />
                        <input type="hidden" name="resolution" value="disposal_free" />
                        <button className="text-[11px] px-2.5 py-1 rounded-[8px] bg-surface-2 text-text-soft hover:bg-surface-3 transition-colors">Utylizacja</button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section className="mt-12">
          <div className="label mb-5">Rozwiązane · {resolved.length}</div>
          <div className="card table-scroll">
            {resolved.slice(0, 10).map((r, i) => {
              const reasonInfo = RETURN_REASON_LABEL[r.reason];
              return (
                <div
                  key={r.id}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center ${
                    i < resolved.length - 1 ? "border-b border-border-soft" : ""
                  }`}
                >
                  <div className="col-span-4 text-[14px]">
                    {r.products?.brand} · {r.products?.model}
                  </div>
                  <div className="col-span-4 text-[12px] text-text-soft">{reasonInfo.title}</div>
                  <div className="col-span-2 text-[12px] text-text-mute num">{formatDate(r.created_at)}</div>
                  <div className="col-span-2 text-right">
                    <span className="pill pill-mute">{r.resolution}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reason reference */}
      <section className="mt-12">
        <div className="label mb-5">Polityka zwrotów · 6 powodów</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(RETURN_REASON_LABEL).map(([key, info]) => (
            <div key={key} className="card p-5">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-semibold text-[14px]">{info.title}</span>
                <span className="font-bold text-[14px] num">
                  {info.fee === 0 ? "GRATIS" : formatPLN(info.fee, { decimals: false })}
                </span>
              </div>
              <div className="text-[12px] text-text-soft leading-[1.5]">{info.description}</div>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
