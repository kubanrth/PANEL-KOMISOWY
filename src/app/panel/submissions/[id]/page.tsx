import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmissionStatusPill, ProductStatusPill } from "@/components/panel/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN, formatDateTime, takeHomeCents, plural } from "@/lib/format";
import type { Submission, SubmissionStatus, Product, Profile } from "@/lib/types";

/* Szczegół oferty — redesign: PageHeader z numerem, pozioma oś kroków
   (Wysłana → Odebrana → A&QC → Wystawiona), pozycje jako accordion,
   prawy panel (wartość, umowa PDF, notatki). Printable #ship-label bez zmian. */

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
      <section>
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <SubmissionStatusPill status={submission.status} />
          {submission.signed_method && (
            <span className="pill pill-mute">
              Podpis: {submission.signed_method === "autopay" ? "Autopay" : "Profil zaufany"}
            </span>
          )}
        </div>
        <PageHeader
          label={`Umowa komisowa · ${formatDateTime(submission.created_at)}`}
          title={`Oferta ${submission.id}`}
          sub="Numer oferty = numer Umowy Komisowej. Postęp realizacji i pozycje poniżej."
        />
      </section>

      {isFresh && (
        <section className="mt-6">
          <div className="rounded-[16px] bg-mint/10 border border-mint/30 px-5 py-4 text-mint flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5" aria-hidden>
              <path d="m9 12 2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <div className="text-[13.5px] leading-[1.55]">
              <div className="font-medium">Oferta złożona poprawnie.</div>
              <div className="text-mint/80 mt-1">
                Wydrukuj etykietę nadania poniżej, naklej na pakunek i nadaj w punkcie InPost / DPD.
                Po dostarczeniu uruchamiamy A&QC — status zobaczysz tutaj.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Pozioma oś kroków */}
      <section className="mt-8">
        <div className="card px-6 py-5">
          <StepAxis status={submission.status} />
        </div>
      </section>

      <section className="mt-8 grid grid-cols-12 gap-6 items-start">
        {/* Pozycje — accordion */}
        <div className="col-span-12 lg:col-span-8">
          <div className="label mb-3">Pozycje · {products.length}</div>
          <div className="space-y-3">
            {products.map((p) => (
              <ProductAccordion key={p.id} product={p} commissionRate={submission.commission_rate} />
            ))}
            {products.length === 0 && (
              <div className="card px-6 py-10 text-center text-[13px] text-text-soft">
                Brak pozycji w tej ofercie.
              </div>
            )}
          </div>
        </div>

        {/* Prawy panel */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <div className="card-gradient-dark p-6 relative overflow-hidden">
            <div className="glow-blob" aria-hidden />
            <div className="relative">
              <div className="label !text-mint/80">Wartość oferty</div>
              <div className="mt-2 font-light text-[32px] leading-none tracking-[-0.02em] num text-mint">
                {formatPLN(totalGross, { decimals: false })}
              </div>
              <div className="mt-1.5 text-[12px] text-text-soft">
                Brutto · {products.length} {plural(products.length, ["pozycja", "pozycje", "pozycji"])}
              </div>
              <div className="mt-5 pt-4 border-t border-white/10 flex items-baseline justify-between text-[13px]">
                <span className="text-text-soft">Twój udział (po prowizji {Math.round(submission.commission_rate * 100)}%)</span>
                <span className="font-medium text-[17px] tracking-[-0.02em] num text-mint">
                  {formatPLN(totalTakeHome, { decimals: false })}
                </span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="label mb-3">Umowa komisowa</div>
            {submission.contract_pdf_url ? (
              <a
                href={submission.contract_pdf_url}
                download
                className="btn-ghost h-11 px-5 text-[13px] inline-flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Pobierz PDF
              </a>
            ) : (
              <p className="text-[13px] text-text-soft leading-[1.55]">
                PDF umowy pojawi się tutaj po wygenerowaniu przez Kickback.
              </p>
            )}
          </div>

          <div className="card p-6">
            <div className="label mb-3">Notatki</div>
            <p className="text-[13px] text-text-soft leading-[1.55]">
              Brak notatek do tej oferty. Uwagi z A&QC znajdziesz przy poszczególnych pozycjach.
            </p>
          </div>
        </aside>
      </section>

      {/* Shipping label (printable — struktura #ship-label bez zmian) */}
      {isFresh && (
        <section className="mt-10">
          <div className="flex items-end justify-between mb-4 gap-4">
            <div>
              <div className="label">Etykieta nadania</div>
              <h2 className="mt-2 font-light text-[22px] lg:text-[26px] leading-[1.1] tracking-[-0.02em]">
                Ship to us
              </h2>
            </div>
            <button
              type="button"
              className="btn-ghost h-11 px-5 text-[13px] inline-flex items-center gap-2 print:hidden"
              data-print-trigger
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
              </svg>
              Drukuj
            </button>
          </div>
          <ShippingLabel submission={submission} profile={profile} totalGross={totalGross} productCount={products.length} />
          <PrintScript />
        </section>
      )}

      <div className="mt-10 flex items-center gap-3">
        <ButtonLink href="/panel/submissions" variant="ghost" size="md">
          ← Wróć do listy
        </ButtonLink>
      </div>
    </PanelShell>
  );
}

