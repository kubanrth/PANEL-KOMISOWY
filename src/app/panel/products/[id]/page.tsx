import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { ProductStatusPill, SubmissionStatusPill } from "@/components/panel/StatusPill";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink } from "@/components/ui/Button";
import { formatPLN, formatDate, takeHomeCents, commissionCents } from "@/lib/format";
import type { Product, Submission, Profile } from "@/lib/types";

/* Karta produktu — design C8: galeria 60/40, spec lista, karta ceny
   z podziałem prowizji, pionowy timeline statusów, akcje. */

export default async function ProductDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
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

  const canWithdraw = product.status === "listed" || product.status === "aqc" || product.status === "offer";

  return (
    <>
      {/* Hero */}
      <section>
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <ProductStatusPill status={product.status} />
          {submission && (
            <Link href={`/panel/submissions/${submission.id}`} className="pill pill-mute hover:bg-surface-2 transition-colors num normal-case !tracking-normal">
              {submission.id}
            </Link>
          )}
          {submission && <SubmissionStatusPill status={submission.status} />}
        </div>
        <div className="label">{product.sku}</div>
        <h1 className="mt-2 font-light text-[28px] lg:text-[40px] leading-[1.05] tracking-[-0.02em]">
          {product.brand} {product.model}.
        </h1>
      </section>

      {/* Photos + sidebar */}
      <section className="mt-10 grid grid-cols-12 gap-6 items-start">
        {/* Photos */}
        <div className="col-span-12 lg:col-span-7">
          <Gallery product={product} />

          {/* Opis pod galerią */}
          {product.description && (
            <div className="mt-6">
              <div className="label mb-3">Opis</div>
              <div className="card p-6 text-[14px] leading-[1.7] text-text-soft whitespace-pre-wrap">
                {product.description}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: cena → spec → timeline → akcje */}
        <aside className="col-span-12 lg:col-span-5 space-y-4">
          <div className="card-gradient-dark p-7 relative overflow-hidden">
            <div className="glow-blob" aria-hidden />
            <div className="relative">
              <div className="label !text-mint/80">Cena listing</div>
              <div className="mt-2 font-light text-[38px] leading-none tracking-[-0.02em] num text-mint">
                {formatPLN(price, { decimals: false })}
              </div>
              {product.expected_price_cents != null && product.expected_price_cents !== price && (
                <div className="mt-2 text-text-soft text-[12px] num">
                  Oczekiwana: {formatPLN(product.expected_price_cents, { decimals: false })}
                </div>
              )}
              <div className="mt-6 pt-5 border-t border-white/10 space-y-2.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-text-soft">Prowizja Kickback ({Math.round(commission * 100)}%)</span>
                  <span className="num text-coral">−{formatPLN(commissionAmount, { decimals: false })}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2.5 border-t border-white/8">
                  <span className="text-text-soft">Twój udział</span>
                  <span className="font-medium text-[18px] tracking-[-0.02em] num text-mint">
                    {formatPLN(takeHome, { decimals: false })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="label mb-4">Specyfikacja</div>
            <SpecRow label="Kategoria" value={product.category} />
            <SpecRow label="Rozmiar" value={product.size} />
            <SpecRow label="Stan" value={product.condition ? `${product.condition}/10` : null} />
            <SpecRow label="Cena minimalna" value={product.min_price_cents != null ? formatPLN(product.min_price_cents, { decimals: false }) : null} />
            <SpecRow label="SKU" value={product.sku} mono />
          </div>

          {/* Timeline statusów */}
          <div className="card p-6">
            <div className="label mb-4">Historia</div>
            <Timeline product={product} />
          </div>

          {/* Akcje */}
          <div className="flex items-center gap-3 flex-wrap">
            <ButtonLink href="/panel/magazyn" variant="ghost" size="md">
              Zmień cenę
            </ButtonLink>
            {canWithdraw && (
              <ButtonLink href={`/panel/products/${product.id}/withdraw`} variant="danger" size="md">
                Wycofaj z komisu
              </ButtonLink>
            )}
          </div>
        </aside>
      </section>

      {/* A&QC */}
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
    </>
  );
}

function SpecRow({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-2.5 border-b border-border-soft last:border-0">
      <span className="text-[13px] text-text-soft">{label}</span>
      <span className={`text-[13px] ${mono ? "num text-text-mute" : "font-medium"}`}>{value ?? "—"}</span>
    </div>
  );
}

/* Pionowy timeline: lime dot done, hollow pending (wzór E1/C8). */
function Timeline({ product }: { product: Product }) {
  const steps: Array<{ label: string; at: string | null }> = [
    { label: "Przyjęta do komisu", at: product.created_at },
    { label: "Wystawiona w sklepie", at: product.published_at },
    { label: "Sprzedana", at: product.sold_at },
    { label: "Rozliczona", at: product.settlement_at },
  ];
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const done = Boolean(s.at);
        const last = i === steps.length - 1;
        return (
          <li key={s.label} className="relative pl-6 pb-4 last:pb-0">
            {!last && (
              <span className="absolute left-[5px] top-4 bottom-0 w-px bg-border" aria-hidden />
            )}
            <span
              className={`absolute left-0 top-1 h-[11px] w-[11px] rounded-full ${
                done ? "bg-lime" : "border border-border bg-transparent"
              }`}
              aria-hidden
            />
            <div className={`text-[13px] ${done ? "" : "text-text-mute"}`}>{s.label}</div>
            {s.at && <div className="text-[11px] num text-text-mute mt-0.5">{formatDate(s.at)}</div>}
          </li>
        );
      })}
    </ol>
  );
}

function Gallery({ product }: { product: Product }) {
  const photos = product.photos ?? [];

  if (photos.length === 0) {
    return (
      <div className="aspect-[4/3] rounded-[20px] flex flex-col items-center justify-center bg-surface border border-border">
        <ProductThumb photos={[]} brand={product.brand} size="lg" />
        <div className="mt-4 text-[13px] text-text-mute">Brak zdjęć</div>
      </div>
    );
  }

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
            <div key={p.url + i} className="aspect-square rounded-[12px] overflow-hidden border border-border bg-surface relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`${product.brand} ${i + 2}`} className="absolute inset-0 w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
