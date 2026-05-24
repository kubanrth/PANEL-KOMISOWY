"use client";

import { useRef, useState, useTransition } from "react";
import { submitSalesPlan } from "./actions";

export function PlanForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  return (
    <form
      ref={ref}
      action={(formData) =>
        start(async () => {
          setMsg(null);
          const res = await submitSalesPlan(formData);
          if (res.ok) {
            setMsg({ kind: "ok", text: "Plan zgłoszony — administrator otrzymał powiadomienie." });
            ref.current?.reset();
          } else {
            setMsg({ kind: "err", text: res.error });
          }
        })
      }
      className="card-elev p-6 space-y-5"
    >
      <div>
        <div className="label">Zgłoś plan sprzedaży</div>
        <p className="mt-1 text-[13px] text-text-soft">
          Zarezerwuj budżet marketingowy i opisz co planujesz wysłać. Po zatwierdzeniu Twoje pozycje
          otrzymują priorytetowy slot w A&amp;QC.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="input-label">Budżet marketingowy (zł)</label>
          <input name="marketing_budget" placeholder="500" className="input" />
        </div>
        <div>
          <label className="input-label">Oczekiwana wartość planowanych pozycji (zł)</label>
          <input name="expected_value" placeholder="12 000" className="input" />
        </div>
      </div>

      <div>
        <label className="input-label">Planowane pozycje</label>
        <textarea
          name="planned_items"
          rows={4}
          className="input min-h-[88px] resize-y"
          placeholder="Np: Real Madryt 2003/04 Zidane (XL), Bayern 2013 retro (M), Lewandowski Barcelona 2024/25..."
        />
      </div>

      {msg && (
        <div className={`text-[13px] ${msg.kind === "ok" ? "text-mint" : "text-coral"}`}>{msg.text}</div>
      )}

      <div className="flex items-center justify-end">
        <button type="submit" disabled={pending} className="btn-primary h-10 px-5 text-[14px]">
          {pending ? "Wysyłam…" : "Zgłoś plan"}
        </button>
      </div>
    </form>
  );
}
