"use client";

import { useEffect } from "react";
import { Portal } from "./Portal";

/** Modal centered max-w 560px (Design System, kb-modal). Na mobile sheet od dołu. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
        <button
          type="button"
          aria-label="Zamknij"
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm kb-fade cursor-default"
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full lg:max-w-[560px] bg-surface-3 border border-border rounded-t-[24px] lg:rounded-[24px] shadow-elev kb-modal max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-border-soft flex-shrink-0">
            <div className="font-medium text-[17px] tracking-[-0.015em]">{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij okno"
              className="h-9 w-9 rounded-[10px] bg-surface-2 border border-border-soft flex items-center justify-center text-text-mute hover:text-text transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="px-6 py-4 border-t border-border-soft flex items-center justify-end gap-3 flex-shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
