"use client";

import { useState, useTransition } from "react";
import { parsePriceToCents } from "@/lib/format";
import { decideProductOffer } from "./actions";

/** Decyzja per produkt: Akceptuj / Kontroferta (input) / Odrzuć. */
export function OfferDecision({ productId }: { productId: string }) {
  const [counter, setCounter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Nie udało się zapisać decyzji.");
    });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => decideProductOffer(productId, "accept"))}
          className="text-[12px] px-3 h-9 rounded-[10px] bg-mint/12 text-mint hover:bg-mint/20 transition-colors disabled:opacity-40"
        >
          Akceptuj cenę
        </button>
        <div className="flex items-center">
          <input
            value={counter}
            onChange={(e) => { setCounter(e.target.value); setError(null); }}
            placeholder="np. 1 400"
            inputMode="decimal"
            aria-label="Kontroferta (zł)"
            className="input !h-9 !w-[110px] !rounded-r-none text-[12px] num"
          />
          <button
            type="button"
            disabled={pending || !counter.trim()}
            onClick={() => {
              const cents = parsePriceToCents(counter);
              if (cents == null || cents <= 0) { setError("Podaj poprawną cenę kontroferty."); return; }
              run(() => decideProductOffer(productId, "counter", cents));
            }}
            className="text-[12px] px-3 h-9 rounded-r-[10px] bg-blue/12 text-blue-soft hover:bg-blue/20 transition-colors disabled:opacity-40 border border-l-0 border-border"
          >
            Kontroferta
          </button>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => decideProductOffer(productId, "reject"))}
          className="text-[12px] px-3 h-9 rounded-[10px] bg-coral/10 text-coral hover:bg-coral/20 transition-colors disabled:opacity-40"
        >
          Odrzuć
        </button>
      </div>
      {error && <div className="text-[11px] text-coral">{error}</div>}
    </div>
  );
}
