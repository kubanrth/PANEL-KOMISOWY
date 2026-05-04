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
  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0];
  const [bankId, setBankId] = useState(defaultAccount?.id ?? "");
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
    if (!bankId) {
      setError("Wybierz konto.");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("amount_cents", String(amountCents));
      fd.set("bank_account_id", bankId);
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
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="label">Wypłać na konto</div>
        <span className="text-[11px] text-text-mute num">
          Dostępne {formatPLN(available, { decimals: false })}
        </span>
      </div>

      <div>
        <label className="input-label" htmlFor="amount">Kwota</label>
        <div className="flex items-baseline gap-2 border-b border-border focus-within:border-blue transition-colors py-3">
          <input
            id="amount"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/[^\d, .]/g, ""))}
            placeholder="0"
            className="bg-transparent flex-1 outline-none font-bold text-3xl tracking-[-0.04em] num"
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
              className="text-[11px] px-3 py-1.5 rounded-[8px] bg-surface-2 border border-border text-text-soft hover:text-text hover:border-blue transition-colors disabled:opacity-50"
            >
              {pct === 100 ? "Cała dostępna" : `${pct}%`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="input-label" htmlFor="bank">Konto docelowe</label>
        {accounts.length > 0 ? (
          <select
            id="bank"
            value={bankId}
            onChange={(e) => setBankId(e.target.value)}
            className="input"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bank_name} · {a.iban.slice(0, 6)}…{a.iban.slice(-4)} {a.is_default ? "(domyślne)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-[13px] text-text-mute">Dodaj najpierw konto w sekcji "Konta bankowe" poniżej.</div>
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
