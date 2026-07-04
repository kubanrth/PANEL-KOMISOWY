import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { PanelSidebar } from "./PanelSidebar";
import { PanelMobileNav } from "./PanelMobileNav";
import { TopbarBreadcrumb } from "./TopbarBreadcrumb";
import { getTheme } from "@/lib/theme";
import { getSessionUser, getOwnProfile, getPanelChrome } from "@/lib/supabase/session";

/**
 * Chrome panelu klienta — renderowany przez app/panel/layout.tsx.
 *
 * Layout-mode: shell sam pobiera swoje dane (cache() deduplikuje je ze
 * stronami w tym samym requeście), a przy soft-nav Next NIE re-renderuje
 * layoutu — tylko segment strony. Children w Suspense: sidebar/topbar
 * malują się natychmiast, treść strony streamuje.
 */
export async function PanelShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [theme, profile, chrome] = await Promise.all([
    getTheme(),
    getOwnProfile(),
    getPanelChrome(),
  ]);

  const shellProfile = {
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    account_type: profile?.account_type ?? null,
  };

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile: top bar + bottom tabs + FAB + sheet „Więcej" (pod lg) */}
      <PanelMobileNav
        user={{ email: user.email! }}
        profile={shellProfile}
        walletBalance={chrome.walletBalance}
        walletAvailable={chrome.walletAvailable}
        theme={theme}
        badges={chrome.badges}
      />

      {/* Desktop sidebar (od lg) */}
      <PanelSidebar
        user={{ email: user.email! }}
        profile={shellProfile}
        walletBalance={chrome.walletBalance}
        walletAvailable={chrome.walletAvailable}
        theme={theme}
        badges={chrome.badges}
      />

      {/* MAIN */}
      <div className="flex-1 min-w-0">
        <header className="hidden lg:flex sticky top-0 z-20 backdrop-blur-md bg-bg/80 border-b border-border-soft">
          <div className="w-full px-6 lg:px-10 h-[60px] flex items-center justify-between gap-4">
            <TopbarBreadcrumb />
            <div className="flex items-center gap-3">
              <ButtonLink href="/start" size="md">
                Nowa Oferta
                <ArrowRight size={14} />
              </ButtonLink>
            </div>
          </div>
        </header>

        {/* pb-24 na mobile — miejsce na bottom tab bar (68px + safe area) */}
        <main className="px-4 py-5 pb-24 lg:px-10 lg:py-10 lg:pb-10">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

/** Skeleton segmentu strony — shell widoczny od razu, treść streamuje. */
function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Ładowanie">
      <div className="kb-skeleton h-3 w-40" />
      <div className="mt-4 kb-skeleton h-9 w-72" />
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kb-skeleton h-[120px] rounded-[20px]" />
        ))}
      </div>
      <div className="mt-8 kb-skeleton h-[320px] rounded-[20px]" />
    </div>
  );
}
