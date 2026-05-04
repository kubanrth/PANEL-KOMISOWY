import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { SubmissionStatusPill, ProductStatusPill } from "@/components/panel/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, formatDate, formatDateTime, takeHomeCents } from "@/lib/format";
import type { Submission, Product, Profile } from "@/lib/types";

export default async function SubmissionDetailPage(props: {
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
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: submission } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle<Submission>();

  if (!submission) notFound();

  const { data: productsRaw } = await supabase
    .from("products")
    .select("*")
    .eq("submission_id", id)
    .order("created_at", { ascending: true });

  const products = (productsRaw ?? []) as Product[];

  const totalGross = products.reduce(
    (acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0),
    0,
  );
  const totalTakeHome = products.reduce(
    (acc, p) => acc + (takeHomeCents(p.listing_price_cents ?? p.expected_price_cents ?? 0, submission.commission_rate) ?? 0),
    0,
  );

  const isFresh = submission.status === "signed" || submission.status === "draft";

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="submissions"
      breadcrumb={[{ label: "Submissions", href: "/panel/submissions" }, { label: submission.id }]}
    >
      {/* Hero */}
      <section className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-12 lg:col-span-7">
          <div className="flex items-center gap-3 mb-4">
            <SubmissionStatusPill status={submission.status} />
            {submission.signed_method && (
              <span className="pill pill-mute">
                Podpis: {submission.signed_method === "autopay" ? "Autopay" : "Profil zaufany"}
              </span>
            )}
          </div>
          <h1 className="font-bold text-[40px] lg:text-[60px] leading-[1.02] tracking-[-0.04em] num">
            {submission.id}
          </h1>
          <p className="mt-3 text-[15px] text-text-soft num">
            Numer Submission = Numer Umowy Komisowej · {formatDateTime(submission.created_at)}
          </p>

          {isFresh && (
            <div className="mt-6 rounded-[16px] bg-mint/10 border border-mint/30 px-5 py-4 text-mint flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                <path d="m9 12 2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div className="text-[14px] leading-[1.5]">
                <div className="font-semibold">Submission złożona poprawnie.</div>
                <div className="text-mint/80 mt-1">
                  Wydrukuj etykietę nadania poniżej, naklej na pakunek i nadaj w punkcie InPost / DPD. Po dostarczeniu uruchamiamy A&QC — status zobaczysz tutaj.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="col-span-12 lg:col-span-5">
          <div className="card-gradient-blue p-6 lg:p-7 rounded-[20px]">
            <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">
              Wartość Submission
            </div>
            <div className="mt-2 font-bold text-4xl tracking-[-0.04em] text-white num">
              {formatPLN(totalGross, { decimals: false })}
            </div>
            <div className="mt-1 text-white/70 text-[13px]">
              Brutto · {products.length} {products.length === 1 ? "produkt" : products.length < 5 ? "produkty" : "produktów"}
            </div>
            <div className="mt-5 pt-5 border-t border-white/20 flex items-baseline justify-between">
              <span className="text-white/85 text-[13px]">Twój udział (po prowizji {Math.round(submission.commission_rate * 100)}%)</span>
              <span className="font-bold text-2xl tracking-[-0.035em] text-white num">
                {formatPLN(totalTakeHome, { decimals: false })}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="mt-12">
        <div className="label mb-5">Produkty</div>
        <div className="space-y-4">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} commissionRate={submission.commission_rate} />
          ))}
        </div>
      </section>

      {/* Shipping label (printable) */}
      {isFresh && (
        <section className="mt-12">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="label">Etykieta nadania</div>
              <h2 className="mt-2 font-bold text-2xl lg:text-3xl tracking-[-0.025em]">
                Ship to us
              </h2>
            </div>
            <button
              type="button"
              className="btn-ghost h-11 px-5 text-[13px] inline-flex items-center gap-2 print:hidden"
              onClick={() => undefined}
              data-print-trigger
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
              </svg>
              Drukuj
            </button>
          </div>
          <ShippingLabel submission={submission} profile={profile} totalGross={totalGross} productCount={products.length} />
          <PrintScript />
        </section>
      )}

      {/* Timeline */}
      <section className="mt-12">
        <div className="label mb-5">Postęp</div>
        <ol className="card p-6 space-y-3">
          <Step done date={submission.created_at} title="Powierzono" desc={`Umowa Komisowa podpisana przez ${submission.signed_method === "autopay" ? "Autopay" : "Profil zaufany"}.`} />
          <Step done={["in_transit", "aqc", "listed", "sold", "payout"].includes(submission.status)} title="W transporcie" desc="Pakunek odebrany przez kuriera." />
          <Step done={["aqc", "listed", "sold", "payout"].includes(submission.status)} title="Authentication & QC" desc="12-punktowy audyt każdego produktu." />
          <Step done={["listed", "sold", "payout"].includes(submission.status)} title="Wystawione" desc="Listing aktywny w naszych kanałach." />
          <Step done={submission.status === "payout"} last title="Wypłata" desc="Środki w Wallet po 14d karencji." />
        </ol>
      </section>

      <div className="mt-12 flex items-center gap-4">
        <ButtonLink href="/panel/submissions" variant="ghost" size="md">
          ← Wróć do listy
        </ButtonLink>
      </div>
    </PanelShell>
  );
}

/* ------------------------------ Components */

