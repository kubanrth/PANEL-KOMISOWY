"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body via React portal.
 *
 * Used for overlays (drawers, modals) that must escape positioning context
 * — particularly inside elements with `backdrop-filter` or `transform`,
 * which create containing blocks for `position: fixed` and would clip our
 * full-viewport drawers to the header height (56px).
 *
 * Returns null on first server render to avoid hydration mismatch.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
