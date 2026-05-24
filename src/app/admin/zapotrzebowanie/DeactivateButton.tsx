"use client";

import { useTransition } from "react";
import { deactivateDemandListing } from "./actions";

export function DeactivateButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(async () => { await deactivateDemandListing(id); })}
      disabled={pending}
      className="text-[11px] text-text-mute hover:text-coral transition-colors"
    >
      {pending ? "Wyłączam…" : "Wyłącz"}
    </button>
  );
}
