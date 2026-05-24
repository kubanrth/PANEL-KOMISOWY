"use client";

import { useRef, useState, useTransition } from "react";
import { uploadInvoice } from "./actions";

export function UploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await uploadInvoice(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess("Faktura wgrana — administrator otrzymał powiadomienie.");
      formRef.current?.reset();
      setFileName(null);
    });
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="card-elev p-6 space-y-5"
    >
      <div>
        <div className="label">Wgraj fakturę lub UKS</div>
        <p className="mt-1 text-[13px] text-text-soft">
          Przeciągnij plik PDF / JPG (max 10 MB) lub kliknij żeby wybrać. Po wgraniu administrator weryfikuje
          dokument i odblokowuje Funds w Wallet.
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) {
            const input = formRef.current?.querySelector<HTMLInputElement>('input[name="file"]');
            if (input) {
              const dt = new DataTransfer();
              dt.items.add(f);
              input.files = dt.files;
              setFileName(f.name);
            }
          }
        }}
        className={`block cursor-pointer border-2 border-dashed rounded-[16px] py-10 px-6 text-center transition-colors ${
          dragOver ? "border-blue bg-blue/5" : "border-border hover:border-text-mute bg-surface"
        }`}
      >
        <input
          type="file"
          name="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-text-mute mb-3">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <div className="text-[14px] font-medium">{fileName ? fileName : "Przeciągnij plik tutaj"}</div>
        <div className="mt-1 text-[12px] text-text-mute">{fileName ? "Kliknij aby wybrać inny" : "albo kliknij aby wybrać"}</div>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="input-label">Typ dokumentu</label>
          <select name="type" defaultValue="faktura_vat" className="input">
            <option value="faktura_vat">Faktura VAT</option>
            <option value="uks">UKS</option>
            <option value="inne">Inne</option>
          </select>
        </div>
        <div>
          <label className="input-label">Numer dokumentu</label>
          <input name="invoice_number" placeholder="FV/2026/05/001" className="input" />
        </div>
        <div>
          <label className="input-label">Kwota (zł)</label>
          <input name="amount" placeholder="2480" className="input" />
        </div>
      </div>

      {error && <div className="text-[13px] text-coral">{error}</div>}
      {success && <div className="text-[13px] text-mint">{success}</div>}

      <div className="flex items-center justify-end gap-3">
        <button type="submit" disabled={pending} className="btn-primary h-10 px-5 text-[14px]">
          {pending ? "Wgrywam…" : "Wgraj dokument"}
        </button>
      </div>
    </form>
  );
}
