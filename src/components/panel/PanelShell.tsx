import Link from "next/link";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PanelSidebar } from "./PanelSidebar";
import { getTheme } from "@/lib/theme";

export type PanelShellProps = {
  user: { email: string };
  profile: {
    first_name: string | null;
    last_name: string | null;
    account_type: "individual" | "business" | null;
  };
  walletBalance?: number; // in cents
  walletAvailable?: number; // unlocked amount in cents
  /** Stable key from nav-config (e.g. "magazyn", "wallet"). Legacy values
   * like "dashboard"/"submissions"/"my-sales"/"inventory"/"stats"/"settings"
   * are auto-mapped via LEGACY_ACTIVE_ALIASES so existing pages keep working. */
  active?: string;
  pageTitle?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  children: React.ReactNode;
  cta?: React.ReactNode;
};

export async function PanelShell({
  user,
  profile,
  walletBalance = 0,
  walletAvailable = 0,
  active,
  pageTitle,
  breadcrumb,
  children,
  cta,
}: PanelShellProps) {
  const theme = await getTheme();

  return (
    <div className="min-h-screen flex">
      <PanelSidebar
        user={user}
        profile={profile}
        walletBalance={walletBalance}
        walletAvailable={walletAvailable}
        active={active}
        theme={theme}
      />

      {/* MAIN */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 backdrop-blur-md bg-bg/80 border-b border-border-soft">
          <div className="px-6 lg:px-10 h-[60px] flex items-center justify-between gap-4">
            <Breadcrumb breadcrumb={breadcrumb} pageTitle={pageTitle} />
            <div className="flex items-center gap-3">
              {/* Mobile-visible theme toggle (sidebar hidden under lg) */}
              <div className="lg:hidden">
                <ThemeToggle current={theme} />
              </div>
              {cta ?? (
                <ButtonLink href="/start" size="md">
                  Nowa Oferta
                  <ArrowRight size={14} />
                </ButtonLink>
              )}
            </div>
          </div>
        </header>

        <main className="px-6 lg:px-10 py-7 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function Breadcrumb({
  breadcrumb,
  pageTitle,
}: {
  breadcrumb?: Array<{ label: string; href?: string }>;
  pageTitle?: string;
}) {
  if (!breadcrumb && !pageTitle) return null;
  return (
    <div className="flex items-center gap-2 text-[13px] text-text-soft">
      <Link href="/panel" className="hover:text-text">
        Panel
      </Link>
      {breadcrumb?.map((b, i) => (
        <span key={i} className="flex items-center gap-2">
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
          <span className="text-text">{pageTitle}</span>
        </>
      )}
    </div>
  );
}
