"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import {
  SquaresFour, Tray, Package, ArrowCounterClockwise, ChartLineDown, Wallet,
  Star, TrayArrowDown, ArrowSquareOut, Truck, Target, Sparkle, Percent,
  ChartLine, Bell, GearSix, EnvelopeSimple, ShieldCheck, Handshake, QrCode,
  Users, Kanban, Money, FileText, Scroll, ChartBar, CaretDown, List,
  type IconProps,
} from "@phosphor-icons/react";
import { isItemActive, type NavSection, type NavItem, type NavBadges, type DotColor } from "./nav-config";

/* Lookup nazw ikon z nav-config → komponenty Phosphor (Regular). */
const ICONS: Record<string, ComponentType<IconProps>> = {
  SquaresFour, Tray, Package, ArrowCounterClockwise, ChartLineDown, Wallet,
  Star, TrayArrowDown, ArrowSquareOut, Truck, Target, Sparkle, Percent,
  ChartLine, Bell, GearSix, EnvelopeSimple, ShieldCheck, Handshake, QrCode,
  Users, Kanban, Money, FileText, Scroll, ChartBar, List,
};

const DOT_CLS: Record<DotColor, string> = {
  lime: "bg-lime",
  mint: "bg-mint",
  blue: "bg-blue-soft",
  yellow: "bg-yellow",
  coral: "bg-coral",
  mute: "bg-text-mute",
};

/**
 * Nawigacja sidebara (klient + admin) wg zatwierdzonego designu:
 * sekcje uppercase → itemy 44px z ikoną + badge → expandable subitemy
 * z kropką. Stan zwijania w localStorage per storageKey.
 */
export function SidebarNav({
  sections,
  activeKey,
  badges = {},
  storageKey,
  onNavigate,
}: {
  sections: NavSection[];
  activeKey: string | undefined;
  badges?: NavBadges;
  /** np. "kb-nav-panel" / "kb-nav-admin" — pamięć zwijania. */
  storageKey: string;
  /** Mobile sheet zamyka się po kliknięciu w link. */
  onNavigate?: () => void;
}) {
  // null = jeszcze nie wczytane (SSR) — do tego czasu: rozwinięty tylko parent aktywnego.
  const [open, setOpen] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setOpen(raw ? JSON.parse(raw) : {});
    } catch {
      setOpen({});
    }
  }, [storageKey]);

  function toggle(key: string) {
    const next = { ...(open ?? {}), [key]: !isOpen(key) };
    setOpen(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* private mode — trzymamy stan tylko w pamięci */
    }
  }

  const itemByKey = new Map(sections.flatMap((s) => s.items).map((i) => [i.key, i]));

  function isOpen(key: string): boolean {
    const item = itemByKey.get(key);
    const activeInside = item ? isItemActive(item, activeKey) : false;
    if (open === null) return activeInside; // przed hydracją localStorage
    return open[key] ?? activeInside;
  }

  return (
    <nav aria-label="Nawigacja">
      {sections.map((section, si) => (
        <div key={section.label ?? `s${si}`} className={si > 0 ? "mt-6" : ""}>
          {section.label && (
            <div className="label px-3 mb-2">{section.label}</div>
          )}
          <ul className="space-y-1">
            {section.items.map((item) => (
              <NavRow
                key={item.key}
                item={item}
                activeKey={activeKey}
                badges={badges}
                expanded={isOpen(item.key)}
                onToggle={() => toggle(item.key)}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavRow({
  item,
  activeKey,
  badges,
  expanded,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  activeKey: string | undefined;
  badges: NavBadges;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const Icon = ICONS[item.icon] ?? SquaresFour;
  const parentActive = isItemActive(item, activeKey);
  const selfActive = item.key === activeKey;
  const hasSubs = (item.subs?.length ?? 0) > 0;

  const badge = item.badgeKey != null ? badges[item.badgeKey] : undefined;
  const dot = item.dotKey != null ? badges[item.dotKey] : undefined;

  const rowCls = parentActive
    ? "bg-surface-2 text-text"
    : "text-text-soft hover:text-text hover:bg-surface-2/60";

  return (
    <li className={hasSubs && expanded ? "bg-surface/60 rounded-[14px] p-1" : ""}>
      <div className={`relative flex items-center rounded-[12px] transition-colors ${rowCls}`}>
        {/* lime lewa krawędź aktywnego */}
        {selfActive && (
          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-lime" aria-hidden />
        )}
        {hasSubs && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Zwiń" : "Rozwiń"} ${item.label}`}
            className="ml-2 h-7 w-7 flex-shrink-0 rounded-[9px] bg-surface-2 border border-border-soft flex items-center justify-center text-text-mute hover:text-text transition-colors"
          >
            <CaretDown size={12} className={`transition-transform ${expanded ? "" : "-rotate-90"}`} />
          </button>
        )}
        <Link
          href={item.href}
          onClick={onNavigate}
          className={`flex flex-1 items-center gap-3 min-w-0 h-11 ${hasSubs ? "pl-2.5" : "pl-3.5"} pr-3`}
          aria-current={selfActive ? "page" : undefined}
        >
          <Icon size={19} weight="regular" className={selfActive ? "text-lime" : ""} />
          <span className={`truncate text-[13.5px] ${selfActive ? "font-medium text-lime" : ""}`}>
            {item.label}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {typeof badge === "number" && badge > 0 && (
              <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-surface-2 border border-border-soft text-[11px] num text-text-mute flex items-center justify-center">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
            {dot === true && <span className="h-2 w-2 rounded-full bg-yellow" aria-hidden />}
          </span>
        </Link>
      </div>

      {hasSubs && expanded && (
        <ul className="mt-1 pb-1 space-y-0.5">
          {item.subs!.map((sub) => {
            const subActive = sub.key === activeKey;
            return (
              <li key={`${sub.key}-${sub.label}`}>
                <Link
                  href={sub.href}
                  onClick={onNavigate}
                  aria-current={subActive ? "page" : undefined}
                  className={`flex items-center gap-2.5 h-9 pl-11 pr-3 rounded-[10px] text-[13px] transition-colors ${
                    subActive
                      ? "text-text font-medium bg-surface-2/70"
                      : "text-text-soft hover:text-text hover:bg-surface-2/40"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${DOT_CLS[sub.dot]} ${subActive ? "" : "opacity-60"}`}
                    aria-hidden
                  />
                  <span className="truncate">{sub.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
