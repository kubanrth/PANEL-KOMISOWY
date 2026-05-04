import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, formatDate } from "@/lib/format";
import type { Product, AqcAudit } from "@/lib/types";
import { AqcInspectionForm } from "./AqcInspectionForm";

export default async function AdminAqcDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { user, profile, supabase } = await requireAdmin();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle<Product>();
  if (!product) notFound();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, klient_id, signed_method, commission_rate, created_at, profiles!klient_id (first_name, last_name, account_type)")
    .eq("id", product.submission_id)
    .maybeSingle();

  const { data: existingAudit } = await supabase
    .from("aqc_audits")
    .select("*")
    .eq("product_id", id)
    .maybeSingle<AqcAudit>();

  // Comparable products (same brand, condition >= 7) for pricing reference
  const { data: comparables } = await supabase
    .from("products")
    .select("brand, model, condition, listing_price_cents, expected_price_cents, status, updated_at")
    .eq("brand", product.brand)
    .neq("id", product.id)
    .in("status", ["listed", "sold"])
    .order("updated_at", { ascending: false })
    .limit(5);

  type SubData = { profiles?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null };
  const subProfiles = (submission as unknown as SubData | null)?.profiles;
  const profileObj = Array.isArray(subProfiles) ? subProfiles[0] : subProfiles;
  const klientName = [profileObj?.first_name, profileObj?.last_name].filter(Boolean).join(" ") || "—";

  return (
    <AdminShell
      user={user}
      profile={profile}
      active="aqc"
      breadcrumb={[{ label: "A&QC", href: "/admin/aqc" }, { label: `${product.brand} · ${product.model}` }]}
    >
      <section className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-12 lg:col-span-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="pill pill-mute">SUB · {submission?.id ?? "—"}</span>
            <span className="pill pill-blue">{klientName}</span>
            <span className="pill pill-mute">stan {product.condition ?? "?"}/10</span>
          </div>
          <h1 className="font-bold text-[40px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
            {product.brand}
          </h1>
          <p className="mt-2 text-[20px] text-text-soft">{product.model}</p>
          {product.description && (
            <p className="mt-4 text-[14px] text-text-soft max-w-[60ch] leading-[1.6]">{product.description}</p>
          )}
        </div>
        <div className="col-span-12 lg:col-span-4">
          <Gallery photos={product.photos} brand={product.brand} />
        </div>
      </section>

      <section className="mt-12">
        <AqcInspectionForm
          productId={product.id}
          initialScores={(existingAudit?.scores as Record<string, number>) ?? {}}
          initialVerdict={existingAudit?.verdict ?? "pass"}
          initialNotes={existingAudit?.notes ?? ""}
          initialPriceCents={existingAudit?.recommended_price_cents ?? product.expected_price_cents ?? 0}
          alreadyDone={!!existingAudit?.decided_at}
          comparables={(comparables ?? []) as Array<{ brand: string; model: string; condition: number | null; listing_price_cents: number | null; expected_price_cents: number | null; status: string; updated_at: string }>}
        />
      </section>
    </AdminShell>
  );
}

function Gallery({ photos, brand }: { photos: Product["photos"]; brand: string }) {
  if (!photos || photos.length === 0) {
    return (
      <div className="aspect-square rounded-[16px] bg-surface-2 border border-border flex items-center justify-center">
        <ProductThumb photos={[]} brand={brand} size="lg" />
      </div>
    );
  }
  const [hero, ...rest] = photos;
  return (
    <div>
      <div className="aspect-square rounded-[16px] overflow-hidden border border-border relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero.url} alt={brand} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      {rest.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {rest.slice(0, 4).map((p, i) => (
            <div key={p.url + i} className="aspect-square rounded-[8px] overflow-hidden border border-border relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
