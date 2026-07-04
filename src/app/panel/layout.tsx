import { PanelShell } from "@/components/panel/PanelShell";

/**
 * Layout panelu klienta: chrome (sidebar/topbar/mobile-nav) renderuje się
 * RAZ i nie jest re-renderowany przy soft-nav — nawigacja pobiera tylko
 * segment strony. Dane chrome'u deduplikowane ze stronami przez cache().
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
