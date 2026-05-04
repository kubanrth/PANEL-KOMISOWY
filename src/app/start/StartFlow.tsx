"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@/components/ui/Button";
import { PhotoDropzone } from "@/components/ui/PhotoDropzone";
import { formatPLN, parsePriceToCents, takeHomeCents } from "@/lib/format";
import { createSubmission } from "./actions";
import type { Photo } from "@/lib/types";

type Step = 1 | 2 | 3;
type SignMethod = "autopay" | "pz";

type ProductForm = {
  brand: string;
  model: string;
  category: string;
  size: string;
  condition: number;
  description: string;
  expectedPrice: string; // user input, parsed at submit
  minPrice: string;
  photos: Photo[];
};

const COMMISSION = 0.20;

const emptyProduct = (): ProductForm => ({
  brand: "",
  model: "",
  category: "",
  size: "",
  condition: 9,
  description: "",
  expectedPrice: "",
  minPrice: "",
  photos: [],
});

export function StartFlow({ accountType }: { accountType: "individual" | "business" }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // A stable folder hint per submission attempt — used to scope photos in Storage.
  const folderHint = useMemo(() => `draft-${Date.now()}`, []);

  // Step 1 state
  const [signMethod, setSignMethod] = useState<SignMethod>("autopay");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  // Step 2 state
  const [products, setProducts] = useState<ProductForm[]>([emptyProduct()]);

  // Submit state
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  // ---------- step 1: sign ----------
  function handleSign() {
    setSigning(true);
    // Mock Autopay/PZ flow — in production this opens OAuth in a popup
    setTimeout(() => {
      setSigning(false);
      setSigned(true);
      setTimeout(() => setStep(2), 600);
    }, 1500);
  }

  // ---------- step 2: products ----------
  function updateProduct(idx: number, patch: Partial<ProductForm>) {
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function addProduct() {
    setProducts((prev) => [...prev, emptyProduct()]);
  }
  function removeProduct(idx: number) {
    setProducts((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function validateProducts(): string | null {
    for (const [i, p] of products.entries()) {
      if (!p.brand.trim()) return `Produkt ${i + 1}: podaj markę.`;
      if (!p.model.trim()) return `Produkt ${i + 1}: podaj model.`;
      const expected = parsePriceToCents(p.expectedPrice);
      if (!expected || expected <= 0) return `Produkt ${i + 1}: podaj cenę oczekiwaną (np. 2 480 zł).`;
      if (p.condition < 1 || p.condition > 10) return `Produkt ${i + 1}: stan musi być z zakresu 1–10.`;
    }
    return null;
  }

  // ---------- step 3: submit ----------
  function handleSubmit() {
    setSubmitError(null);
    const err = validateProducts();
    if (err) {
      setSubmitError(err);
      return;
    }
    startSubmit(async () => {
      const result = await createSubmission({
        signed_method: signMethod,
        products: products.map((p) => ({
          brand: p.brand.trim(),
          model: p.model.trim(),
          category: p.category.trim() || null,
          size: p.size.trim() || null,
          condition: p.condition,
          description: p.description.trim() || null,
          expected_price_cents: parsePriceToCents(p.expectedPrice)!,
          min_price_cents: parsePriceToCents(p.minPrice),
          photos: p.photos,
        })),
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      router.push(`/panel/submissions/${result.submissionId}`);
    });
  }

  // ---------- totals (for step 3) ----------
  const totals = products.reduce(
    (acc, p) => {
      const cents = parsePriceToCents(p.expectedPrice) ?? 0;
      acc.gross += cents;
      acc.takeHome += takeHomeCents(cents, COMMISSION) ?? 0;
      return acc;
    },
    { gross: 0, takeHome: 0 },
  );

  return (
    <>
      <Stepper step={step} />

      <div className="mt-12">
        {step === 1 && (
          <Step1
            method={signMethod}
            setMethod={setSignMethod}
            signing={signing}
            signed={signed}
            onSign={handleSign}
            accountType={accountType}
          />
        )}
        {step === 2 && (
          <Step2
            products={products}
            updateProduct={updateProduct}
            addProduct={addProduct}
            removeProduct={removeProduct}
            onBack={() => setStep(1)}
            onNext={() => {
              const err = validateProducts();
              if (err) {
                setSubmitError(err);
                return;
              }
              setSubmitError(null);
              setStep(3);
            }}
            error={submitError}
            folderHint={folderHint}
          />
        )}
        {step === 3 && (
          <Step3
            products={products}
            totals={totals}
            signMethod={signMethod}
            commission={COMMISSION}
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            error={submitError}
          />
        )}
      </div>
    </>
  );
}

/* ====================================================== STEPPER */
function Stepper({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "Umowa Komisowa" },
    { n: 2, label: "Produkty" },
    { n: 3, label: "Potwierdzenie" },
  ];
  return (
    <div>
      <div className="text-text-mute text-[12px] font-semibold uppercase tracking-wider">
        Nowa Submission
      </div>
      <div className="mt-4 flex items-center gap-3">
        {steps.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold text-[13px] transition-colors ${
                  done
                    ? "bg-mint text-bg"
                    : active
                      ? "bg-blue text-white"
                      : "bg-surface text-text-mute border border-border"
                }`}
              >
                {done ? "✓" : s.n}
              </div>
              <span className={`text-[14px] ${active ? "text-text font-semibold" : "text-text-soft"}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && <span className="text-text-faint mx-2">—</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ====================================================== STEP 1 */
function Step1({
  method,
  setMethod,
  signing,
  signed,
  onSign,
  accountType,
}: {
  method: SignMethod;
  setMethod: (m: SignMethod) => void;
  signing: boolean;
  signed: boolean;
  onSign: () => void;
  accountType: "individual" | "business";
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-[40px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
          Podpisz Umowę<br />
          <span className="text-text-soft">Komisową.</span>
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-text-soft max-w-[60ch]">
          Umowa Sprzedaży w Formie Konsygnacji definiuje, że Kickback przechowuje i sprzedaje Twoje rzeczy jako magazyn dostawcy.{" "}
          <strong className="text-text">Numer Submission = Numer Umowy.</strong>
        </p>
      </div>

      {/* Contract preview */}
      <div className="card p-6 lg:p-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="label">Treść umowy</div>
            <div className="mt-2 font-semibold text-xl tracking-[-0.025em]">
              Umowa Sprzedaży w Formie Konsygnacji
            </div>
            <div className="mt-1 text-[12px] text-text-mute">Wersja 4.2 · obowiązuje od 01.04.2026</div>
          </div>
          <span className="pill pill-mute">
            Konto: {accountType === "individual" ? "Indywidualne" : "Biznesowe"}
          </span>
        </div>
        <div className="mt-5 max-h-[180px] overflow-y-auto border-t border-b border-border-soft py-4 text-[13px] leading-[1.7] text-text-soft space-y-2 pr-2">
          <p><span className="text-text font-semibold">§1.</span> Komitent powierza Komisantowi (Kickback sp. z o. o.) rzeczy ruchome, których specyfikacja stanowi załącznik nr 1 (Submission), w celu ich sprzedaży.</p>
          <p><span className="text-text font-semibold">§2.</span> Własność rzeczy pozostaje przy Komitencie do momentu podpisania Umowy Kupna-Sprzedaży lub wystawienia FV.</p>
          <p><span className="text-text font-semibold">§3.</span> Komisant zobowiązuje się do procedury Authentication & Quality Control (12-punktowy audyt) w terminie do 5 dni roboczych od dostarczenia.</p>
          <p><span className="text-text font-semibold">§4.</span> Komisant ma prawo do prowizji od ceny sprzedaży w wysokości 20% (negocjowalne od kwoty 2 000 zł netto za pozycję).</p>
          <p><span className="text-text font-semibold">§5.</span> Komitent zachowuje prawo akceptacji wyceny, redukcji ceny oraz wycofania rzeczy zgodnie z polityką zwrotów.</p>
          <p><span className="text-text font-semibold">§6.</span> Środki ze sprzedaży deponowane są w Wallet. Wypłata odbywa się na pisemną dyspozycję Komitenta.</p>
        </div>
      </div>

      {/* Method */}
      <div>
        <div className="label mb-4">Metoda podpisu</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MethodCard
            letter="A"
            title="Autopay"
            desc="Logowanie do banku (mTransfer, Santander, ING, PKO BP). Tożsamość przez Open Banking."
            tags={["~ 90 sek", "14 banków PL"]}
            active={method === "autopay"}
            onClick={() => setMethod("autopay")}
          />
          <MethodCard
            letter="B"
            title="Profil zaufany"
            desc="Logowanie do gov.pl. Podpis elektroniczny z mocą prawną dokumentu papierowego."
            tags={["~ 3 min", "gov.pl"]}
            active={method === "pz"}
            onClick={() => setMethod("pz")}
          />
        </div>
      </div>

      {/* Demo banner */}
      <div className="rounded-[12px] bg-amber/10 border border-amber/30 px-4 py-3 text-[13px] text-amber inline-flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
        Tryb demo — Autopay i PZ symulowane (real OAuth w Phase 4).
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <a href="/panel" className="text-[14px] text-text-soft hover:text-text transition-colors">
          ← Anuluj
        </a>
        <button
          onClick={onSign}
          disabled={signing || signed}
          className="btn-primary h-12 px-7 text-[14px] inline-flex items-center gap-3"
        >
          {signing
            ? <>Podpisywanie…</>
            : signed
              ? <>Podpisano <span className="text-mint">✓</span></>
              : <>Podpisz przez {method === "autopay" ? "Autopay" : "Profil zaufany"} <ArrowRight /></>}
        </button>
      </div>
    </div>
  );
}

function MethodCard({
  letter, title, desc, tags, active, onClick,
}: {
  letter: string; title: string; desc: string; tags: string[]; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-6 rounded-[16px] border-2 transition-all ${
        active ? "border-blue bg-blue/5" : "border-border hover:border-text-mute bg-surface"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="font-bold text-2xl tracking-[-0.04em] text-blue">{letter}</span>
        <span className={`h-5 w-5 rounded-full border-2 ${active ? "border-blue bg-blue" : "border-border"} flex items-center justify-center`}>
          {active && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
      </div>
      <div className="mt-5 font-semibold text-xl tracking-[-0.025em]">{title}</div>
      <div className="mt-2 text-[13px] text-text-soft leading-[1.5]">{desc}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="text-[11px] px-2 py-1 rounded-md bg-surface-2 border border-border text-text-soft">
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}

/* ====================================================== STEP 2 */
function Step2({
  products, updateProduct, addProduct, removeProduct, onBack, onNext, error, folderHint,
}: {
  products: ProductForm[];
  updateProduct: (idx: number, patch: Partial<ProductForm>) => void;
  addProduct: () => void;
  removeProduct: (idx: number) => void;
  onBack: () => void;
  onNext: () => void;
  error: string | null;
  folderHint: string;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-[40px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
          Co <span className="text-text-soft">powierzasz?</span>
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-text-soft max-w-[60ch]">
          Dodaj produkty, które przekazujesz do konsygnacji. Wycenę otrzymasz po audycie A&QC w panelu My Sales — zwykle w ciągu 3 dni roboczych od dostarczenia.
        </p>
      </div>

      <div className="space-y-5">
        {products.map((p, idx) => (
          <ProductCard
            key={idx}
            idx={idx}
            product={p}
            onChange={(patch) => updateProduct(idx, patch)}
            onRemove={products.length > 1 ? () => removeProduct(idx) : undefined}
            folderHint={`${folderHint}/p${idx}`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addProduct}
        className="w-full border border-dashed border-border hover:border-blue hover:text-blue transition-colors rounded-[16px] py-5 flex items-center justify-center gap-2 text-text-soft"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="text-[14px] font-medium">Dodaj kolejny produkt</span>
      </button>

      {error && (
        <div className="rounded-[12px] bg-coral/10 border border-coral/30 px-4 py-3 text-[13px] text-coral">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[14px] text-text-soft hover:text-text transition-colors">
          ← Cofnij
        </button>
        <button onClick={onNext} className="btn-primary h-12 px-7 text-[14px] inline-flex items-center gap-3">
          Dalej · Podgląd
          <ArrowRight />
        </button>
      </div>
    </div>
  );
}

function ProductCard({
  idx, product, onChange, onRemove, folderHint,
}: {
  idx: number;
  product: ProductForm;
  onChange: (patch: Partial<ProductForm>) => void;
  onRemove?: () => void;
  folderHint: string;
}) {
  const cents = parsePriceToCents(product.expectedPrice);
  const takeHome = takeHomeCents(cents, COMMISSION);

  return (
    <div className="card p-6 lg:p-7">
      <div className="flex items-center justify-between mb-5">
        <span className="pill pill-blue">Produkt {String(idx + 1).padStart(2, "0")}</span>
        {onRemove && (
          <button onClick={onRemove} className="text-[12px] text-text-soft hover:text-coral transition-colors inline-flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </svg>
            Usuń
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Field className="col-span-12 md:col-span-7" label="Marka *">
          <input className="input" placeholder="Maison Margiela" value={product.brand}
            onChange={(e) => onChange({ brand: e.target.value })} />
        </Field>
        <Field className="col-span-12 md:col-span-5" label="Kategoria">
          <input className="input" placeholder="Obuwie · Loafers" value={product.category}
            onChange={(e) => onChange({ category: e.target.value })} />
        </Field>

        <Field className="col-span-12 md:col-span-7" label="Model *">
          <input className="input" placeholder="Tabi (Replica)" value={product.model}
            onChange={(e) => onChange({ model: e.target.value })} />
        </Field>
        <Field className="col-span-6 md:col-span-3" label="Rozmiar">
          <input className="input" placeholder="EU 42" value={product.size}
            onChange={(e) => onChange({ size: e.target.value })} />
        </Field>
        <Field className="col-span-6 md:col-span-2" label="Stan *">
          <input
            type="number" min={1} max={10} className="input"
            value={product.condition}
            onChange={(e) => onChange({ condition: Math.max(1, Math.min(10, parseInt(e.target.value || "9", 10))) })}
          />
        </Field>

        <Field className="col-span-12 md:col-span-6" label="Cena oczekiwana * (zł)">
          <input className="input" placeholder="2 480" value={product.expectedPrice}
            onChange={(e) => onChange({ expectedPrice: e.target.value })} />
        </Field>
        <Field className="col-span-12 md:col-span-6" label="Cena minimalna (zł)">
          <input className="input" placeholder="1 950" value={product.minPrice}
            onChange={(e) => onChange({ minPrice: e.target.value })} />
        </Field>

        <Field className="col-span-12" label="Opis stanu, akcesoria, uwagi">
          <textarea
            className="input min-h-[72px] resize-y"
            placeholder="Bardzo dobry stan. Oryginalne pudełko. Worek pyłowy. Lekkie ślady noszenia."
            value={product.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </Field>

        <Field className="col-span-12" label="Zdjęcia produktu">
          <PhotoDropzone
            photos={product.photos}
            onChange={(photos) => onChange({ photos })}
            folderHint={folderHint}
          />
        </Field>
      </div>

      {cents !== null && cents > 0 && (
        <div className="mt-5 pt-4 border-t border-border-soft flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <span className="text-text-soft">
            Po prowizji 20% otrzymasz: <strong className="text-mint num">{formatPLN(takeHome, { decimals: false })}</strong>
          </span>
          <span className="text-text-mute num text-[12px]">
            {formatPLN(cents, { decimals: false })} (brutto)
          </span>
        </div>
      )}
    </div>
  );
}

function Field({ children, label, className = "" }: { children: React.ReactNode; label: string; className?: string }) {
  return (
    <div className={className}>
      <label className="input-label">{label}</label>
      {children}
    </div>
  );
}

/* ====================================================== STEP 3 */
function Step3({
  products, totals, signMethod, commission, onBack, onSubmit, isSubmitting, error,
}: {
  products: ProductForm[];
  totals: { gross: number; takeHome: number };
  signMethod: SignMethod;
  commission: number;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-[40px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
          Sprawdź <span className="text-text-soft">i zatwierdź.</span>
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-text-soft max-w-[60ch]">
          Po zatwierdzeniu wygenerujemy numer Submission, etykietę nadania i wyślemy potwierdzenie na e-mail.
        </p>
      </div>

      {/* Products summary */}
      <div className="card p-6 lg:p-7">
        <div className="label mb-5">Produkty · {products.length}</div>
        <ul className="space-y-4">
          {products.map((p, i) => {
            const cents = parsePriceToCents(p.expectedPrice) ?? 0;
            return (
              <li key={i} className="flex items-center justify-between gap-4 pb-4 border-b border-border-soft last:border-0 last:pb-0">
                <div className="min-w-0">
                  <div className="text-[15px] truncate">
                    <span className="font-semibold">{p.brand}</span>
                    {p.model && <> · {p.model}</>}
                  </div>
                  <div className="text-[12px] text-text-mute mt-0.5 num">
                    {[p.category, p.size, `stan ${p.condition}/10`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="font-bold text-xl tracking-[-0.025em] num">
                  {formatPLN(cents, { decimals: false })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Totals */}
      <div className="card-gradient-blue p-7 rounded-[24px]">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 text-white">
          <div>
            <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">Suma wycen</div>
            <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">
              {formatPLN(totals.gross, { decimals: false })}
            </div>
          </div>
          <div>
            <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">Prowizja Kickback</div>
            <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">
              −{Math.round(commission * 100)}%
            </div>
          </div>
          <div>
            <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">Twój udział</div>
            <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">
              {formatPLN(totals.takeHome, { decimals: false })}
            </div>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetaTile label="Metoda podpisu" value={signMethod === "autopay" ? "Autopay" : "Profil zaufany"} />
        <MetaTile label="Audyt A&QC" value="3 dni rob." />
        <MetaTile label="Wypłata" value="14 dni od sprzedaży" />
      </div>

      {error && (
        <div className="rounded-[12px] bg-coral/10 border border-coral/30 px-4 py-3 text-[13px] text-coral">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} disabled={isSubmitting} className="text-[14px] text-text-soft hover:text-text transition-colors">
          ← Cofnij
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="btn-primary h-14 px-8 text-[15px] inline-flex items-center gap-3"
        >
          {isSubmitting ? "Tworzenie Submission…" : <>Zatwierdź i wyślij <ArrowRight size={18} /></>}
        </button>
      </div>
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="label">{label}</div>
      <div className="mt-2 font-semibold text-[15px]">{value}</div>
    </div>
  );
}