function ProductRow({
  product, commissionRate,
}: {
  product: Product;
  commissionRate: number;
}) {
  const price = product.listing_price_cents ?? product.expected_price_cents ?? 0;
  const takeHome = takeHomeCents(price, commissionRate) ?? 0;
  return (
    <Link
      href={`/panel/products/${product.id}`}
      className="card p-5 lg:p-6 grid grid-cols-12 gap-5 items-center hover:border-blue/40 transition-colors group"
    >
      <div className="col-span-12 md:col-span-6 flex items-center gap-4">
        <ProductThumb photos={product.photos} brand={product.brand} size="md" />
        <div className="min-w-0">
          <div className="font-semibold text-[15px] truncate">
            {product.brand} <span className="text-text-soft">·</span> {product.model}
          </div>
          <div className="mt-1 text-[12px] text-text-mute num">
            {[product.category, product.size, product.condition && `stan ${product.condition}/10`]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {product.description && (
            <div className="mt-1.5 text-[12px] text-text-soft line-clamp-1">{product.description}</div>
          )}
        </div>
      </div>
      <div className="col-span-6 md:col-span-2">
        <ProductStatusPill status={product.status} />
      </div>
      <div className="col-span-3 md:col-span-2 text-right">
        <div className="text-[11px] text-text-mute font-semibold uppercase">Cena</div>
        <div className="font-bold text-lg tracking-[-0.025em] num">
          {formatPLN(price, { decimals: false })}
        </div>
      </div>
      <div className="col-span-3 md:col-span-2 text-right">
        <div className="text-[11px] text-text-mute font-semibold uppercase">Twój udział</div>
        <div className="font-semibold text-[14px] num text-mint">
          {formatPLN(takeHome, { decimals: false })}
        </div>
      </div>
    </Link>
  );
}

function Step({
  done, last, title, desc, date,
}: {
  done: boolean;
  last?: boolean;
  title: string;
  desc: string;
  date?: string;
}) {
  return (
    <li className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ${done ? "bg-mint text-bg" : "bg-surface-2 text-text-mute border border-border"}`}>
          {done ? "✓" : ""}
        </div>
        {!last && <div className={`w-px flex-1 mt-1 ${done ? "bg-mint/40" : "bg-border-soft"}`} style={{ minHeight: 24 }} />}
      </div>
      <div className="pb-3 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className={`font-semibold text-[14px] ${done ? "text-text" : "text-text-soft"}`}>{title}</span>
          {date && <span className="text-[11px] text-text-mute num">{formatDate(date)}</span>}
        </div>
        <div className="mt-0.5 text-[13px] text-text-soft">{desc}</div>
      </div>
    </li>
  );
}

function ShippingLabel({
  submission, profile, totalGross, productCount,
}: {
  submission: Submission;
  profile: Profile;
  totalGross: number;
  productCount: number;
}) {
  const senderName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";
  const senderAddr = [profile.address_line, [profile.postal_code, profile.city].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");
  // Generate fake tracking number from submission ID
  const tracking = "DPD-" + submission.id.replace("SUB-", "62530000") + "-" + new Date(submission.created_at).getFullYear();

  return (
    <div id="ship-label" className="bg-white text-black rounded-[16px] p-7 lg:p-8 print:rounded-none print:shadow-none print:p-6" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-black/60">Kickback · Magazyn dostawcy</div>
          <div className="font-bold text-3xl tracking-[-0.04em] mt-1" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
            Ship to us
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.2em] text-black/60">Submission</div>
          <div className="text-[15px] num mt-1">{submission.id}</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-black/15 pt-5">
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-black/60">Nadawca</div>
          <div className="text-[12px] mt-1 leading-[1.5]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
            {senderName}<br />
            {senderAddr || "— adres nieuzupełniony —"}<br />
            {profile.phone || ""}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-black/60">Odbiorca</div>
          <div className="text-[12px] mt-1 leading-[1.5]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
            Kickback sp. z o. o.<br />
            Magazyn — A&QC<br />
            ul. Postępu 14<br />
            02-676 Warszawa
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-black/15 pt-5">
        <Barcode />
        <div className="font-mono text-[11px] tracking-[0.18em] mt-2 text-black">
          {tracking}
        </div>
      </div>

      <div className="mt-6 border-t border-black/15 pt-5 flex items-center justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-black/60">Zawartość</div>
          <div className="text-[13px] mt-1" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
            {productCount} {productCount === 1 ? "produkt" : productCount < 5 ? "produkty" : "produktów"} · konsygnacja
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.2em] text-black/60">Zadeklarowana wartość</div>
          <div className="font-bold text-2xl tracking-[-0.035em] num mt-1" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
            {formatPLN(totalGross, { decimals: false })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Barcode() {
  // Pseudorandom but stable bars, height varies
  const bars = Array.from({ length: 60 }).map((_, i) => {
    const seed = (i * 17 + 3) % 13;
    const w = 1 + (seed % 4);
    const h = 60 + (seed % 5) * 6;
    return { w, h };
  });
  return (
    <div className="flex items-end gap-[1.5px] h-14">
      {bars.map((b, i) => (
        <span key={i} style={{ width: b.w + "px", height: b.h + "%", background: "#000" }} className="inline-block" />
      ))}
    </div>
  );
}

function PrintScript() {
  // Tiny inline script: any element with [data-print-trigger] triggers window.print()
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          document.querySelectorAll('[data-print-trigger]').forEach(el => {
            el.addEventListener('click', () => window.print());
          });
        `,
      }}
    />
  );
}
