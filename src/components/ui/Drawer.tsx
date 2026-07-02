"use client";

import { useEffect } from "react";
import { Portal } from "./Portal";

/**
 * Drawer prawy 480px (Design System, kb-drawer) na mobile full-width sheet.
 * Portal do body — omija containing blocks z backdrop-filter/transform.
 * Escape + klik w backdrop zamykają. Header i footer sticky, body scrolluje.
 */
export function Drawer({
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
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          aria-label="Zamknij"
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm kb-fade cursor-default"
        />
        <div
          role="dialog"
          aria-modal="true"
          className="absolute right-0 top-0 h-full w-full lg:w-[480px] bg-surface-3 border-l border-border shadow-elev kb-drawer flex flex-col"
        >
          <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-border-soft flex-shrink-0">
            <div className="font-medium text-[17px] tracking-[-0.015em] min-w-0 truncate">{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij panel"
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
