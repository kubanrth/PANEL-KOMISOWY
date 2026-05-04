"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { markRead } from "./actions";
import type { AppNotification, NotificationType } from "@/lib/types";

const TYPE_BADGE: Record<NotificationType, { label: string; cls: string; dot: string }> = {
  submission_signed:        { label: "Podpisana",     cls: "pill-blue",  dot: "bg-blue-soft" },
  submission_received:      { label: "Dostawa",       cls: "pill-mute",  dot: "bg-text-mute" },
  aqc_started:              { label: "A&QC",          cls: "pill-mute",  dot: "bg-text-mute" },
  aqc_complete:             { label: "A&QC PASS",     cls: "pill-mint",  dot: "bg-mint" },
  valuation_ready:          { label: "Wycena",        cls: "pill-blue",  dot: "bg-blue-soft" },
  price_reduction_suggestion:{label: "Sugestia",      cls: "pill-amber", dot: "bg-amber" },
  offer_received:           { label: "Oferta",        cls: "pill-amber", dot: "bg-amber" },
  offer_accepted:           { label: "Oferta accept.",cls: "pill-mint",  dot: "bg-mint" },
  offer_rejected:           { label: "Oferta odrzuc.",cls: "pill-mute",  dot: "bg-text-mute" },
  sale:                     { label: "Sprzedaż",      cls: "pill-mint",  dot: "bg-mint" },
  sale_unlocked:            { label: "Funds odblok.", cls: "pill-mint",  dot: "bg-mint" },
  payout_pending:           { label: "Wypłata",       cls: "pill-blue",  dot: "bg-blue-soft" },
  payout_done:              { label: "Wypłata ✓",     cls: "pill-mint",  dot: "bg-mint" },
  payout_failed:            { label: "Wypłata FAIL",  cls: "pill-pink",  dot: "bg-pink" },
  return_decision:          { label: "Zwrot",         cls: "pill-pink",  dot: "bg-pink" },
  document_required:        { label: "Dokument",      cls: "pill-amber", dot: "bg-amber" },
};

export function NotificationItem({ notification }: { notification: AppNotification }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const badge = TYPE_BADGE[notification.type];
  const unread = !notification.read_at;
  const refLink = inferLink(notification.ref_id);

  function handleMarkRead() {
    if (!unread) return;
    startTransition(async () => {
      await markRead(notification.id);
      router.refresh();
    });
  }

  return (
    <article
      className={`card p-5 lg:p-6 ${unread ? "border-blue/40 bg-blue/5" : ""}`}
      onMouseEnter={handleMarkRead}
    >
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center pt-1">
          <span className={`h-2 w-2 rounded-full ${unread ? "bg-blue" : "bg-text-faint"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className={`pill ${badge.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>
            {notification.ref_id && (
              <span className="text-[12px] text-text-mute font-mono">{notification.ref_id}</span>
            )}
            <span className="text-[12px] text-text-mute ml-auto num">{formatDateTime(notification.created_at)}</span>
          </div>
          <h3 className={`text-[15px] ${unread ? "font-semibold" : "font-medium"} tracking-[-0.015em]`}>
            {notification.title}
          </h3>
          {notification.body && (
            <p className="mt-1.5 text-[13px] text-text-soft leading-[1.55]">{notification.body}</p>
          )}
          {refLink && (
            <Link
              href={refLink}
              className="mt-3 inline-flex items-center gap-2 text-[12px] text-blue hover:text-blue-soft"
            >
              Otwórz {notification.ref_id} →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function inferLink(refId: string | null): string | null {
  if (!refId) return null;
  if (refId.startsWith("SUB-")) return `/panel/submissions/${refId}`;
  if (refId.startsWith("PROD-")) return `/panel/products/${refId.replace("PROD-", "")}`;
  if (refId.startsWith("PAY-")) return `/panel/wallet`;
  return null;
}
