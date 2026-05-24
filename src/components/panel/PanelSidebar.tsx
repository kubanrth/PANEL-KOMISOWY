import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { signOut } from "@/app/panel/actions";
import { formatPLN } from "@/lib/format";
import { NAV_GROUPS, normalizeActive, type NavItem } from "./nav-config";
import type { Theme } from "@/lib/theme";

export type PanelSidebarProps = {
  user: { email: string };
  profile: {
    first_name: string | null;
    last_name: string | null;
    account_type: "individual" | "business" | null;
  };
  walletBalance: number;
  walletAvailable: number;
  active: string | undefined;
  theme: Theme;
};

export function PanelSidebar({
  user,
  profile,
  walletBalance,
  walletAvailable,
  active,
  theme,
}: PanelSidebarProps) {
  const activeKey = normalizeActive(active);
  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email;
  const initials =
    (profile.first_name?.[0] ?? "") +
    (profile.last_name?.[0] ?? user.email[0]?.toUpperCase() ?? "");

  return (
    <aside className="hidden lg:flex flex-col w-[260px] xl:w-[280px] border-r border-border-soft bg-bg-soft/40 sticky top-0 h-screen">
      <div className="px-6 pt-6 pb-5 border-b border-border-soft flex items-center justify-between">
        <Logo />
        <ThemeToggle current={theme} />
      </div>

      <nav className="px-6 py-6 flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? "mt-7" : ""}>
            <div className="label">{group.label}</div>
            <ul className="mt-3 space-y-1.5 text-[13px]">
              {group.items.map((item) => (
                <NavLink
                  key={item.key}
                  item={item}
                  active={activeKey === item.key}
                  walletBalance={walletBalance}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Wallet quick widget */}
      {walletBalance > 0 && (
        <div className="px-6 py-5 border-t border-border-soft">
          <div className="card-gradient-blue p-5 rounded-[16px]">
            <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">
              Wallet
            </div>
            <div className="mt-1 font-bold text-xl tracking-[-0.025em] text-white num">
              {formatPLN(walletBalance, { decimals: false })}
            </div>
            <div className="mt-1 text-white/70 text-[11px] num">
              Dostępne: {formatPLN(walletAvailable, { decimals: false })}
            </div>
          </div>
        </div>
      )}

      {/* User pill */}
      <div className="px-6 py-5 border-t border-border-soft">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-blue/15 border border-blue/30 flex items-center justify-center font-semibold text-blue text-[12px]">
            {initials.toUpperCase().slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] truncate">{fullName}</div>
            <div className="text-[11px] text-text-mute">
              {profile.account_type === "individual"
                ? "Indywidualne"
                : profile.account_type === "business"
                  ? "Biznesowe"
                  : ""}
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-text-mute hover:text-text transition-colors p-1"
              title="Wyloguj"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  walletBalance,
}: {
  item: NavItem;
  active: boolean;
  walletBalance: number;
}) {
  const baseCls = active
    ? "bg-blue/10 text-blue font-semibold"
    : "text-text-soft hover:text-text hover:bg-surface";

  // Resolve dynamic-ish badge values that are easy to derive without a query.
  // Static badge values (numbers/strings) are passed through; the wallet item
  // uses the parent-passed `walletBalance` directly.
  let badgeValue: string | number | undefined;
  if (typeof item.badge === "string" || typeof item.badge === "number") {
    badgeValue = item.badge;
  } else if (item.key === "wallet" && walletBalance > 0) {
    badgeValue = formatPLN(walletBalance, { decimals: false });
  }

  const badgeColor = item.badgeAccent === "mint"
    ? "text-mint"
    : item.badgeAccent === "amber"
      ? "text-amber"
      : item.badgeAccent === "blue"
        ? "text-blue"
        : "text-text-mute";

  return (
    <li>
      <Link
        href={item.href}
        className={`flex items-center justify-between py-2 px-3 -mx-3 rounded-[10px] transition-colors ${baseCls}`}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="truncate">{item.label}</span>
          {item.stub && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-text-faint border border-border rounded-full px-1.5 py-px">
              wkrótce
            </span>
          )}
        </span>
        {badgeValue != null && (
          <span className={`text-[11px] num ${active ? "text-blue" : badgeColor}`}>
            {badgeValue}
          </span>
        )}
      </Link>
    </li>
  );
}
