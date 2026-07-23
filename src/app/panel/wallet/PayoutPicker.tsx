"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Pill } from "@/components/panel/StatusPill";
import { formatPLN, formatDate, plural } from "@/lib/format";
import { requestPayoutForProducts } from "./actions";

/* Wypłata per pozycja: komisant zaznacza sprzedane produkty i zleca
   wypłatę dokładnie za nie (żadnych kwot ręcznych ani procentów).
   Przy zaznaczeniu pokazujemy wymóg dokumentu: UKS (indywidualni)
   albo faktura (firmy). */

export type PayoutRow = {
  id: string;
  name: string;
  soldAt: string | null;
  amountCents: number;
  state: "available" | "pending" | "in_payout";
  availableAt: string | null;
  payoutStatus: string | null;
};

export function PayoutPicker({ rows, isBusiness }: { rows: PayoutRow[]; isBusiness: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const selectable = useMemo(() => rows.filter((r) => r.state === "available"), [rows]);
  const sum = useMemo(
    () => rows.filter((r) => selected.has(r.id)).reduce((a, r) => a + r.amountCents, 0),
    [rows, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-[13px] text-text-soft">
        Tu pojawią się Twoje sprzedane pozycje — wypłatę zlecasz zaznaczając konkretne produkty.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="hidden md:grid grid-cols-[44px_minmax(200px,1fr)_120px_140px_150px] gap-3 px-4 h-11 label border-b border-border items-center">
        <div />
        <div>Pozycja</div>
        <div>Sprzedano</div>
        <div className="text-right">Kwota (po prowizji)</div>
        <div className="text-right">Status środków</div>
      </div>

      {rows.map((r) => {
        const disabled = r.state !== "available";
        const checked = selected.has(r.id);
        return (
          <label
            key={r.id}
            className={`grid grid-cols-[44px_minmax(0,1fr)_auto] md:grid-cols-[44px_minmax(200px,1fr)_120px_140px_150px] gap-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 transition-colors ${
              disabled ? "opacity-55" : "cursor-pointer hover:bg-surface-2/40"
            } ${checked ? "bg-lime/5" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled || pending}
              onChange={() => { toggle(r.id); setMsg(null); }}
              className="h-4 w-4 accent-[#66FF33] cursor-pointer disabled:cursor-not-allowed"
              aria-label={`Wypłać za: ${r.name}`}
            />
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium truncate">{r.name}</div>
              <div className="md:hidden text-[11px] text-text-mute num">{r.soldAt ? formatDate(r.soldAt) : "—"}</div>
            </div>
            <div className="hidden md:block text-[12px] num text-text-soft">{r.soldAt ? formatDate(r.soldAt) : "—"}</div>
            <div className="text-[13px] num text-right font-medium">{formatPLN(r.amountCents, { decimals: false })}</div>
            <div className="text-right">
              {r.state === "available" && <Pill variant="mint">Dostępne</Pill>}
              {r.state === "pending" && (
                <Pill variant="yellow">Pending payout{r.availableAt ? ` · ${formatDate(r.availableAt)}` : ""}</Pill>
              )}
              {r.state === "in_payout" && (
                <Pill variant="blue">{r.payoutStatus === "done" ? "Wypłacone" : "W wypłacie"}</Pill>
              )}
            </div>
          </label>
        );
      })}

      {/* Podsumowanie + wymóg dokumentu + zlecenie */}
      <div className="px-4 py-4 bg-surface-2/30 border-t border-border">
        {selected.size > 0 && (
          <div className="kb-in mb-3 rounded-[12px] bg-blue/8 border border-blue/25 px-4 py-3 text-[12.5px] leading-[1.55] text-text-soft">
            {isBusiness ? (
              <>
                Do wypłaty za zaznaczone pozycje <span className="font-medium text-text">wystaw fakturę na {formatPLN(sum, { decimals: false })}</span>{" "}
                i wgraj ją w <Link href="/panel/faktury" className="text-lime hover:underline">Fakturach</Link>.
              </>
            ) : (
              <>
                Zlecenie wygeneruje <span className="font-medium text-text">UKS (Umowę Kupna-Sprzedaży)</span> za zaznaczone pozycje —
                podpiszesz ją w zakładce <Link href="/panel/uks" className="text-lime hover:underline">UKS</Link>.
              </>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px]">
            {selected.size === 0 ? (
              <span className="text-text-mute">
                Zaznacz pozycje do wypłaty{selectable.length ? ` · dostępnych: ${selectable.length}` : ""}
              </span>
            ) : (
              <>
                <span className="text-text-soft">{selected.size} {plural(selected.size, ["pozycja", "pozycje", "pozycji"])} · </span>
                <span className="num font-semibold text-mint">{formatPLN(sum, { decimals: false })}</span>
              </>
            )}
          </div>
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={() =>
              start(async () => {
                const res = await requestPayoutForProducts(Array.from(selected));
                if (res.ok) {
                  setSelected(new Set());
                  setMsg({ ok: true, text: "Wypłata zlecona — czeka na autoryzację Kickback." });
                } else {
                  setMsg({ ok: false, text: res.error });
                }
              })
            }
            className="btn-primary h-11 px-6 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Zlecam…" : "Zleć wypłatę"}
          </button>
        </div>
        {msg && (
          <div className={`mt-3 text-[12.5px] ${msg.ok ? "text-mint" : "text-coral"}`} role="status">{msg.text}</div>
        )}
      </div>
    </div>
  );
}
