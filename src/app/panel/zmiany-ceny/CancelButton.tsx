"use client";

import { useTransition } from "react";
import { decideOnPriceChange } from "./actions";

export function CancelButton({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(async () => { await decideOnPriceChange(requestId, "cancelled"); })}
      disabled={pending}
      className="text-[11px] text-text-mute hover:text-coral transition-colors"
    >
      {pending ? "Anuluję…" : "Anuluj sugestię"}
    </button>
  );
}
