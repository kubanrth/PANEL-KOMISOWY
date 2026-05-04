"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBankAccount } from "./actions";

export function AddBankAccountForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addBankAccount(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] text-blue hover:text-blue-soft inline-flex items-center gap-2"
      >
        + Dodaj konto bankowe
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label className="input-label" htmlFor="bank_name">Bank</label>
        <input id="bank_name" name="bank_name" required placeholder="Santander Bank Polska" className="input" />
      </div>
      <div>
        <label className="input-label" htmlFor="iban">IBAN (numer konta)</label>
        <input id="iban" name="iban" required placeholder="PL00 0000 0000 0000 0000 0000 0000" className="input" />
      </div>
      <label className="flex items-center gap-2 text-[13px] cursor-pointer">
        <input type="checkbox" name="is_default" className="accent-blue" defaultChecked />
        Ustaw jako domyślne
      </label>
      {error && (
        <div className="rounded-[8px] bg-coral/10 border border-coral/30 px-3 py-2 text-[12px] text-coral">{error}</div>
      )}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={isPending} className="btn-primary h-10 px-4 text-[13px]">
          {isPending ? "Zapisywanie…" : "Dodaj"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-text-soft hover:text-text">
          Anuluj
        </button>
      </div>
    </form>
  );
}
