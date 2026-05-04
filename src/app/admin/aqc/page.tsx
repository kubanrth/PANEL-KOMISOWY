import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, formatDate, daysFromNow } from "@/lib/format";

export default async function AdminAqcQueuePage() {
  const { user, profile, supabase } = await requireAdmin();

  const { data: productsRaw } = await supabase
    .from("products")
    .select(`
      id, brand, model, condition, expected_price_cents, photos, status, created_at, submission_id,
      submissions ( id, status, klient_id, profiles!klient_id ( first_name, last_name, account_type ) )
    `)
    .in("status", ["draft", "aqc"])
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    brand: string;
    model: string;
    condition: number | null;
    expected_price_cents: number | null;
    photos: Array<{ url: string; name: string }> | null;
    status: string;
    created_at: string;
    submission_id: string;
    submissions?: {
      id: string;
      status: string;
      klient_id: string;
      profiles?: { first_name: string | null; last_name: string | null; account_type: string | null } | null;
    } | null;
  };

  // Supabase types joined relations as arrays; we normalise where used.
  type SubRel = { id: string; status: string; klient_id: string; profiles?: { first_name: string | null; last_name: string | null; account_type: string | null } | { first_name: string | null; last_name: string | null; account_type: string | null }[] | null };
  type RawRow = Omit<Row, "submissions"> & { submissions?: SubRel | SubRel[] | null };
  const productsTyped = (productsRaw ?? []) as unknown as RawRow[];
  const products: Row[] = productsTyped.map((p) => {
    const sub = Array.isArray(p.submissions) ? p.submissions[0] : p.submissions;
    if (!sub) return { ...p, submissions: null };
    const profiles = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
    return { ...p, submissions: { ...sub, profiles: profiles ?? null } };
  });

  return (
    <AdminShell user={user} profile={profile} active="aqc" breadcrumb={[{ label: "A&QC" }]}>
      <section>
        <div className="label">{products.length} produktów do audytu</div>
        <h1 className="mt-4 font-bold text-[40px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
          Authentication & QC <span className="text-text-soft">/ kolejka.</span>
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          12-punktowy audyt każdego produktu. SLA: 5 dni roboczych od dostarczenia.
        </p>
      </section>

      <section className="mt-12">
        {products.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-12 text-center">
            <div className="font-semibold text-2xl">Pusta kolejka</div>
            <p className="mt-2 text-text-soft">Wszystkie produkty zaudytowane.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((p) => {
              const sla = daysFromNow(new Date(new Date(p.created_at).getTime() + 5 * 86_400_000).toISOString());
              const slaCls = sla == null ? "pill-mute" : sla < 1 ? "pill-pink" : sla < 2 ? "pill-amber" : "pill-mute";
              const klientName = [p.submissions?.profiles?.first_name, p.submissions?.profiles?.last_name].filter(Boolean).join(" ") || "—";
              return (
                <Link
                  key={p.id}
                  href={`/admin/aqc/${p.id}`}
                  className="card p-5 flex items-center gap-4 hover:border-purple/40 transition-colors"
                >
                  <ProductThumb photos={p.photos as never} brand={p.brand} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[15px] truncate">
                      {p.brand} <span className="text-text-soft">·</span> {p.model}
                    </div>
                    <div className="text-[12px] text-text-mute mt-1 num">
                      {p.submissions?.id ?? "—"} · {klientName} · stan {p.condition ?? "?"}/10 · {formatDate(p.created_at)}
                    </div>
                  </div>
                  <span className={`pill ${slaCls}`}>SLA {sla != null ? `${sla}d` : "—"}</span>
                  <div className="text-right hidden sm:block min-w-[80px]">
                    <div className="text-[11px] text-text-mute">Oczekiwana</div>
                    <div className="font-semibold text-[14px] num">{formatPLN(p.expected_price_cents ?? 0, { decimals: false })}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
