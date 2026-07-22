"use client";

import { useRef, useState, useTransition } from "react";
import type { ProductStatus } from "@/lib/types";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Pill, ProductStatusPill } from "@/components/panel/StatusPill";
import { formatPLN, plural, POSTAL_RE } from "@/lib/format";
import { requestFulfillment } from "./actions";

export type FulfillmentProduct = {
  id: string;
  brand: string;
  model: string;
  size: string | null;
  sku: string;
  price_cents: number;
  photo_url: string | null;
  status: ProductStatus;
};

type RequestType = "label_provided" | "generate_label";

const MAX_LABEL_BYTES = 10 * 1024 * 1024;

export function FulfillmentRequestForm({
  products,
  busyIds,
}: {
  products: FulfillmentProduct[];
  busyIds: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const busy = new Set(busyIds);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setModeRaw] = useState<RequestType>("label_provided");
  const [labelFile, setLabelFile] = useState<File | null>(null);
  // Zmiana trybu odmontowuje <input type=file> — stan pliku musi iść razem
  // z nim, inaczej UI pokazuje "załączony" plik, którego nie ma w FormData.
  const setMode = (m: RequestType) => {
    setModeRaw(m);
    setLabelFile(null);
  };
  const [recipient, setRecipient] = useState({ name: "", address: "", postal: "", city: "" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const count = selected.size;
  const modeValid =
    mode === "label_provided"
      ? labelFile != null && labelFile.size <= MAX_LABEL_BYTES
      : recipient.name.trim() !== "" &&
        recipient.address.trim() !== "" &&
        POSTAL_RE.test(recipient.postal) &&
        recipient.city.trim() !== "";
  const canSubmit = count > 0 && modeValid && !pending;

  function submit(formData: FormData) {
    setError(null);
    setSuccess(false);
    formData.set("product_ids", Array.from(selected).join(","));
    formData.set("request_type", mode);
    startTransition(async () => {
      const res = await requestFulfillment(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      setSelected(new Set());
      setLabelFile(null);
      setRecipient({ name: "", address: "", postal: "", city: "" });
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-6">
      {/* Grid produktów */}
      <div>
        <div className="label mb-3">Wybierz produkty do wysyłki</div>
        <p className="mb-4 -mt-1 text-[12px] text-text-mute">
          Pokazujemy produkty w sprzedaży z wgranymi packshotami — wybierasz po zdjęciu.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {products.map((p) => {
            const isBusy = busy.has(p.id);
            const active = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={active}
                disabled={isBusy}
                className={`relative text-left rounded-[16px] border-2 p-3 transition-colors active:scale-[.99] focus-visible:outline-2 focus-visible:outline-lime focus-visible:outline-offset-2 ${
                  isBusy
                    ? "opacity-50 pointer-events-none border-border bg-surface"
                    : active
                      ? "border-lime/60 bg-lime/5"
                      : "border-border hover:border-text-mute bg-surface"
                }`}
              >
                {/* Checkbox w rogu */}
                <span
                  className={`absolute top-3 right-3 z-10 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    active ? "border-lime bg-lime" : "border-border bg-surface/80"
                  }`}
                  aria-hidden
                >
                  {active && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>

                {/* Zdjęcie */}
                <span className="block relative aspect-square rounded-[12px] overflow-hidden bg-surface-2">
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo_url}
                      loading="lazy"
                      alt={`${p.brand} ${p.model}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-text-mute">
                      {p.brand.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>

                <span className="block mt-3 text-[13px] font-medium leading-[1.3] truncate">
                  {p.brand} {p.model}
                </span>
                <span className="block mt-1 text-[11px] num text-text-mute truncate">
                  {p.sku}
                  {p.size ? ` · ${p.size}` : ""}
                </span>
                <span className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[13px] num">{formatPLN(p.price_cents, { decimals: false })}</span>
                  {isBusy ? <Pill variant="blue">Zlecone</Pill> : <ProductStatusPill status={p.status} />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pasek podsumowania */}
        <div className="mt-3 text-[13px] text-text-soft" aria-live="polite">
          Zaznaczono <span className="num font-medium text-text">{count}</span>{" "}
          {plural(count, ["produkt", "produkty", "produktów"])}
        </div>
      </div>

      {/* Tryb: własny list vs generowanie */}
      <div>
        <div className="label mb-3">List przewozowy</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModeCard
            title="Mam list przewozowy"
            desc="Prześlij gotową etykietę (PDF, PNG lub JPG, max 10 MB) — naklejamy i wysyłamy."
            active={mode === "label_provided"}
            onClick={() => setMode("label_provided")}
          />
          <ModeCard
            title="Wygenerujcie list za mnie"
            desc="Podaj dane odbiorcy, a my przygotujemy etykietę u wybranego kuriera."
            active={mode === "generate_label"}
            onClick={() => setMode("generate_label")}
          />
        </div>

        {mode === "label_provided" ? (
          <label
            className={`mt-4 block cursor-pointer border-2 border-dashed rounded-[16px] py-8 px-6 text-center transition-colors ${
              labelFile ? "border-lime/50 bg-lime/5" : "border-border hover:border-text-mute bg-surface"
            }`}
          >
            <input
              type="file"
              name="label"
              accept=".pdf,.png,.jpg,.jpeg"
              className="sr-only"
              onChange={(e) => setLabelFile(e.target.files?.[0] ?? null)}
            />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-text-mute mb-2.5" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span className="block text-[14px] font-medium">
              {labelFile ? labelFile.name : "Kliknij, żeby wybrać plik etykiety"}
            </span>
            <span className="block mt-1 text-[12px] text-text-mute">
              {labelFile ? "Kliknij, aby wybrać inny plik" : "PDF, PNG lub JPG · max 10 MB"}
            </span>
            {labelFile && labelFile.size > MAX_LABEL_BYTES && (
              <span className="block mt-2 text-[12px] text-coral">Plik przekracza 10 MB — wybierz mniejszy.</span>
            )}
          </label>
        ) : (
          <div className="mt-4 card p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label" htmlFor="ff-name">Imię i nazwisko odbiorcy</label>
              <input
                id="ff-name"
                name="recipient_name"
                className="input"
                placeholder="Jan Kowalski"
                required
                value={recipient.name}
                onChange={(e) => setRecipient((r) => ({ ...r, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="ff-phone">Telefon (opcjonalnie)</label>
              <input
                id="ff-phone"
                name="recipient_phone"
                type="tel"
                className="input"
                placeholder="+48 600 000 000"
              />
            </div>
            <div className="md:col-span-2">
              <label className="input-label" htmlFor="ff-address">Adres (ulica i numer)</label>
              <input
                id="ff-address"
                name="recipient_address_line"
                className="input"
                placeholder="ul. Przykładowa 12/3"
                required
                value={recipient.address}
                onChange={(e) => setRecipient((r) => ({ ...r, address: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="ff-postal">Kod pocztowy</label>
              <input
                id="ff-postal"
                name="recipient_postal_code"
                className="input"
                placeholder="00-001"
                required
                pattern="\d{2}-\d{3}"
                value={recipient.postal}
                onChange={(e) => setRecipient((r) => ({ ...r, postal: e.target.value }))}
              />
              {recipient.postal !== "" && !POSTAL_RE.test(recipient.postal) && (
                <div className="mt-1 text-[12px] text-coral">Format: 00-000</div>
              )}
            </div>
            <div>
              <label className="input-label" htmlFor="ff-city">Miasto</label>
              <input
                id="ff-city"
                name="recipient_city"
                className="input"
                placeholder="Warszawa"
                required
                value={recipient.city}
                onChange={(e) => setRecipient((r) => ({ ...r, city: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="input-label" htmlFor="ff-carrier">Kurier (opcjonalnie)</label>
              <Select id="ff-carrier" name="carrier" defaultValue="">
                <option value="">Dowolny — wybierze Kickback</option>
                <option value="DPD">DPD</option>
                <option value="InPost">InPost</option>
                <option value="DHL">DHL</option>
                <option value="UPS">UPS</option>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Uwagi */}
      <div>
        <label className="input-label" htmlFor="ff-notes">Uwagi (opcjonalnie)</label>
        <textarea
          id="ff-notes"
          name="notes"
          rows={3}
          className="input min-h-[88px] resize-y"
          placeholder="Np. proszę o wysyłkę po 15:00, dodatkowe zabezpieczenie pudełka…"
        />
      </div>

      {success && (
        <div className="rounded-[12px] bg-mint/10 border border-mint/30 px-4 py-3 text-[13px] text-mint flex items-center gap-3" role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
          </svg>
          Zlecenie przyjęte — obsłużymy je w 24h robocze.
        </div>
      )}
      {error && (
        <div className="rounded-[12px] bg-coral/10 border border-coral/30 px-4 py-3 text-[13px] text-coral" role="alert">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end">
        <button type="submit" disabled={!canSubmit} className="btn-primary h-12 px-7 text-[14px]">
          {pending ? "Wysyłanie…" : `Zleć wysyłkę (${count})`}
        </button>
      </div>
    </form>
  );
}

/* Radio-karta trybu — wzorzec MethodCard z umowa/UmowaSign.tsx. */
function ModeCard({
  title, desc, active, onClick,
}: {
  title: string; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left p-5 rounded-[16px] border-2 transition-colors active:scale-[.99] focus-visible:outline-2 focus-visible:outline-lime focus-visible:outline-offset-2 ${
        active ? "border-lime/60 bg-lime/5" : "border-border hover:border-text-mute bg-surface"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="font-semibold text-[16px] tracking-[-0.02em]">{title}</span>
        <span className={`h-5 w-5 flex-shrink-0 rounded-full border-2 ${active ? "border-lime bg-lime" : "border-border"} flex items-center justify-center`}>
          {active && <span className="h-2 w-2 rounded-full bg-on-accent" />}
        </span>
      </span>
      <span className="block mt-2 text-[13px] text-text-soft leading-[1.5]">{desc}</span>
    </button>
  );
}
