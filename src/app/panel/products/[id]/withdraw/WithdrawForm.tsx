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
        <span className="input-label">Powód wycofania</span>
        <div className="space-y-3">
          {availableReasons.map((r) => {
            const info = allReasons[r];
            const active = reason === r;
            return (
              <label
                key={r}
                className={`block p-5 rounded-[16px] border cursor-pointer transition-colors ${
                  active
                    ? "border-lime/40 bg-lime/10"
                    : "border-border bg-surface hover:bg-surface-2"
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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`mt-1 h-[11px] w-[11px] rounded-full flex-shrink-0 ${
                        active ? "bg-lime" : "border border-border bg-transparent"
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className={`text-[14px] font-medium ${active ? "text-lime" : ""}`}>{info.title}</div>
                      <div className="mt-1 text-[13px] text-text-soft leading-[1.55]">{info.description}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="label">Opłata</div>
                    <div className={`mt-1 text-[16px] font-medium num ${info.fee > 0 ? "text-yellow" : "text-mint"}`}>
                      {info.fee === 0 ? "0 zł" : formatPLN(info.fee, { decimals: false })}
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Baner opłaty dla wybranego powodu — żółty wzorzec / mint gdy gratis */}
      <div
        className={`rounded-[14px] border p-4 flex items-start gap-3 ${
          reasonInfo.fee > 0 ? "bg-yellow/8 border-yellow/25" : "bg-mint/8 border-mint/25"
        }`}
      >
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`mt-0.5 flex-shrink-0 ${reasonInfo.fee > 0 ? "text-yellow" : "text-mint"}`}
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
        <div className="text-[12px]">
          <div className={`font-medium ${reasonInfo.fee > 0 ? "text-yellow" : "text-mint"}`}>
            {reasonInfo.fee > 0 ? (
              <>Opłata <span className="num">{formatPLN(reasonInfo.fee, { decimals: false })}</span></>
            ) : (
              "Bez opłaty"
            )}
          </div>
          <p className="mt-1 text-text-soft leading-[1.55]">
            {reasonInfo.fee > 0
              ? "Kwota zostanie pobrana z Twojego Wallet po potwierdzeniu. Jeśli saldo jest niewystarczające, zostanie naliczona przy najbliższej sprzedaży. "
              : ""}
            Po wycofaniu skontaktujemy się z Tobą w sprawie odbioru z magazynu.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 accent-lime"
        />
        <span className="text-[13px] leading-[1.55] text-text-soft">
          Potwierdzam, że chcę wycofać ten produkt z konsygnacji i akceptuję ewentualną opłatę zgodnie z polityką zwrotów Kickback.
        </span>
      </label>

      {error && (
        <div className="rounded-[14px] bg-coral/8 border border-coral/25 px-4 py-3 text-[13px] text-coral">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="submit"
          disabled={isPending || !confirmed}
          className="btn-primary h-12 px-7 text-[14px] inline-flex items-center justify-center gap-3"
        >
          {isPending ? "Wycofywanie…" : <>Potwierdź wycofanie <ArrowRight size={16} /></>}
        </button>
        <a
          href={`/panel/products/${productId}`}
          className="text-[14px] text-text-soft hover:text-text transition-colors"
        >
          Anuluj
        </a>
      </div>
    </form>
  );
}
