"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@/components/ui/Button";
import { formatPLN, parsePriceToCents } from "@/lib/format";

type Action = (formData: FormData) => Promise<unknown>;

export function OfferComposer({
  productId, action, actionName, currentPriceCents, buyerOfferCents,
}: {
  productId: string;
  action: Action;
  actionName: string;
  currentPriceCents: number;
  buyerOfferCents: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amountInput, setAmountInput] = useState(
    buyerOfferCents != null ? String(Math.round(((buyerOfferCents + currentPriceCents) / 2) / 100)) : "",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cents = parsePriceToCents(amountInput);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cents || cents <= 0) {
      setError("Podaj kwotę kontroferty.");
      return;
    }
    const fd = new FormData();
    fd.set("product_id", productId);
    fd.set("amount_cents", String(cents));
    fd.set("message", message);
    startTransition(async () => {
      await action(fd);
      router.refresh();
      setAmountInput("");
      setMessage("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-12 gap-3 items-end">
        <div className="col-span-12 md:col-span-4">
          <label className="input-label">Kwota kontroferty</label>
          <div className="flex items-baseline gap-2 border-b border-border focus-within:border-blue py-2">
            <input
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0"
              className="bg-transparent flex-1 outline-none font-bold text-2xl tracking-[-0.04em] num"
            />
            <span className="text-text-mute text-sm">zł</span>
          </div>
        </div>
        <div className="col-span-12 md:col-span-8">
          <label className="input-label">Wiadomość (opcjonalna)</label>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mogę zejść do tej ceny pod warunkiem szybkiej płatności…"
            className="input"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {currentPriceCents > 0 && (
          <button type="button" onClick={() => setAmountInput(String(Math.round(currentPriceCents / 100)))} className="px-3 py-1.5 rounded-[8px] bg-surface-2 border border-border hover:border-blue transition-colors">
            = listing {formatPLN(currentPriceCents, { decimals: false })}
          </button>
        )}
        {currentPriceCents > 0 && (
          <button type="button" onClick={() => setAmountInput(String(Math.round(currentPriceCents * 0.95 / 100)))} className="px-3 py-1.5 rounded-[8px] bg-surface-2 border border-border hover:border-blue transition-colors">
            -5%
          </button>
        )}
        {buyerOfferCents != null && currentPriceCents > 0 && (
          <button type="button" onClick={() => setAmountInput(String(Math.round((currentPriceCents + buyerOfferCents) / 200)))} className="px-3 py-1.5 rounded-[8px] bg-surface-2 border border-border hover:border-blue transition-colors">
            środek
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-[10px] bg-coral/10 border border-coral/30 px-3 py-2 text-[12px] text-coral">{error}</div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary h-11 px-6 text-[13px] inline-flex items-center gap-2"
        data-action={actionName}
      >
        {isPending ? "Wysyłanie…" : <>Wyślij kontrofertę <ArrowRight size={14} /></>}
      </button>
    </form>
  );
}
