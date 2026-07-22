import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmissionStatusPill, ProductStatusPill } from "@/components/panel/StatusPill";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { StageForm } from "./StageForm";
import { formatPLN, formatDate } from "@/lib/format";
import { PRODUCT_STAGES, type Product, type Submission } from "@/lib/types";

/* Zarządzanie towarem (admin) — pozycje submission z formularzem etapu.
   Etapy aktualizuje infrastruktura (magazyn); 'Listing' wystawia produkt
   do sprzedaży i pushuje do Fakturowni (następca A&QC). */

export default async function AdminSubmissionDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: submissionRaw } = await supabase
    .from("submissions")
    .select("id, status, klient_id, commission_rate, signed_method, created_at, profiles:klient_id ( first_name, last_name )")
    .eq("id", id)
    .maybeSingle();
  if (!submissionRaw) notFound();
  type SubRow = Submission & { profiles?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null };
  const submission = submissionRaw as unknown as SubRow;
  const prof = Array.isArray(submission.profiles) ? submission.profiles[0] : submission.profiles;
  const klientName = [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "—";

  const { data: productsRaw } = await supabase
    .from("products")
    .select("id, brand, model, size, sku, status, stage, photos, listing_price_cents, expected_price_cents")
    .eq("submission_id", id)
    .order("created_at", { ascending: true });
  const products = (productsRaw ?? []) as Product[];

  const stageIndex = (key: string) => PRODUCT_STAGES.findIndex((s) => s.key === key);

  return (
    <>
      <PageHeader
        label={`${klientName} · ${formatDate(submission.created_at)} · prowizja ${Math.round(submission.commission_rate * 100)}%`}
        title={submission.id}
        sub="Zarządzanie towarem — etapy aktualizowane z infrastruktury. Etap „Listing” wystawia produkt do sprzedaży i wysyła go do Fakturowni."
      />
      <div className="mt-4 flex items-center gap-3">
        <SubmissionStatusPill status={submission.status} />
        <Link href={`/admin/klienci/${submission.klient_id}`} className="text-[13px] text-text-soft hover:text-lime transition-colors">
          Profil komisanta →
        </Link>
      </div>

      <section className="mt-8">
        <div className="label mb-4">Pozycje · {products.length}</div>
        {products.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Brak pozycji w tej submission.
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((p) => {
              const idx = stageIndex(p.stage);
              return (
                <div key={p.id} className="card p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <ProductThumb photos={p.photos as never} brand={p.brand} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[15px] truncate">{p.brand} · {p.model}</div>
                      <div className="mt-1 text-[12px] text-text-mute num">
                        {p.sku}{p.size ? ` · ${p.size}` : ""} · {formatPLN(p.listing_price_cents ?? p.expected_price_cents ?? 0, { decimals: false })}
                      </div>
                    </div>
                    <ProductStatusPill status={p.status} />
                    <StageForm productId={p.id} stage={p.stage} />
                  </div>

                  {/* Pasek postępu etapów — 9 kroków */}
                  <div className="mt-4 flex items-center gap-1.5" aria-label={`Etap ${idx + 1} z ${PRODUCT_STAGES.length}`}>
                    {PRODUCT_STAGES.map((s, i) => (
                      <div
                        key={s.key}
                        title={s.label}
                        className={`h-1.5 flex-1 rounded-full ${
                          i < idx ? "bg-lime/50" : i === idx ? "bg-lime" : "bg-surface-2"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-text-mute">
                    Etap {idx + 1}/{PRODUCT_STAGES.length}: <span className="text-text-soft">{PRODUCT_STAGES[idx]?.label ?? "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
