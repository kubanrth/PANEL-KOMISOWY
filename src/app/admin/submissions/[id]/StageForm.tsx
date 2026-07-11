"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { PRODUCT_STAGES, type ProductStage } from "@/lib/types";
import { updateProductStage } from "./actions";

/** Formularz etapu pipeline'u dla jednej pozycji (weryfikacja z formularzem). */
export function StageForm({ productId, stage }: { productId: string; stage: ProductStage }) {
  const [value, setValue] = useState<ProductStage>(stage);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = value !== stage;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value}
        onChange={(e) => { setValue(e.target.value as ProductStage); setMsg(null); }}
        className="h-10 !py-0 text-[13px] min-w-[190px]"
        aria-label="Etap produktu"
      >
        {PRODUCT_STAGES.map((s, i) => (
          <option key={s.key} value={s.key}>{i + 1}. {s.label}</option>
        ))}
      </Select>
      <button
        type="button"
        disabled={!dirty || pending}
        onClick={() =>
          startTransition(async () => {
            const fd = new FormData();
            fd.set("product_id", productId);
            fd.set("stage", value);
            const res = await updateProductStage(fd);
            setMsg(res.ok
              ? { ok: true, text: res.note ?? "Zapisano." }
              : { ok: false, text: res.error });
          })
        }
        className="btn-primary h-10 px-4 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? "Zapisuję…" : "Zapisz"}
      </button>
      {msg && (
        <span className={`text-[12px] ${msg.ok ? "text-mint" : "text-coral"}`}>{msg.text}</span>
      )}
    </div>
  );
}
