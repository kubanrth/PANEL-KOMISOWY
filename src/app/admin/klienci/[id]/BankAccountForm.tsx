"use client";

import { useState, useTransition } from "react";
import { setClientBankAccount } from "./actions";

export function BankAccountForm({ klientId }: { klientId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      action={(fd) =>
        start(async () => {
          setMsg(null);
          fd.set("klient_id", klientId);
          const r = await setClientBankAccount(fd);
          setMsg(r.ok ? { ok: true, text: "Konto zapisane jako domyślne." } : { ok: false, text: r.error });
        })
      }
      className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 items-end"
    >
      <div>
        <label className="input-label" htmlFor="bank_name">Bank</label>
        <input id="bank_name" name="bank_name" required placeholder="mBank" className="input !h-10" />
      </div>
      <div>
        <label className="input-label" htmlFor="iban">IBAN (PL + 26 cyfr)</label>
        <input id="iban" name="iban" required placeholder="PL61 1090 1014 0000 0712 1981 2874" className="input !h-10 num" />
      </div>
      <button type="submit" disabled={pending} className="btn-ghost h-10 px-4 text-[13px]">
        {pending ? "Zapisuję…" : "Ustaw konto"}
      </button>
      {msg && (
        <div className={`md:col-span-3 text-[12px] ${msg.ok ? "text-mint" : "text-coral"}`}>{msg.text}</div>
      )}
    </form>
  );
}
