/**
 * Single source of truth for the client panel left rail.
 *
 * Adding a new panel route = add an entry here AND create the route file
 * under `app/panel/<key>/page.tsx`. The PanelSidebar reads this config and
 * renders the 4 grouped sections. Active state is matched by `key` against
 * the `active` prop on PanelShell.
 *
 * `stub: true` marks routes that currently render a "Wkrótce" placeholder.
 * As deep implementations land in later phases, flip `stub` to false.
 */

export type NavBadgeResolver = (ctx: NavBadgeContext) => string | number | undefined;

export type NavBadgeContext = {
  klientId: string;
  // Resolver receives a Supabase-typed lightweight client in future phases;
  // for now most resolvers are static, so the signature is intentionally
  // narrow. Phase 2 will widen it to accept query helpers.
};

export type NavItem = {
  key: string;
  label: string;
  href: string;
  stub?: boolean;
  /** Optional accent on the badge (mint/blue/amber); resolved at render. */
  badgeAccent?: "mint" | "blue" | "amber";
  /** Optional dynamic badge resolver (count, currency, etc.). */
  badge?: NavBadgeResolver | string | number;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/**
 * Routes keyed by stable string identifiers. The values match folder names
 * under `app/panel/` so we can derive route paths mechanically.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Sprzedaż",
    items: [
      { key: "analityka",       label: "Analityka i rekomendacje", href: "/panel/analityka",       stub: true },
      { key: "magazyn",         label: "Magazyn",                  href: "/panel/magazyn",         stub: true },
      { key: "przyjecia",       label: "Przyjęcia magazynowe",     href: "/panel/przyjecia",       stub: true },
      { key: "wydania",         label: "Wydania magazynowe",       href: "/panel/wydania",         stub: true },
      { key: "sprzedaze",       label: "Sprzedaże",                href: "/panel/sprzedaze",       stub: true },
      { key: "zapotrzebowanie", label: "Zapotrzebowanie",          href: "/panel/zapotrzebowanie", stub: true },
      { key: "promocje",        label: "Twoje promocje",           href: "/panel/promocje",        stub: true },
      { key: "zmiany-ceny",     label: "Zmiany ceny",              href: "/panel/zmiany-ceny",     stub: true },
    ],
  },
  {
    label: "Finanse",
    items: [
      { key: "faktury",   label: "Faktury i rozliczenia", href: "/panel/faktury",   stub: true },
      { key: "wallet",    label: "Wallet",                href: "/panel/wallet",    badgeAccent: "mint" },
      { key: "wyplaty",   label: "Nadchodzące wypłaty",   href: "/panel/wyplaty",   stub: true },
      { key: "zwroty",    label: "Zwroty",                href: "/panel/zwroty",    stub: true },
    ],
  },
  {
    label: "Dokumenty",
    items: [
      { key: "dane",              label: "Dane rozliczeniowe",  href: "/panel/dane",              stub: true },
      { key: "warunki",           label: "Warunki komisowe",    href: "/panel/warunki",           stub: true },
      { key: "umowa",             label: "Umowa komisowa",      href: "/panel/umowa" },
      { key: "uks",               label: "UKS",                 href: "/panel/uks",               stub: true },
      { key: "komis-wyciagniety", label: "Komis wyciągnięty",   href: "/panel/komis-wyciagniety", stub: true },
      { key: "fulfillment",       label: "Fulfillment",         href: "/panel/fulfillment",       stub: true },
    ],
  },
  {
    label: "Konto",
    items: [
      { key: "notifications", label: "Powiadomienia", href: "/panel/notifications" },
      { key: "ustawienia",    label: "Ustawienia",    href: "/panel/ustawienia", stub: true },
      { key: "plany",         label: "Plany sprzedaży", href: "/panel/plany",    stub: true },
    ],
  },
];

/** Flat list of all nav items — used for runtime active-key validation. */
export const ALL_NAV_KEYS: string[] = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.key));

/** Legacy keys (Phase 1 doesn't rename, but PanelShell callers may still
 * pass these). We map them onto the new key space here so existing pages
 * don't all need touching at once. */
export const LEGACY_ACTIVE_ALIASES: Record<string, string> = {
  dashboard: "panel",
  submissions: "oferty",
  "my-sales": "sprzedaze",
  inventory: "magazyn",
  stats: "analityka",
  settings: "ustawienia",
};

/** Normalize the `active` prop coming from a page into a nav key we render. */
export function normalizeActive(active: string | undefined): string | undefined {
  if (!active) return undefined;
  return LEGACY_ACTIVE_ALIASES[active] ?? active;
}
