"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatPLN, formatDate } from "@/lib/format";
import { vatLabel, type DerivedStatus } from "@/lib/types";

/* Krótkie etykiety statusów do pigułek w tabeli (jednoliniowe, wzór C4).
   Pełne opisy zostają w DERIVED_STATUS_LABEL dla innych widoków. */
const SHORT_STATUS: Record<DerivedStatus, string> = {
  w_trakcie_dostawy: "W dostawie",
  przyjeto: "Przyjęto",
  zdjecia: "Processing",
  oczekuje_publikacji: "Oczekuje",
  aktywny: "W sprzedaży",
};
import { DERIVED_STATUS_VARIANT } from "@/lib/derived-status";
import { requestPriceChange, bulkRequestWithdrawal } from "./actions";

export type MagazynRow = {
  id: string;
  brand: string;
  model: string;
  sku: string;
  size: string | null;
  vat_rate: number;
  photo_url: string | null;
  listing_price_cents: number;
  recommended_price_cents: number | null;
  published_at: string | null;
  derived_status: DerivedStatus;
  days_in_commission: number;
};

type Props = {
  rows: MagazynRow[];
};

/** Feedback per wiersz po submitPrice: pigułka „wysłano" albo błąd przy inpucie. */
type RowMsg = { kind: "sent" } | { kind: "error"; text: string };

/**
 * "1200" | "1200,50" | "1 200" | "1.200" | "1.200,50" → grosze.
 * Przecinek = separator dziesiętny; kropka jest dziesiętna tylko gdy po niej
 * są 1–2 cyfry (inaczej to separator tysięcy). null = niepoprawne.
 * Logika skopiowana do scripts/selfcheck.mjs (runnable check).
 */
