import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ProductStatusPill, SubmissionStatusPill } from "@/components/panel/StatusPill";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink } from "@/components/ui/Button";
import { formatPLN, formatDate, takeHomeCents, commissionCents } from "@/lib/format";
import type { Product, Submission, Profile } from "@/lib/types";

export default async function ProductDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle<Pick<Profile, "first_name" | "last_name" | "account_type" | "onboarded_at">>();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle<Product>();
  if (!product) notFound();

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, status, signed_method, commission_rate, created_at")
    .eq("id", product.submission_id)
    .maybeSingle<Pick<Submission, "id" | "status" | "signed_method" | "commission_rate" | "created_at">>();

  const price = product.listing_price_cents ?? product.expected_price_cents ?? 0;
  const commission = submission?.commission_rate ?? 0.2;
  const commissionAmount = commissionCents(price, commission) ?? 0;
  const takeHome = takeHomeCents(price, commission) ?? 0;

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="my-sales"
      breadcrumb={[
        { label: "My Sales", href: "/panel/my-sales" },
        { label: `${product.brand} · ${product.model}` },
      ]}
    >
      {/* Hero */}
      <section>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <ProductStatusPill status={product.status} />
          {submission && (
            <Link href={`/panel/submissions/${submission.id}`} className="pill pill-mute hover:bg-surface-2 transition-colors num">
              {submission.id}
            </Link>
          )}
          {submission && <SubmissionStatusPill status={submission.status} />}
        </div>
        <h1 className="font-bold text-[28px] lg:text-[40px] leading-[1.02] tracking-[-0.04em]">
          {product.brand}
        </h1>
        <p className="mt-2 text-[20px] lg:text-[24px] text-text-soft tracking-[-0.025em]">
          {product.model}
        </p>
      </section>

      {/* Photos + sidebar */}
      <section className="mt-12 grid grid-cols-12 gap-8">

        {/* Photos */}
        <div className="col-span-12 lg:col-span-7">
          <Gallery product={product} />
        </div>

        {/* Pricing card */}
        <aside className="col-span-12 lg:col-span-5 space-y-5">
          <div className="card-gradient-blue p-7 rounded-[20px] text-white">
            <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">
              Cena listing
            </div>
            <div className="mt-2 font-bold text-4xl tracking-[-0.04em] num">
              {formatPLN(price, { decimals: false })}
            </div>
            {product.expected_price_cents != null && product.expected_price_cents !== price && (
              <div className="mt-1 text-white/70 text-[13px] num">
                Oczekiwana: {formatPLN(product.expected_price_cents, { decimals: false })}
              </div>
            )}
            <div className="mt-6 pt-5 border-t border-white/20 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-white/85">Prowizja Kickback ({Math.round(commission * 100)}%)</span>
                <span className="font-semibold num">−{formatPLN(commissionAmount, { decimals: false })}</span>
              </div>
              <div className="flex justify-between text-base pt-2 border-t border-white/15">
                <span className="text-white/85">Twój udział</span>
                <span className="font-bold tracking-[-0.025em] num">{formatPLN(takeHome, { decimals: false })}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="label mb-4">Specyfikacja</div>
            <SpecRow label="Kategoria" value={product.category} />
            <SpecRow label="Rozmiar" value={product.size} />
            <SpecRow label="Stan" value={product.condition ? `${product.condition}/10` : null} />
            <SpecRow label="Cena minimalna" value={product.min_price_cents != null ? formatPLN(product.min_price_cents, { decimals: false }) : null} />
            <SpecRow label="ID produktu" value={product.id.slice(0, 8) + "…"} />
          </div>
        </aside>
      </section>

      {/* Description */}
      {product.description && (
        <section className="mt-10">
          <div className="label mb-3">Opis</div>
          <div className="card p-6 text-[15px] leading-[1.7] text-text-soft whitespace-pre-wrap">
            {product.description}
          </div>
        </section>
      )}

      {/* A&QC placeholder (Sesja 6) */}
      <section className="mt-10">
        <div className="label mb-3">Authentication & Quality Control</div>
        <div className="card p-6">
          {product.status === "draft" ? (
            <div className="text-[14px] text-text-soft">
              Audyt rozpocznie się po dostarczeniu pakunku do magazynu Kickback. Otrzymasz powiadomienie z wyceną w ciągu 3 dni roboczych.
            </div>
          ) : (
            <div className="text-[14px] text-text-soft">
              Pełen raport A&QC (12 punktów + uzasadnienie) dostępny w kolejnej iteracji panelu.
            </div>
          )}
        </div>
      </section>

      {/* Actions */}
      <section className="mt-12 flex items-center gap-4 flex-wrap">
        <ButtonLink href={submission ? `/panel/submissions/${submission.id}` : "/panel/submissions"} variant="ghost" size="md">
          ← Wróć do Submission
        </ButtonLink>
      </section>
    </PanelShell>
  );
}

function SpecRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between py-2.5 border-b border-border-soft last:border-0">
      <span className="text-[13px] text-text-soft">{label}</span>
      <span className="text-[14px] font-medium num">{value ?? "—"}</span>
    </div>
  );
}

function Gallery({ product }: { product: Product }) {
  const photos = product.photos ?? [];

  if (photos.length === 0) {
    return (
      <div
        className="aspect-[4/3] rounded-[20px] flex flex-col items-center justify-center text-white"
        style={{ background: "linear-gradient(135deg,#13141A 0%, #0A0B10 100%)" }}
      >
        <ProductThumb photos={[]} brand={product.brand} size="lg" />
        <div className="mt-4 text-[14px] text-text-mute">Brak zdjęć</div>
      </div>
    );
  }

  // Layout: hero + grid of thumbs
  const [hero, ...rest] = photos;
  return (
    <div>
      <div className="aspect-[4/3] rounded-[20px] overflow-hidden border border-border bg-surface relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero.url} alt={`${product.brand} ${product.model}`} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      {rest.length > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-3">
          {rest.slice(0, 5).map((p, i) => (
            <div key={p.url + i} className="aspect-square rounded-[10px] overflow-hidden border border-border bg-surface relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`${product.brand} ${i + 2}`} className="absolute inset-0 w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
