"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@/components/ui/Button";
import { formatPLN, parsePriceToCents } from "@/lib/format";
import { requestPayout } from "./actions";
import type { BankAccount } from "@/lib/types";

export function WithdrawForm({ available, accounts }: { available: number; accounts: BankAccount[] }) {
  const router = useRouter();
  const [amountInput, setAmountInput] = useState("");
  // Konto z umowy komisowej — wypłata zawsze na konto domyślne, bez wyboru w UI.
  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0];
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const amountCents = parsePriceToCents(amountInput);

  function setPercent(pct: number) {
    const target = Math.floor((available * pct) / 100);
    setAmountInput(((target / 100).toFixed(0)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!amountCents || amountCents <= 0) {
      setError("Podaj kwotę.");
      return;
    }
    if (amountCents > available) {
      setError(`Maksymalnie ${formatPLN(available, { decimals: false })}.`);
      return;
    }
    if (!defaultAccount) {
      setError("Brak przypiętego konta — skontaktuj się z opiekunem.");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("amount_cents", String(amountCents));
      fd.set("bank_account_id", defaultAccount.id);
      const res = await requestPayout(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      setAmountInput("");
      router.refresh();
    });
  }

  const noFunds = available <= 0;
  const noAccounts = accounts.length === 0;

  return (
    <form id="wyplata" onSubmit={handleSubmit} className="card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="label">Wypłać na konto</div>
        <span className="text-[11px] text-text-mute num">
          Dostępne {formatPLN(available, { decimals: false })}
        </span>
      </div>

      <div>
        <label className="input-label" htmlFor="amount">Kwota</label>
        <div className="flex items-baseline gap-2 border-b border-border focus-within:border-lime transition-colors py-3">
          <input
            id="amount"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/[^\d, .]/g, ""))}
            placeholder="0"
            className="bg-transparent flex-1 outline-none font-light text-[32px] tracking-[-0.02em] num"
            disabled={noFunds || noAccounts}
          />
          <span className="text-text-mute text-sm">zł</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setPercent(pct)}
              disabled={noFunds || noAccounts}
              className="text-[11px] px-3 py-1.5 rounded-[9px] bg-surface-2 border border-border text-text-soft hover:text-text hover:bg-surface-3 transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
            >
              {pct === 100 ? "Cała dostępna" : `${pct}%`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="input-label">Konto docelowe</div>
        {defaultAccount ? (
          <div className="text-[13px] text-text-soft num py-2">
            Konto z umowy: {defaultAccount.bank_name} •••• {defaultAccount.iban.slice(-4)}
          </div>
        ) : (
          <div className="text-[13px] text-text-mute py-2">
            Brak przypiętego konta — skontaktuj się z opiekunem.
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-[10px] bg-coral/10 border border-coral/30 px-3 py-2 text-[12px] text-coral">{error}</div>
      )}
      {success && (
        <div className="rounded-[10px] bg-mint/10 border border-mint/30 px-3 py-2 text-[12px] text-mint">
          Wypłata zlecona — oczekuje na autoryzację administratora.
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || noFunds || noAccounts || !amountCents}
        className="btn-primary w-full h-12 text-[14px] inline-flex items-center justify-center gap-2"
      >
        {isPending ? "Wysyłanie…" : <>Zleć wypłatę <ArrowRight size={14} /></>}
      </button>

      <p className="text-[11px] text-text-mute leading-relaxed">
        Czas realizacji do 24h roboczych. Wypłata wymaga autoryzacji administratora po stronie Kickback.
      </p>
    </form>
  );
}