/* ------------------------------ Components */

/* Pozioma oś: lime dot done / hollow pending, linia bg-border między. */
function StepAxis({ status }: { status: SubmissionStatus }) {
  const steps: Array<{ label: string; done: boolean }> = [
    { label: "Wysłana", done: true },
    { label: "Odebrana", done: ["aqc", "listed", "sold", "payout"].includes(status) },
    { label: "A&QC", done: ["aqc", "listed", "sold", "payout"].includes(status) },
    { label: "Wystawiona", done: ["listed", "sold", "payout"].includes(status) },
  ];
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => (
        <li key={s.label} className={`flex items-start ${i < steps.length - 1 ? "flex-1" : ""}`}>
          <div className="flex flex-col items-center gap-2">
            <span
              className={`h-[11px] w-[11px] rounded-full flex-shrink-0 ${
                s.done ? "bg-lime" : "border border-border bg-transparent"
              }`}
              aria-hidden
            />
            <span className={`text-[11px] lg:text-[12px] whitespace-nowrap ${s.done ? "font-medium" : "text-text-mute"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span className="flex-1 h-px bg-border mt-[5px] mx-2 lg:mx-3" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}

/* Karta pozycji — natywny <details> accordion (zero JS). */
function ProductAccordion({
  product, commissionRate,
}: {
  product: Product;
  commissionRate: number;
}) {
  const price = product.listing_price_cents ?? product.expected_price_cents ?? 0;
  const takeHome = takeHomeCents(price, commissionRate) ?? 0;
  return (
    <details className="card group overflow-hidden">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-5 py-4 flex items-center gap-4 hover:bg-surface-2/40 transition-colors">
        <ProductThumb photos={product.photos} brand={product.brand} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium truncate">
            {product.brand} {product.model}
          </div>
          <div className="mt-0.5 text-[11px] num text-text-mute truncate">
            {[product.sku, product.size, product.condition && `stan ${product.condition}/10`]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div className="hidden sm:block">
          <ProductStatusPill status={product.status} />
        </div>
        <div className="text-[13px] num flex-shrink-0">{formatPLN(price, { decimals: false })}</div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className="flex-shrink-0 text-text-faint transition-transform group-open:rotate-90"
          aria-hidden
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </summary>

      <div className="px-5 pb-5 pt-4 border-t border-border-soft">
        <div className="sm:hidden mb-3">
          <ProductStatusPill status={product.status} />
        </div>
        {product.description && (
          <p className="text-[13px] leading-[1.6] text-text-soft">{product.description}</p>
        )}
        <div className={`${product.description ? "mt-4" : ""} grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12px]`}>
          <div>
            <div className="label !text-[10px]">Kategoria</div>
            <div className="mt-1">{product.category ?? "—"}</div>
          </div>
          <div>
            <div className="label !text-[10px]">Cena</div>
            <div className="mt-1 num">{formatPLN(price, { decimals: false })}</div>
          </div>
          <div>
            <div className="label !text-[10px]">Twój udział</div>
            <div className="mt-1 num text-mint">{formatPLN(takeHome, { decimals: false })}</div>
          </div>
        </div>
        <div className="mt-4">
          <Link
            href={`/panel/products/${product.id}`}
            className="text-[12px] font-medium text-lime hover:underline"
          >
            Karta produktu →
          </Link>
        </div>
      </div>
    </details>
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
    <div id="ship-label" className="bg-white text-black rounded-[16px] p-7 lg:p-8 print:rounded-none print:shadow-none print:p-6" style={{ fontFamily: "var(--font-plex-mono), monospace" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-black/60">Kickback · Magazyn dostawcy</div>
          <div className="font-bold text-3xl tracking-[-0.04em] mt-1" style={{ fontFamily: "var(--font-lufga), var(--font-jakarta), sans-serif" }}>
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
          <div className="text-[12px] mt-1 leading-[1.5]" style={{ fontFamily: "var(--font-lufga), var(--font-jakarta), sans-serif" }}>
            {senderName}<br />
            {senderAddr || "— adres nieuzupełniony —"}<br />
            {profile.phone || ""}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-black/60">Odbiorca</div>
          <div className="text-[12px] mt-1 leading-[1.5]" style={{ fontFamily: "var(--font-lufga), var(--font-jakarta), sans-serif" }}>
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
          <div className="text-[13px] mt-1" style={{ fontFamily: "var(--font-lufga), var(--font-jakarta), sans-serif" }}>
            {productCount} {productCount === 1 ? "produkt" : productCount < 5 ? "produkty" : "produktów"} · konsygnacja
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.2em] text-black/60">Zadeklarowana wartość</div>
          <div className="font-bold text-2xl tracking-[-0.035em] num mt-1" style={{ fontFamily: "var(--font-lufga), var(--font-jakarta), sans-serif" }}>
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
