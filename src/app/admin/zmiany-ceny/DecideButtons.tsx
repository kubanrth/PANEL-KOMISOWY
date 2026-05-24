"use client";

import { useTransition } from "react";
import { decideAdminPriceChange } from "./actions";

export function DecideButtons({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2 justify-end">
      <button
        type="button"
        onClick={() => start(async () => { await decideAdminPriceChange(requestId, "accepted"); })}
        disabled={pending}
        className="text-[11px] text-mint hover:underline"
      >
        Akceptuj
      </button>
      <span className="text-text-faint text-[10px]">·</span>
      <button
        type="button"
        onClick={() => start(async () => { await decideAdminPriceChange(requestId, "rejected"); })}
        disabled={pending}
        className="text-[11px] text-coral hover:underline"
      >
        Odrzuć
      </button>
    </div>
  );
}
