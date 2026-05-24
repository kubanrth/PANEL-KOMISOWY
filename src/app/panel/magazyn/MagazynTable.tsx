"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatPLN, formatDate } from "@/lib/format";
import { vatLabel, type DerivedStatus, DERIVED_STATUS_LABEL } from "@/lib/types";
import { DERIVED_STATUS_VARIANT } from "@/lib/derived-status";
import { requestPriceChange, bulkRequestWithdrawal } from "./actions";

export type MagazynRow = {
  id: string;
  brand: string;
  model: string;
  size: string | null;
  vat_rate: number;
  photo_url: string | null;
  listing_price_cents: number;
  recommended_price_cents: number | null;
  published_at: string | null;
  sold_at: string | null;
  settlement_at: string | null;
  derived_status: DerivedStatus;
  days_in_commission: number;
};

type Props = {
  rows: MagazynRow[];
};

export function MagazynTable({ rows }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
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
    const raw = priceEdits[id];
    if (!raw) return;
    const cents = Math.round(parseFloat(raw.replace(/[^\d.,]/g, "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    startTransition(async () => {
      const result = await requestPriceChange(id, cents);
      if (result.ok) {
        setPriceEdits((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
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

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="hidden md:grid grid-cols-[28px_minmax(220px,3fr)_44px_60px_140px_64px_94px_94px_120px_120px_140px_140px] gap-3 px-4 py-3 label border-b border-border-soft items-center">
          <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} className="cursor-pointer" />
          <div>Produkt</div>
          <div>Ilość</div>
          <div>Rozm.</div>
          <div>Cena</div>
          <div>VAT</div>
          <div>Publikacja</div>
          <div>Dni</div>
          <div>Sprzedano</div>
          <div>Rozliczenie</div>
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

          return (
            <div
              key={r.id}
              className={`grid grid-cols-[28px_minmax(220px,3fr)_44px_60px_140px_64px_94px_94px_120px_120px_140px_140px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/30 transition-colors ${checked ? "bg-blue/5" : ""}`}
            >
              <input type="checkbox" checked={checked} onChange={() => toggleRow(r.id)} className="cursor-pointer" />

              <div className="min-w-0 flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-[8px] overflow-hidden bg-surface-2 flex-shrink-0">
                  {r.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo_url} alt={r.brand} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                </div>
                <Link href={`/panel/products/${r.id}`} className="min-w-0 hover:text-blue transition-colors">
                  <div className="text-[13px] font-medium truncate">{r.brand} · {r.model}</div>
                </Link>
              </div>

              <div className="text-[13px] num text-text-soft">1</div>
              <div className="text-[12px] num text-text-soft">{r.size ?? "—"}</div>

              <div>
                {inEdit ? (
                  <div className="flex items-center gap-1">
                    <input
                      className="input !h-8 !py-1 !px-2 !text-[12px] w-[88px]"
                      placeholder="nowa cena"
                      value={priceEdits[r.id]}
                      onChange={(e) => setPriceEdits({ ...priceEdits, [r.id]: e.target.value })}
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
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[13px] num">
                      {formatPLN(r.listing_price_cents, { decimals: false })}
                    </span>
                    <span className={`${arrowColor} text-[12px] font-bold`} title={r.recommended_price_cents ? `Rekomendowana: ${formatPLN(r.recommended_price_cents, { decimals: false })}` : "Brak rekomendacji"}>
                      {arrowGlyph}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[12px] num text-text-soft">{vatLabel(r.vat_rate)}</div>
              <div className="text-[11px] num text-text-mute">{formatDate(r.published_at)}</div>
              <div className="text-[12px] num text-text-soft">{r.days_in_commission}</div>
              <div className={`text-[11px] num ${r.sold_at ? "text-text-soft" : "text-text-faint"}`}>
                {r.sold_at ? formatDate(r.sold_at) : "—"}
              </div>
              <div className={`text-[11px] num ${r.settlement_at ? "text-text-soft" : "text-text-faint"}`}>
                {r.settlement_at ? formatDate(r.settlement_at) : "—"}
              </div>

              <div>
                <span className={`pill ${statusCls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    variant === "mint" ? "bg-mint" : variant === "blue" ? "bg-blue-soft" : variant === "amber" ? "bg-amber" : "bg-text-mute"
                  }`} />
                  {DERIVED_STATUS_LABEL[r.derived_status]}
                </span>
              </div>

              <div className="text-right">
                {!inEdit && (
                  <button
                    type="button"
                    onClick={() => setPriceEdits({ ...priceEdits, [r.id]: "" })}
                    className="text-[11px] text-text-mute hover:text-blue transition-colors"
                  >
                    Zmień cenę
                  </button>
                )}
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
