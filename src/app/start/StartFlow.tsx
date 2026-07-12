"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@/components/ui/Button";
import { PhotoDropzone } from "@/components/ui/PhotoDropzone";
import { formatPLN, parsePriceToCents, takeHomeCents, plural } from "@/lib/format";
import { createSubmission } from "./actions";
import { parseOfferCsv, templateCsv, type CsvProduct } from "@/lib/offer-csv";
import type { Photo, PricingMode } from "@/lib/types";

type Step = 1 | 2;

type ProductForm = {
  brand: string;
  model: string;
  category: string;
  size: string;
  condition: number;
  description: string;
  pricingMode: PricingMode;
  expectedPrice: string;     // user input, parsed at submit (also used as listing target in payout mode)
  minPrice: string;          // commission mode only
  payoutPrice: string;       // payout mode only — how much klient wants
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
  pricingMode: "commission",
  expectedPrice: "",
  minPrice: "",
  payoutPrice: "",
  photos: [],
});

export function StartFlow({ accountType: _accountType }: { accountType: "individual" | "business" }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  const folderHint = useMemo(() => `draft-${Date.now()}`, []);

  const [products, setProducts] = useState<ProductForm[]>([emptyProduct()]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  function updateProduct(idx: number, patch: Partial<ProductForm>) {
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function addProduct() {
    setProducts((prev) => [...prev, emptyProduct()]);
  }
  function removeProduct(idx: number) {
    setProducts((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }
  function importProducts(rows: CsvProduct[]) {
    const mapped: ProductForm[] = rows.map((r) => ({
      ...emptyProduct(),
      brand: r.brand, model: r.model, category: r.category, size: r.size,
      condition: r.condition, expectedPrice: r.expectedPrice, minPrice: r.minPrice,
      description: r.description,
    }));
    setProducts((prev) => {
      // Jedyna, nietknięta karta → podmieniamy zamiast doklejać pod spodem.
      const untouched = prev.length === 1 && !prev[0].brand && !prev[0].model && prev[0].photos.length === 0;
      return untouched ? mapped : [...prev, ...mapped];
    });
  }

  function validateProducts(): string | null {
    for (const [i, p] of products.entries()) {
      if (!p.brand.trim()) return `Produkt ${i + 1}: podaj markę.`;
      if (!p.model.trim()) return `Produkt ${i + 1}: podaj model.`;
      if (p.pricingMode === "commission") {
        const expected = parsePriceToCents(p.expectedPrice);
        if (!expected || expected <= 0) return `Produkt ${i + 1}: podaj cenę listingu.`;
      } else {
        const payout = parsePriceToCents(p.payoutPrice);
        if (!payout || payout <= 0) return `Produkt ${i + 1}: podaj kwotę wypłaty.`;
      }
      if (p.condition < 1 || p.condition > 10) return `Produkt ${i + 1}: stan musi być z zakresu 1–10.`;
    }
    return null;
  }

  function handleSubmit() {
    setSubmitError(null);
    const err = validateProducts();
    if (err) {
      setSubmitError(err);
      return;
    }
    startSubmit(async () => {
      const result = await createSubmission({
        products: products.map((p) => {
          const expectedCents =
            p.pricingMode === "commission"
              ? parsePriceToCents(p.expectedPrice)!
              : parsePriceToCents(p.payoutPrice)!; // for payout mode listing target = klient's payout to start
          return {
            brand: p.brand.trim(),
            model: p.model.trim(),
            category: p.category.trim() || null,
            size: p.size.trim() || null,
            condition: p.condition,
            description: p.description.trim() || null,
            expected_price_cents: expectedCents,
            min_price_cents: parsePriceToCents(p.minPrice),
            pricing_mode: p.pricingMode,
            payout_price_cents: p.pricingMode === "payout" ? parsePriceToCents(p.payoutPrice) : null,
            photos: p.photos,
          };
        }),
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      router.push(`/panel/submissions/${result.submissionId}`);
    });
  }

  // Totals — depends on mode per row
  const totals = products.reduce(
    (acc, p) => {
      if (p.pricingMode === "commission") {
        const cents = parsePriceToCents(p.expectedPrice) ?? 0;
        acc.gross += cents;
        acc.takeHome += takeHomeCents(cents, COMMISSION) ?? 0;
      } else {
        const payout = parsePriceToCents(p.payoutPrice) ?? 0;
        acc.gross += payout;     // minimum klient expects to receive
        acc.takeHome += payout;  // payout = klient's guaranteed take
      }
      return acc;
    },
    { gross: 0, takeHome: 0 },
  );

  return (
    <>
      <Stepper step={step} />

      <div className="mt-10">
        {step === 1 && (
          <Step1
            products={products}
            updateProduct={updateProduct}
            addProduct={addProduct}
            importProducts={importProducts}
            removeProduct={removeProduct}
            onNext={() => {
              const err = validateProducts();
              if (err) {
                setSubmitError(err);
                return;
              }
              setSubmitError(null);
              setStep(2);
            }}
            error={submitError}
            folderHint={folderHint}
          />
        )}
        {step === 2 && (
          <Step2
            products={products}
            totals={totals}
            commission={COMMISSION}
            onBack={() => setStep(1)}
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
    { n: 1, label: "Produkty" },
    { n: 2, label: "Potwierdzenie" },
  ];
  return (
    <div>
      <div className="text-text-mute text-[12px] font-semibold uppercase tracking-wider">
        Nowa Oferta · paczka
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

      <div className="mt-4 text-[12px] text-text-mute">
        Umowa Komisowa podpisana raz · obowiązuje dla wszystkich Twoich Ofert.
      </div>
    </div>
  );
}

/* ====================================================== STEP 1: produkty */
function Step1({
  products, updateProduct, addProduct, importProducts, removeProduct, onNext, error, folderHint,
}: {
  products: ProductForm[];
  updateProduct: (idx: number, patch: Partial<ProductForm>) => void;
  addProduct: () => void;
  importProducts: (rows: CsvProduct[]) => void;
  removeProduct: (idx: number) => void;
  onNext: () => void;
  error: string | null;
  folderHint: string;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-[28px] lg:text-[36px] leading-[1.02] tracking-[-0.04em]">
          Co <span className="text-text-soft">wysyłasz w tej paczce?</span>
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-text-soft max-w-[60ch]">
          Dodaj produkty z paczki, którą wyślesz do Kickback. Rozliczenie: prowizja 20% od ceny sprzedaży.
          Wycenę listingu otrzymasz po weryfikacji w panelu Sprzedaże — zwykle w ciągu 3 dni roboczych
          od dostarczenia.
        </p>
      </div>

      <FileImport onImport={importProducts} />

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
        className="w-full border border-dashed border-border hover:border-lime hover:text-lime transition-colors rounded-[16px] py-5 flex items-center justify-center gap-2 text-text-soft"
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
        <a href="/panel" className="text-[14px] text-text-soft hover:text-text transition-colors">
          ← Anuluj
        </a>
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
  const isCommission = product.pricingMode === "commission";
  const expectedCents = parsePriceToCents(product.expectedPrice);
  const payoutCents = parsePriceToCents(product.payoutPrice);

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
      </div>

      {/* Model rozliczenia bez wyboru w UI (2026-07-12) — zawsze prowizja 20%;
          pricingMode/payout zostaje w modelu danych (Grail Point w przyszłości). */}
      <div className="mt-5 grid grid-cols-12 gap-4">
        {isCommission ? (
          <>
            <Field className="col-span-12 md:col-span-6" label="Cena oczekiwana * (zł)">
              <input className="input" placeholder="2 480" value={product.expectedPrice}
                onChange={(e) => onChange({ expectedPrice: e.target.value })} />
            </Field>
            <Field className="col-span-12 md:col-span-6" label="Cena minimalna (zł)">
              <input className="input" placeholder="1 950" value={product.minPrice}
                onChange={(e) => onChange({ minPrice: e.target.value })} />
            </Field>
          </>
        ) : (
          <>
            <Field className="col-span-12 md:col-span-6" label="Chcę otrzymać * (zł)">
              <input className="input" placeholder="3 000" value={product.payoutPrice}
                onChange={(e) => onChange({ payoutPrice: e.target.value })} />
            </Field>
            <div className="col-span-12 md:col-span-6 self-end text-[12px] text-text-mute leading-[1.5] pb-2">
              Sprzedajemy za dowolną cenę powyżej tej kwoty.
              Marża Kickback = cena sprzedaży − Twoja wypłata.
            </div>
          </>
        )}

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

      {isCommission && expectedCents !== null && expectedCents > 0 && (
        <div className="mt-5 pt-4 border-t border-border-soft flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <span className="text-text-soft">
            Po prowizji 20% otrzymasz: <strong className="text-mint num">{formatPLN(takeHomeCents(expectedCents, COMMISSION), { decimals: false })}</strong>
          </span>
          <span className="text-text-mute num text-[12px]">
            {formatPLN(expectedCents, { decimals: false })} (brutto)
          </span>
        </div>
      )}
      {!isCommission && payoutCents !== null && payoutCents > 0 && (
        <div className="mt-5 pt-4 border-t border-border-soft flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <span className="text-text-soft">
            Gwarantowana wypłata: <strong className="text-mint num">{formatPLN(payoutCents, { decimals: false })}</strong>
          </span>
          <span className="text-text-mute num text-[12px]">
            cena listingu &gt; {formatPLN(payoutCents, { decimals: false })}
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

/* ====================================================== STEP 2: potwierdzenie */
function Step2({
  products, totals, commission, onBack, onSubmit, isSubmitting, error,
}: {
  products: ProductForm[];
  totals: { gross: number; takeHome: number };
  commission: number;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-[28px] lg:text-[36px] leading-[1.02] tracking-[-0.04em]">
          Sprawdź <span className="text-text-soft">i zatwierdź.</span>
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-text-soft max-w-[60ch]">
          Po zatwierdzeniu wygenerujemy numer Oferty, etykietę nadania i wyślemy potwierdzenie na e-mail.
        </p>
      </div>

      {/* Products summary */}
      <div className="card p-6 lg:p-7">
        <div className="label mb-5">Produkty · {products.length}</div>
        <ul className="space-y-4">
          {products.map((p, i) => {
            const isCommission = p.pricingMode === "commission";
            const cents = isCommission
              ? parsePriceToCents(p.expectedPrice) ?? 0
              : parsePriceToCents(p.payoutPrice) ?? 0;
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
                  <div className="mt-1.5">
                    <span className={`pill ${isCommission ? "pill-blue" : "pill-mint"}`}>
                      {isCommission ? "Prowizja 20%" : "Stała wypłata"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xl tracking-[-0.025em] num">
                    {formatPLN(cents, { decimals: false })}
                  </div>
                  <div className="text-[11px] text-text-mute mt-0.5">
                    {isCommission ? "cena listingu" : "Twoja wypłata"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Totals */}
      <div className="card-gradient-dark p-7 rounded-[24px]">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 text-white">
          <div>
            <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">Wartość paczki</div>
            <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">
              {formatPLN(totals.gross, { decimals: false })}
            </div>
          </div>
          <div>
            <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">Tw. wypłata (min.)</div>
            <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">
              {formatPLN(totals.takeHome, { decimals: false })}
            </div>
          </div>
          <div>
            <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">Prowizja (commission)</div>
            <div className="mt-2 font-bold text-3xl tracking-[-0.04em] num">
              −{Math.round(commission * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetaTile label="Umowa Komisowa" value="Podpisana (master)" />
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
          {isSubmitting ? "Tworzenie Oferty…" : <>Zatwierdź i wyślij <ArrowRight size={18} /></>}
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

/** „Wgraj przez plik" — pobranie formatki CSV + import produktów z pliku. */
function FileImport({ onImport }: { onImport: (rows: CsvProduct[]) => void }) {
  const [feedback, setFeedback] = useState<{ added: number; errors: string[] } | null>(null);

  function downloadTemplate() {
    const blob = new Blob([templateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formatka-kickback.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const { products, errors } = parseOfferCsv(await file.text());
    if (products.length) onImport(products);
    setFeedback({ added: products.length, errors });
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-semibold text-[15px]">Wgraj przez plik</div>
          <p className="mt-1 text-[12px] text-text-soft leading-[1.5] max-w-[52ch]">
            Pobierz formatkę, uzupełnij w Excelu (zapisz jako CSV) i wgraj — produkty
            pojawią się poniżej. Zdjęcia dodasz przy każdej pozycji.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={downloadTemplate} className="btn-ghost h-10 px-4 text-[13px]">
            Pobierz formatkę (CSV)
          </button>
          <label className="btn-primary h-10 px-4 text-[13px] inline-flex items-center cursor-pointer">
            Wgraj plik
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
            />
          </label>
        </div>
      </div>
      {feedback && (
        <div className="mt-3 text-[12px] leading-[1.5]">
          {feedback.added > 0 && (
            <div className="text-mint">Dodano {feedback.added} {plural(feedback.added, ["produkt", "produkty", "produktów"])} z pliku.</div>
          )}
          {feedback.errors.length > 0 && (
            <ul className="mt-1 text-coral list-disc pl-4">
              {feedback.errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
              {feedback.errors.length > 5 && <li>…i {feedback.errors.length - 5} kolejnych.</li>}
            </ul>
          )}
          {feedback.added === 0 && feedback.errors.length === 0 && (
            <div className="text-text-soft">Plik nie zawierał żadnych produktów.</div>
          )}
        </div>
      )}
    </div>
  );
}
