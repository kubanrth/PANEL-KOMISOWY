"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@/components/ui/Button";
import { formatPLN } from "@/lib/format";
import { withdrawProduct } from "./actions";
import type { ReturnReason } from "@/lib/types";

export function WithdrawForm({
  productId, availableReasons, allReasons,
}: {
  productId: string;
  availableReasons: ReturnReason[];
  allReasons: Record<ReturnReason, { title: string; fee: number; description: string }>;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<ReturnReason>(availableReasons[0]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reasonInfo = allReasons[reason];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!confirmed) {
      setError("Potwierdź akceptację warunków wycofania.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("product_id", productId);
      fd.set("reason", reason);
      const res = await withdrawProduct(fd);
      if (!res.ok) {
        setError(res.error ?? "Nie udało się wycofać produktu.");
        return;
      }
      router.push(`/panel/products/${productId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-[760px]">
      <div>
        <div className="label mb-3">Powód wycofania</div>
        <div className="space-y-3">
          {availableReasons.map((r) => {
            const info = allReasons[r];
            const active = reason === r;
            return (
              <label
                key={r}
                className={`block p-5 rounded-[16px] border-2 cursor-pointer transition-all ${
                  active ? "border-blue bg-blue/5" : "border-border bg-surface hover:border-text-mute"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={active}
                  onChange={() => setReason(r)}
                  className="sr-only"
                />
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-[15px]">{info.title}</div>
                    <div className="mt-1 text-[13px] text-text-soft leading-[1.5]">{info.description}</div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className="text-[11px] text-text-mute">Opłata</div>
                    <div className="font-bold text-lg num">
                      {info.fee === 0 ? "GRATIS" : formatPLN(info.fee, { decimals: false })}
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className={`card p-5 ${reasonInfo.fee > 0 ? "border-amber/30 bg-amber/5" : "border-mint/30 bg-mint/5"}`}>
        <div className="text-[13px] leading-[1.6]">
          {reasonInfo.fee > 0 ? (
            <>
              <strong>Opłata {formatPLN(reasonInfo.fee, { decimals: false })}</strong> zostanie pobrana z Twojego Wallet po potwierdzeniu. Jeśli saldo jest niewystarczające, zostanie naliczone przy najbliższej sprzedaży.
            </>
          ) : (
            <strong>Bez opłaty.</strong>
          )}
          {" "}Po wycofaniu skontaktujemy się z Tobą w sprawie odbioru z magazynu.
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 accent-blue"
        />
        <span className="text-[13px] text-text-soft">
          Potwierdzam, że chcę wycofać ten produkt z konsygnacji i akceptuję ewentualną opłatę zgodnie z polityką zwrotów Kickback.
        </span>
      </label>

      {error && (
        <div className="rounded-[10px] bg-coral/10 border border-coral/30 px-4 py-3 text-[13px] text-coral">{error}</div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending || !confirmed}
          className="btn-primary h-12 px-7 text-[14px] inline-flex items-center gap-3"
        >
          {isPending ? "Wycofywanie…" : <>Potwierdź wycofanie <ArrowRight size={16} /></>}
        </button>
        <a href={`/panel/products/${productId}`} className="text-[14px] text-text-soft hover:text-text">
          Anuluj
        </a>
      </div>
    </form>
  );
}
