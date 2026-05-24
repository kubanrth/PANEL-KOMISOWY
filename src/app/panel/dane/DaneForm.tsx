"use client";

import { useState, useTransition } from "react";
import { updateBillingProfile } from "./actions";

type Props = {
  initial: {
    account_type: "individual" | "business" | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    pesel_or_id: string | null;
    company_name: string | null;
    nip: string | null;
    vat_id: string | null;
    address_line: string | null;
    postal_code: string | null;
    city: string | null;
  };
};

export function DaneForm({ initial }: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const isBusiness = initial.account_type === "business";

  return (
    <form
      action={(formData) =>
        start(async () => {
          setMsg(null);
          const res = await updateBillingProfile(formData);
          setMsg(res.ok ? { kind: "ok", text: "Zapisano dane rozliczeniowe." } : { kind: "err", text: res.error });
        })
      }
      className="space-y-8"
    >
      <FieldGroup title="Dane podstawowe">
        <Field name="first_name" label="Imię" defaultValue={initial.first_name ?? ""} />
        <Field name="last_name" label="Nazwisko" defaultValue={initial.last_name ?? ""} />
        <Field name="phone" label="Telefon" defaultValue={initial.phone ?? ""} />
        {!isBusiness && <Field name="pesel_or_id" label="PESEL / Nr dowodu" defaultValue={initial.pesel_or_id ?? ""} />}
      </FieldGroup>

      {isBusiness && (
        <FieldGroup title="Dane firmowe">
          <Field name="company_name" label="Nazwa firmy" defaultValue={initial.company_name ?? ""} colSpan={2} />
          <Field name="nip" label="NIP" defaultValue={initial.nip ?? ""} />
          <Field name="vat_id" label="VAT ID (EU)" defaultValue={initial.vat_id ?? ""} />
        </FieldGroup>
      )}

      <FieldGroup title="Adres rozliczeniowy">
        <Field name="address_line" label="Ulica i numer" defaultValue={initial.address_line ?? ""} colSpan={2} />
        <Field name="postal_code" label="Kod pocztowy" defaultValue={initial.postal_code ?? ""} />
        <Field name="city" label="Miasto" defaultValue={initial.city ?? ""} />
      </FieldGroup>

      {msg && (
        <div className={`text-[13px] ${msg.kind === "ok" ? "text-mint" : "text-coral"}`}>{msg.text}</div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button type="submit" disabled={pending} className="btn-primary h-10 px-6 text-[14px]">
          {pending ? "Zapisuję…" : "Zapisz zmiany"}
        </button>
      </div>
    </form>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-3">{title}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  name, label, defaultValue, colSpan = 1,
}: {
  name: string; label: string; defaultValue: string; colSpan?: 1 | 2;
}) {
  return (
    <div className={colSpan === 2 ? "md:col-span-2" : ""}>
      <label className="input-label">{label}</label>
      <input name={name} defaultValue={defaultValue} className="input" />
    </div>
  );
}
