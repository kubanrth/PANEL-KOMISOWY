"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@/components/ui/Button";
import { AQC_CHECKLIST, type AqcVerdict } from "@/lib/types";
import { formatPLN, parsePriceToCents } from "@/lib/format";
import { saveAqc } from "./actions";

type Comparable = {
  brand: string; model: string; condition: number | null;
  listing_price_cents: number | null; expected_price_cents: number | null;
  status: string; updated_at: string;
};

export function AqcInspectionForm({
  productId, initialScores, initialVerdict, initialNotes, initialPriceCents, alreadyDone, comparables,
}: {
  productId: string;
  initialScores: Record<string, number>;
  initialVerdict: AqcVerdict;
  initialNotes: string;
  initialPriceCents: number;
  alreadyDone: boolean;
  comparables: Comparable[];
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    for (const item of AQC_CHECKLIST) s[item.key] = initialScores[item.key] ?? 10;
    return s;
  });
  const [verdict, setVerdict] = useState<AqcVerdict>(initialVerdict);
  const [notes, setNotes] = useState(initialNotes);
  const [priceInput, setPriceInput] = useState(((initialPriceCents || 0) / 100).toFixed(0));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = useMemo(
    () => AQC_CHECKLIST.reduce((acc, item) => acc + (scores[item.key] || 0), 0),
    [scores],
  );
  const totalMax = AQC_CHECKLIST.length * 10;
  const passCount = AQC_CHECKLIST.filter((item) => (scores[item.key] || 0) >= 9).length;

  // Auto-suggest verdict from total
  function autoVerdict() {
    if (total >= 110) setVerdict("pass");
    else if (total >= 90) setVerdict("warn");
    else setVerdict("fail");
  }

  // Median price from comparables for hint
  const compMedian = useMemo(() => {
    const prices = comparables
      .map((c) => c.listing_price_cents ?? c.expected_price_cents ?? 0)
      .filter((p) => p > 0)
      .sort((a, b) => a - b);
    if (prices.length === 0) return null;
    return prices[Math.floor(prices.length / 2)];
  }, [comparables]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = parsePriceToCents(priceInput);
    if (verdict !== "fail" && (!cents || cents <= 0)) {
      setError("Podaj rekomendowaną cenę listingową.");
      return;
    }
    startTransition(async () => {
      const result = await saveAqc({
        productId,
        scores,
        verdict,
        notes,
        recommendedPriceCents: cents ?? 0,
      });
      if (!result.ok) {
        setError(result.error ?? "Nie udało się zapisać audytu.");
        return;
      }
      router.push("/admin/aqc");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-12 gap-6">

        {/* Checklist */}
        <div className="col-span-12 lg:col-span-7">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="label">Checklist · 12 punktów</div>
              <h2 className="mt-2 font-bold text-2xl tracking-[-0.025em]">Audyt autentyczności</h2>
            </div>
            <button type="button" onClick={autoVerdict} className="text-[12px] text-text-soft hover:text-blue">
              Auto-werdykt z wyniku
            </button>
          </div>

          <div className="card overflow-hidden">
            {AQC_CHECKLIST.map((item, i) => (
              <ScoreRow
                key={item.key}
                index={i}
                label={item.label}
                value={scores[item.key]}
                onChange={(v) => setScores({ ...scores, [item.key]: v })}
              />
            ))}
            <div className="px-5 py-4 bg-bg-soft/50 flex items-center justify-between">
              <span className="text-[13px] text-text-soft">Łącznie</span>
              <span className="font-bold text-2xl tracking-[-0.025em] num">
                {total} <span className="text-text-mute text-base font-normal">/ {totalMax}</span>
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-6">
            <label className="input-label">Notatka inspektora (widoczna dla klienta)</label>
            <textarea
              className="input min-h-[120px] resize-y"
              placeholder="Uzasadnienie werdyktu, drobne wady, sugestie napraw…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Side: verdict + price */}
        <aside className="col-span-12 lg:col-span-5 space-y-5">
          <div className="card p-6">
            <div className="label mb-3">Werdykt</div>
            <div className="grid grid-cols-3 gap-2">
              <VerdictButton current={verdict} onChange={setVerdict} value="pass" label="PASS" cls="border-mint/40 bg-mint/5 text-mint" />
              <VerdictButton current={verdict} onChange={setVerdict} value="warn" label="WARN" cls="border-amber/40 bg-amber/5 text-amber" />
              <VerdictButton current={verdict} onChange={setVerdict} value="fail" label="FAIL" cls="border-coral/40 bg-coral/5 text-coral" />
            </div>
            <div className="mt-4 text-[12px] text-text-mute">
              {verdict === "pass" && "Listing aktywny po zapisie. Cena listingowa = rekomendowana."}
              {verdict === "warn" && "Listing aktywny, ale klient widzi ostrzeżenie o stanie."}
              {verdict === "fail" && "Auto-zwrot. Klient dostanie powiadomienie z decyzją."}
            </div>
          </div>

          {verdict !== "fail" && (
            <div className="card p-6">
              <div className="label mb-3">Cena listingowa (rekomend.)</div>
              <div className="flex items-baseline gap-2 border-b border-border focus-within:border-blue py-3">
                <input
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="0"
                  className="bg-transparent flex-1 outline-none font-bold text-3xl tracking-[-0.04em] num"
                />
                <span className="text-text-mute text-sm">zł</span>
              </div>
              {compMedian != null && (
                <div className="mt-3 flex items-center gap-2 text-[12px] text-text-mute">
                  <span>Mediana porównywalnych:</span>
                  <button
                    type="button"
                    onClick={() => setPriceInput((compMedian / 100).toFixed(0))}
                    className="text-blue hover:text-blue-soft num"
                  >
                    {formatPLN(compMedian, { decimals: false })}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="card p-6">
            <div className="label mb-3">Porównywalne · {comparables.length}</div>
            {comparables.length === 0 ? (
              <p className="text-[13px] text-text-mute">Brak danych historycznych dla tej marki.</p>
            ) : (
              <ul className="space-y-2.5 text-[13px]">
                {comparables.map((c, i) => {
                  const price = c.listing_price_cents ?? c.expected_price_cents ?? 0;
                  return (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate">{c.model}</div>
                        <div className="text-[11px] text-text-mute">stan {c.condition ?? "?"}/10 · {c.status}</div>
                      </div>
                      <div className="font-semibold num">{formatPLN(price, { decimals: false })}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <div className="text-[12px] text-text-mute">
              <strong className="text-text">Score breakdown:</strong> {passCount} / 12 punktów ≥ 9 · ogółem {total}/{totalMax}
            </div>
          </div>
        </aside>
      </div>

      {error && (
        <div className="mt-6 rounded-[10px] bg-coral/10 border border-coral/30 px-4 py-3 text-[13px] text-coral">{error}</div>
      )}

      <div className="mt-8 flex items-center gap-4 flex-wrap">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary h-12 px-7 text-[14px] inline-flex items-center gap-3"
        >
          {isPending ? "Zapisywanie…" : (
            <>{alreadyDone ? "Aktualizuj werdykt" : "Zatwierdź audyt"} <ArrowRight size={16} /></>
          )}
        </button>
        {alreadyDone && (
          <span className="text-[12px] text-text-mute">Audyt został już wcześniej zapisany — możesz go zaktualizować.</span>
        )}
      </div>
    </form>
  );
}

function ScoreRow({ index, label, value, onChange }: { index: number; label: string; value: number; onChange: (v: number) => void }) {
  const colorCls = value >= 9 ? "text-mint" : value >= 6 ? "text-amber" : "text-coral";
  return (
    <div className="flex items-center gap-4 px-5 py-3 border-b border-border-soft last:border-0">
      <span className="text-text-mute text-[12px] num w-6">{String(index + 1).padStart(2, "0")}</span>
      <span className="flex-1 text-[14px]">{label}</span>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-32 accent-blue"
      />
      <span className={`font-bold text-[15px] tracking-[-0.025em] num w-12 text-right ${colorCls}`}>
        {value}/10
      </span>
    </div>
  );
}

function VerdictButton({
  current, onChange, value, label, cls,
}: {
  current: AqcVerdict;
  onChange: (v: AqcVerdict) => void;
  value: AqcVerdict;
  label: string;
  cls: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`px-4 py-3 rounded-[12px] border-2 font-semibold text-[13px] transition-all ${
        active ? cls : "border-border bg-surface text-text-soft hover:bg-surface-2"
      }`}
    >
      {label}
    </button>
  );
}
