"use client";

import { useState, useTransition } from "react";
import {
  addWarehouseMapping,
  removeWarehouseMapping,
  replayPushQueueItem,
  replayWebhookEvent,
} from "./actions";

/* ====================================================== */
/* Warehouse mapping form                                  */
/* ====================================================== */

type Klient = { id: string; first_name: string | null; last_name: string | null; company_name: string | null };

export function AddMappingForm({ klienci }: { klienci: Klient[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  return (
    <form
      action={(fd) =>
        start(async () => {
          setMsg(null);
          const r = await addWarehouseMapping(fd);
          setMsg(r.ok ? { kind: "ok", text: r.message ?? "OK" } : { kind: "err", text: r.error });
        })
      }
      className="card p-5 space-y-4"
    >
      <div className="label">Dodaj mapowanie</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="input-label">Klient</label>
          <select name="klient_id" className="input" required>
            <option value="">— wybierz —</option>
            {klienci.map((k) => {
              const name =
                [k.first_name, k.last_name].filter(Boolean).join(" ") || k.company_name || k.id;
              return (
                <option key={k.id} value={k.id}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="input-label">Fakturownia warehouse_id</label>
          <input name="warehouse_id" type="number" min={1} required className="input" placeholder="123" />
        </div>
        <div>
          <label className="input-label">Nazwa magazynu (opcjonalne)</label>
          <input name="warehouse_name" className="input" placeholder="MAG-KOMISANT-..." />
        </div>
      </div>
      {msg && (
        <div className={`text-[13px] ${msg.kind === "ok" ? "text-mint" : "text-coral"}`}>{msg.text}</div>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary h-10 px-5 text-[14px]">
          {pending ? "Zapisuję…" : "Zapisz mapowanie"}
        </button>
      </div>
    </form>
  );
}

export function RemoveMappingButton({ klientId }: { klientId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(async () => { await removeWarehouseMapping(klientId); })}
      disabled={pending}
      className="text-[11px] text-coral hover:underline"
    >
      {pending ? "…" : "Usuń"}
    </button>
  );
}

/* ====================================================== */
/* Replay buttons                                          */
/* ====================================================== */

export function ReplayQueueButton({ itemId }: { itemId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2 justify-end">
      {msg && <span className="text-[10px] text-text-mute">{msg}</span>}
      <button
        type="button"
        onClick={() =>
          start(async () => {
            const r = await replayPushQueueItem(itemId);
            setMsg(r.ok ? "OK" : r.error.slice(0, 40));
          })
        }
        disabled={pending}
        className="text-[11px] text-blue hover:underline"
      >
        {pending ? "…" : "Replay"}
      </button>
    </div>
  );
}

export function ReplayEventButton({ eventId }: { eventId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2 justify-end">
      {msg && <span className="text-[10px] text-text-mute">{msg}</span>}
      <button
        type="button"
        onClick={() =>
          start(async () => {
            const r = await replayWebhookEvent(eventId);
            setMsg(r.ok ? "OK" : r.error.slice(0, 40));
          })
        }
        disabled={pending}
        className="text-[11px] text-blue hover:underline"
      >
        {pending ? "…" : "Replay"}
      </button>
    </div>
  );
}
