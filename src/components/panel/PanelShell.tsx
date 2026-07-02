import Link from "next/link";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { PanelSidebar } from "./PanelSidebar";
import { PanelMobileNav } from "./PanelMobileNav";
import { getTheme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import type { NavBadges } from "./nav-config";

export type PanelShellProps = {
  user: { email: string };
  profile: {
    first_name: string | null;
    last_name: string | null;
    account_type: "individual" | "business" | null;
  };
  walletBalance?: number;
  walletAvailable?: number;
  /** Stable nav-config key. Legacy values (dashboard/submissions/my-sales/inventory/stats/settings) auto-mapped. */
  active?: string;
  pageTitle?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  children: React.ReactNode;
  cta?: React.ReactNode;
  /** Liczby/kropki do badge'ów sidebara (klucze = badgeKey/dotKey z nav-config). */
  badges?: NavBadges;
};

export async function PanelShell({
  user, profile,
  walletBalance = 0,
  walletAvailable = 0,
  active, pageTitle, breadcrumb,
  children, cta, badges,
}: PanelShellProps) {
  const theme = await getTheme();
  const resolvedBadges = { ...(await fetchPanelBadges()), ...badges };

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile: top bar + bottom tabs + FAB + sheet „Więcej" (pod lg) */}
      <PanelMobileNav
        user={user}
        profile={profile}
        walletBalance={walletBalance}
        walletAvailable={walletAvailable}
        active={active}
        theme={theme}
        badges={resolvedBadges}
      />

      {/* Desktop sidebar (od lg) */}
      <PanelSidebar
        user={user}
        profile={profile}
        walletBalance={walletBalance}
        walletAvailable={walletAvailable}
        active={active}
        theme={theme}
        badges={resolvedBadges}
      />

      {/* MAIN */}
      <div className="flex-1 min-w-0">
        {/* Desktop-only secondary header (mobile gets its own bar from PanelMobileNav) */}
        <header className="hidden lg:flex sticky top-0 z-20 backdrop-blur-md bg-bg/80 border-b border-border-soft">
          <div className="w-full px-6 lg:px-10 h-[60px] flex items-center justify-between gap-4">
            <Breadcrumb breadcrumb={breadcrumb} pageTitle={pageTitle} />
            <div className="flex items-center gap-3">
              {cta ?? (
                <ButtonLink href="/start" size="md">
                  Nowa Oferta
                  <ArrowRight size={14} />
                </ButtonLink>
              )}
            </div>
          </div>
        </header>

        {/* Mobile-only breadcrumb under the top bar (compact) */}
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="lg:hidden px-4 py-3 border-b border-border-soft">
            <Breadcrumb breadcrumb={breadcrumb} pageTitle={pageTitle} />
          </div>
        )}

        {/* pb-24 na mobile — miejsce na bottom tab bar (68px + safe area) */}
        <main className="px-4 py-5 pb-24 lg:px-10 lg:py-10 lg:pb-10">{children}</main>
      </div>
    </div>
  );
}

function Breadcrumb({
  breadcrumb, pageTitle,
}: {
  breadcrumb?: Array<{ label: string; href?: string }>;
  pageTitle?: string;
}) {
  if (!breadcrumb && !pageTitle) return null;
  return (
    <div className="flex items-center gap-2 text-[12px] lg:text-[13px] text-text-soft overflow-x-auto no-scrollbar">
      <Link href="/panel" className="hover:text-text whitespace-nowrap">
        Panel
      </Link>
      {breadcrumb?.map((b, i) => (
        <span key={i} className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-text-faint">/</span>
          {b.href ? (
            <Link href={b.href} className="hover:text-text">
              {b.label}
            </Link>
          ) : (
            <span className="text-text">{b.label}</span>
          )}
        </span>
      ))}
      {pageTitle && breadcrumb === undefined && (
        <>
          <span className="text-text-faint">/</span>
          <span className="text-text whitespace-nowrap">{pageTitle}</span>
        </>
      )}
    </div>
  );
}

/** Liczniki sidebara — 3 równoległe head-county (RLS zawęża do własnych danych).
 *  Defensywnie: każdy błąd → brak badge, nigdy 500. Strona może nadpisać przez props. */
async function fetchPanelBadges(): Promise<Record<string, number | boolean | undefined>> {
  try {
    const supabase = await createClient();
    const [subs, listed, demands] = await Promise.all([
      supabase.from("submissions").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }).in("status", ["draft", "aqc", "listed", "offer"]),
      supabase.from("demand_listings").select("*", { count: "exact", head: true }).eq("active", true),
    ]);
    return {
      submissions: subs.count ?? undefined,
      magazyn: listed.count ?? undefined,
      zapotrzebowanie: demands.count ?? undefined,
    };
  } catch {
    return {};
  }
}