export function parsePriceToCents(raw: string): number | null {
  const s = raw.replace(/[^\d.,]/g, "");
  if (!s || (s.match(/,/g) ?? []).length > 1) return null;
  let normalized: string;
  if (s.includes(",")) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = s.split(".");
    normalized = parts.length === 2 && parts[1].length <= 2 ? s : parts.join("");
  }
  const value = parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export function MagazynTable({ rows }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [rowMsg, setRowMsg] = useState<Record<string, RowMsg>>({});
  const [busy, startTransition] = useTransition();
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === rows.length) return new Set();
      return new Set(rows.map((r) => r.id));
    });
  }

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const previewFee = useMemo(() => {
    let fee = 0;
    let val = 0;
    for (const r of selectedRows) {
      val += r.listing_price_cents;
      if (r.days_in_commission < 60) {
        fee += Math.min(Math.round(r.listing_price_cents * 0.05), 50_000);
      }
    }
    return { fee, val };
  }, [selectedRows]);

  function submitPrice(id: string) {
    const cents = parsePriceToCents(priceEdits[id] ?? "");
    if (cents === null) {
      setRowMsg((prev) => ({ ...prev, [id]: { kind: "error", text: "Podaj poprawną cenę, np. 1200 lub 1200,50." } }));
      return;
    }
    startTransition(async () => {
      const result = await requestPriceChange(id, cents).catch(
        () => ({ ok: false as const, error: "Nie udało się wysłać. Spróbuj ponownie." }),
      );
      if (!result.ok) {
        setRowMsg((prev) => ({ ...prev, [id]: { kind: "error", text: result.error } }));
        return;
      }
      setRowMsg((prev) => ({ ...prev, [id]: { kind: "sent" } }));
      setPriceEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });
  }

  function openPriceEdit(id: string) {
    setRowMsg((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPriceEdits((prev) => ({ ...prev, [id]: "" }));
  }

  function editPriceValue(id: string, value: string) {
    setRowMsg((prev) => {
      if (prev[id]?.kind !== "error") return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPriceEdits((prev) => ({ ...prev, [id]: value }));
  }

  function confirmWithdraw() {
    setWithdrawError(null);
    startTransition(async () => {
      const ids = Array.from(selected);
      const result = await bulkRequestWithdrawal(ids);
      if (!result.ok) {
        setWithdrawError(result.error);
        return;
      }
      setSelected(new Set());
      setWithdrawConfirm(false);
    });
  }

  return (
    <div>
      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="sticky top-[60px] z-10 mb-4 card-elev p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[14px]">
            Zaznaczono <strong className="num">{selected.size}</strong> pozycji ·{" "}
            <span className="text-text-mute num">{formatPLN(previewFee.val, { decimals: false })}</span>
          </div>
          <div className="flex items-center gap-3">
            {previewFee.fee > 0 && (
              <span className="text-[13px] text-amber">
                Opłata wycofania ~ <strong className="num">{formatPLN(previewFee.fee, { decimals: false })}</strong>
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[13px] text-text-soft hover:text-text"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => setWithdrawConfirm(true)}
              disabled={busy}
              className="btn-ghost h-9 px-4 text-[13px]"
            >
              Wycofaj zaznaczone
            </button>
          </div>
        </div>
      )}

      {withdrawConfirm && (
        <div className="mb-4 card-elev p-5 border-amber/40">
          <div className="font-semibold text-[15px] mb-2">Potwierdź wycofanie</div>
          <p className="text-[13px] text-text-soft mb-3">
            <strong>Pamiętaj!</strong> Jeżeli wycofujesz produkty, które są na naszym magazynie poniżej 60 dni,
            zostanie naliczona opłata administracyjna w wysokości <strong>5% wartości</strong> wycofywanych
            produktów (maksymalnie 500 zł).
          </p>
          <p className="text-[13px] text-text-mute mb-4">
            Wycofujesz {selected.size} pozycji o łącznej wartości {formatPLN(previewFee.val, { decimals: false })}.
            {previewFee.fee > 0 && (
              <> Opłata: <span className="text-amber font-semibold">{formatPLN(previewFee.fee, { decimals: false })}</span>.</>
            )}
            {previewFee.fee === 0 && <> Bez opłat.</>}
          </p>
          {withdrawError && (
            <div className="mb-3 text-[12px] text-coral">{withdrawError}</div>
          )}
          <div className="flex items-center gap-3">
            <button type="button" onClick={confirmWithdraw} disabled={busy} className="btn-primary h-10 px-5 text-[13px]">
              {busy ? "Wycofuję…" : "Tak, wycofaj"}
            </button>
            <button type="button" onClick={() => setWithdrawConfirm(false)} className="text-[13px] text-text-soft hover:text-text">
              Cofnij
            </button>
          </div>
        </div>
      )}

      {/* Table — kolumny wg C4: SKU · Koszulka · Cena · VAT · W sprzedaży · Status · Akcje.
          (Sprzedano/Rozliczenie usunięte — stock nigdy ich nie ma; Publikacja w tooltipie Dni.) */}
      <div className="card table-scroll">
        <div className="hidden md:grid grid-cols-[28px_120px_minmax(220px,3fr)_150px_56px_90px_150px_150px] gap-3 px-4 h-11 label border-b border-border items-center">
          <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} className="cursor-pointer" aria-label="Zaznacz wszystkie" />
          <div>SKU</div>
          <div>Koszulka</div>
          <div>Cena</div>
          <div>VAT</div>
          <div>W sprzedaży</div>
          <div>Status</div>
          <div className="text-right">Akcje</div>
        </div>

        {rows.map((r) => {
          const checked = selected.has(r.id);
          const arrow = r.recommended_price_cents
            ? r.listing_price_cents <= r.recommended_price_cents * 1.05
              ? "ok"
              : r.listing_price_cents <= r.recommended_price_cents * 1.3
                ? "warn"
                : "bad"
            : "ok";
          const arrowColor = arrow === "ok" ? "text-mint" : arrow === "warn" ? "text-amber" : "text-coral";
          const arrowGlyph = arrow === "ok" ? "↘" : "↑";
          const variant = DERIVED_STATUS_VARIANT[r.derived_status];
          const statusCls = variant === "mint" ? "pill-mint" : variant === "blue" ? "pill-blue" : variant === "amber" ? "pill-amber" : "pill-mute";
          const inEdit = priceEdits[r.id] !== undefined;
          const msg = rowMsg[r.id];

          return (
            <div
              key={r.id}
              className={`border-b border-border-soft last:border-0 ${checked ? "bg-blue/5" : ""}`}
            >
            {/* Mobile card (< md) — kompakt, podstawowe info, akcje pod spodem */}
            <div className="md:hidden p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRow(r.id)}
                  className="cursor-pointer mt-1"
                />
                <div className="relative h-12 w-12 rounded-[8px] overflow-hidden bg-surface-2 flex-shrink-0">
                  {r.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo_url} alt={r.brand} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/panel/products/${r.id}`} className="block hover:text-blue">
                    <div className="text-[14px] font-medium truncate">{r.brand} · {r.model}</div>
                  </Link>
                  <div className="mt-0.5 text-[10px] num text-text-faint truncate">{r.sku}</div>
                  <div className="mt-0.5 text-[11px] text-text-mute num truncate">
                    {[r.size, vatLabel(r.vat_rate), `${r.days_in_commission} d`].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className={`pill ${statusCls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        variant === "mint" ? "bg-mint" : variant === "blue" ? "bg-blue-soft" : variant === "amber" ? "bg-amber" : "bg-text-mute"
                      }`} />
                      {SHORT_STATUS[r.derived_status]}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-[15px] num">
                    {formatPLN(r.listing_price_cents, { decimals: false })}
                  </div>
                  <div className={`text-[11px] num ${arrowColor}`} title={r.recommended_price_cents ? `Rekomendowana: ${formatPLN(r.recommended_price_cents, { decimals: false })}` : ""}>
                    {arrowGlyph} {r.recommended_price_cents ? "rec." : ""}
                  </div>
                </div>
              </div>

              {inEdit && (
                <div className="mt-3 pl-9 kb-in">
                  <div className="flex items-center gap-2">
                    <input
                      className="input !h-9 !text-[13px] flex-1"
                      placeholder="Nowa cena"
                      value={priceEdits[r.id]}
                      onChange={(e) => editPriceValue(r.id, e.target.value)}
                    />
                    <button onClick={() => submitPrice(r.id)} disabled={busy} className="btn-primary !h-9 px-3 text-[12px]">
                      Wyślij
                    </button>
                    <button
                      onClick={() => {
                        const next = { ...priceEdits };
                        delete next[r.id];
                        setPriceEdits(next);
                      }}
                      className="text-text-mute hover:text-coral text-[18px] px-2"
                    >
                      ×
                    </button>
                  </div>
                  {msg?.kind === "error" && (
                    <div className="mt-1.5 text-[12px] text-coral">{msg.text}</div>
                  )}
                </div>
              )}

              {!inEdit && (
                <div className="mt-2 pl-9 flex items-center gap-2 flex-wrap">
                  {msg?.kind === "sent" && (
                    <span className="pill pill-yellow">Wysłano do akceptacji</span>
                  )}
                  <button
                    type="button"
                    onClick={() => openPriceEdit(r.id)}
                    className="h-8 px-3 rounded-[9px] bg-lime/10 border border-lime/30 text-lime text-[12px] font-medium inline-flex items-center gap-1.5 hover:bg-lime/20 active:scale-[.98] transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></svg>
                    Zmień cenę
                  </button>
                </div>
              )}
            </div>

            {/* Desktop row (md+) — kolumny wg C4 */}
            <div
              className={`hidden md:grid grid-cols-[28px_120px_minmax(220px,3fr)_150px_56px_90px_150px_150px] gap-3 px-4 py-3.5 items-center hover:bg-surface-2/40 transition-colors`}
            >
              <input type="checkbox" checked={checked} onChange={() => toggleRow(r.id)} className="cursor-pointer" aria-label={`Zaznacz ${r.brand} ${r.model}`} />

              <div className="text-[11px] num text-text-mute truncate">{r.sku}</div>

              <div className="min-w-0 flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-[10px] overflow-hidden bg-surface-2 border border-border-soft flex-shrink-0 flex items-center justify-center">
                  {r.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo_url} alt={r.brand} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span className="text-[13px] font-medium text-text-soft">{r.brand[0]?.toUpperCase()}</span>
                  )}
                </div>
                <Link href={`/panel/products/${r.id}`} className="min-w-0 hover:text-lime transition-colors block">
                  <div className="text-[13.5px] font-medium truncate">{r.brand} {r.model}</div>
                  <div className="text-[11px] text-text-mute truncate">{r.size ? `rozm. ${r.size}` : "—"}</div>
                </Link>
              </div>

              <div>
                {inEdit ? (
                  <div className="kb-in">
                    <div className="flex items-center gap-1">
                      <input
                        className="input !h-8 !py-1 !px-2 !text-[12px] w-[88px]"
                        placeholder="nowa cena"
                        value={priceEdits[r.id]}
                        onChange={(e) => editPriceValue(r.id, e.target.value)}
                      />
                      <button onClick={() => submitPrice(r.id)} disabled={busy} className="btn-primary !h-8 !px-2 text-[11px]" title="Wyślij nową cenę">
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          const next = { ...priceEdits };
                          delete next[r.id];
                          setPriceEdits(next);
                        }}
                        className="text-text-mute hover:text-coral text-[14px] px-1"
                        title="Anuluj"
                      >
                        ×
                      </button>
                    </div>
                    {msg?.kind === "error" && (
                      <div className="mt-1 text-[11px] text-coral">{msg.text}</div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] num">
                        {formatPLN(r.listing_price_cents, { decimals: false })}
                      </span>
                      <span className={`${arrowColor} text-[12px] font-bold`} title={r.recommended_price_cents ? `Rekomendowana: ${formatPLN(r.recommended_price_cents, { decimals: false })}` : "Brak rekomendacji"}>
                        {arrowGlyph}
                      </span>
                    </div>
                    {msg?.kind === "sent" && (
                      <span className="pill pill-yellow mt-1">Wysłano do akceptacji</span>
                    )}
                  </div>
                )}
              </div>

              <div className="text-[12px] num text-text-soft">{vatLabel(r.vat_rate)}</div>
              <div
                className="text-[12px] num text-text-soft"
                title={r.published_at ? `Publikacja: ${formatDate(r.published_at)}` : "Jeszcze nie opublikowano"}
              >
                {r.days_in_commission} dni
              </div>

              <div>
                <span className={`pill ${statusCls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    variant === "mint" ? "bg-mint" : variant === "blue" ? "bg-blue-soft" : variant === "amber" ? "bg-amber" : "bg-text-mute"
                  }`} />
                  {SHORT_STATUS[r.derived_status]}
                </span>
              </div>

              <div className="flex items-center justify-end gap-1.5">
                <Link
                  href={`/panel/products/${r.id}`}
                  title="Podgląd produktu"
                  aria-label={`Podgląd ${r.brand} ${r.model}`}
                  className="h-8 w-8 rounded-[9px] bg-surface-2 border border-border-soft flex items-center justify-center text-text-mute hover:text-text transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                </Link>
                {!inEdit && (
                  <button
                    type="button"
                    onClick={() => openPriceEdit(r.id)}
                    aria-label={`Zmień cenę ${r.brand} ${r.model}`}
                    className="h-8 px-2.5 rounded-[9px] bg-lime/10 border border-lime/30 text-lime text-[11px] font-medium inline-flex items-center gap-1.5 hover:bg-lime/20 active:scale-[.98] transition-colors whitespace-nowrap"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></svg>
                    Zmień cenę
                  </button>
                )}
              </div>
            </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="px-6 py-12 text-center text-[13px] text-text-soft">
            Brak pozycji w magazynie.
          </div>
        )}
      </div>
    </div>
  );
}
