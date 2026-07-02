"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { markRead } from "./actions";
import type { AppNotification, NotificationType } from "@/lib/types";

/* Wiersz powiadomienia — redesign: ikona-litera w ramce 40px (bg-surface-2),
   treść, timestamp num; nieprzeczytane = lime dot + delikatnie jaśniejsze tło.
   Logika markRead (hover → server action) bez zmian. */

const TYPE_BADGE: Record<NotificationType, { label: string; cls: string; dot: string }> = {
  submission_signed:        { label: "Podpisana",     cls: "pill-blue",  dot: "bg-blue-soft" },
  submission_received:      { label: "Dostawa",       cls: "pill-mute",  dot: "bg-text-mute" },
  aqc_started:              { label: "A&QC",          cls: "pill-mute",  dot: "bg-text-mute" },
  aqc_complete:             { label: "A&QC PASS",     cls: "pill-mint",  dot: "bg-mint" },
  valuation_ready:          { label: "Wycena",        cls: "pill-blue",  dot: "bg-blue-soft" },
  price_reduction_suggestion:{label: "Sugestia",      cls: "pill-amber", dot: "bg-amber" },
  offer_received:           { label: "Oferta",        cls: "pill-yellow",dot: "bg-yellow" },
  offer_accepted:           { label: "Oferta accept.",cls: "pill-mint",  dot: "bg-mint" },
  offer_rejected:           { label: "Oferta odrzuc.",cls: "pill-mute",  dot: "bg-text-mute" },
  sale:                     { label: "Sprzedaż",      cls: "pill-mint",  dot: "bg-mint" },
  sale_unlocked:            { label: "Środki odblok.",cls: "pill-mint",  dot: "bg-mint" },
  payout_pending:           { label: "Wypłata",       cls: "pill-blue",  dot: "bg-blue-soft" },
  payout_done:              { label: "Wypłata ✓",     cls: "pill-mint",  dot: "bg-mint" },
  payout_failed:            { label: "Wypłata FAIL",  cls: "pill-coral", dot: "bg-coral" },
  return_decision:          { label: "Zwrot",         cls: "pill-coral", dot: "bg-coral" },
  document_required:        { label: "Dokument",      cls: "pill-yellow",dot: "bg-yellow" },
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
      className={`card p-4 flex items-start gap-3 ${unread ? "!bg-surface-2/60" : ""}`}
      onMouseEnter={handleMarkRead}
    >
      <div className="h-10 w-10 rounded-[10px] bg-surface-2 border border-border-soft flex items-center justify-center text-[15px] font-medium text-text-soft flex-shrink-0">
        {notification.title[0]?.toUpperCase() ?? "•"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`pill ${badge.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
          {notification.ref_id && (
            <span className="text-[11px] num text-text-mute">{notification.ref_id}</span>
          )}
          <span className="text-[11px] num text-text-mute ml-auto">
            {formatDateTime(notification.created_at)}
          </span>
          {unread && <span className="h-1.5 w-1.5 rounded-full bg-lime flex-shrink-0" aria-label="Nieprzeczytane" />}
        </div>
        <h3 className={`mt-1.5 text-[14px] tracking-[-0.01em] ${unread ? "font-semibold" : "font-medium"}`}>
          {notification.title}
        </h3>
        {notification.body && (
          <p className="mt-1 text-[12.5px] text-text-soft leading-[1.55]">{notification.body}</p>
        )}
        {refLink && (
          <Link
            href={refLink}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] text-text-soft hover:text-lime transition-colors"
          >
            Otwórz {notification.ref_id} →
          </Link>
        )}
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
