/**
 * Single source of truth dla nawigacji obu paneli (klient + admin).
 *
 * Struktura wg zatwierdzonego designu „Sidebary klient + admin":
 * sekcje z uppercase labelami → itemy z ikoną Phosphor (nazwa stringiem,
 * mapowana na komponent w SidebarNav — config zostaje serializowalny
 * server→client) → opcjonalne subitemy z kolorową kropką statusu.
 *
 * Vocab kropek = vocab pigułek: lime=aktywne · mint=sprzedane/OK ·
 * blue=w toku · yellow=uwaga · coral=problem · mute=archiwum.
 *
 * Klucz `key` itemu/subitemu odpowiada wartości `active` przekazywanej
 * przez strony. Parent podświetla się też gdy aktywny jest jego subitem.
 * Subitemy linkują TYLKO do realnych stron (filtry query dojdą w batchach
 * migracji, gdy strony będą je czytać).
 */

export type DotColor = "lime" | "mint" | "blue" | "yellow" | "coral" | "mute";

export type NavSubItem = {
  key: string;
  label: string;
  href: string;
  dot: DotColor;
};

export type NavItem = {
  key: string;
  label: string;
  href: string;
  /** Nazwa ikony Phosphor — lookup w SidebarNav.ICONS. */
  icon: string;
  subs?: NavSubItem[];
  /** Slot na badge liczbowy — wartość wstrzykiwana przez shell (counts). */
  badgeKey?: string;
  /** Kropka sygnałowa zamiast liczby (np. środki w portfelu). */
  dotKey?: string;
};

export type NavSection = {
  /** Uppercase label sekcji; null = itemy bez nagłówka (top standalone). */
  label: string | null;
  items: NavItem[];
};

/* ================= PANEL KLIENTA ================= */

export const PANEL_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [{ key: "dashboard", label: "Przegląd", href: "/panel", icon: "SquaresFour" }],
  },
  {
    label: "Sprzedaż",
    items: [
      { key: "sprzedaze", label: "Sprzedaże", href: "/panel/sprzedaze", icon: "Receipt" },
      {
        key: "magazyn",
        label: "Magazyn",
        href: "/panel/magazyn",
        icon: "Package",
        badgeKey: "magazyn",
        subs: [
          { key: "magazyn", label: "W sprzedaży", href: "/panel/magazyn", dot: "lime" },
          { key: "komis-wyciagniety", label: "Wycofane z komisu", href: "/panel/komis-wyciagniety", dot: "mute" },
        ],
      },
      { key: "zwroty", label: "Zwroty", href: "/panel/zwroty", icon: "ArrowCounterClockwise" },
      { key: "zmiany-ceny", label: "Zmiany cen", href: "/panel/zmiany-ceny", icon: "ChartLineDown" },
    ],
  },
  {
    label: "Finanse",
    items: [
      {
        key: "wallet",
        label: "Portfel",
        href: "/panel/wallet",
        icon: "Wallet",
        dotKey: "wallet",
        subs: [
          { key: "wyplaty", label: "Historia wypłat", href: "/panel/wyplaty", dot: "mint" },
          { key: "faktury", label: "Faktury", href: "/panel/faktury", dot: "mute" },
        ],
      },
      { key: "uks", label: "UKS", href: "/panel/uks", icon: "FileText" },
    ],
  },
  {
    label: "Operacje",
    items: [
      { key: "przyjecia", label: "Przyjęcia", href: "/panel/przyjecia", icon: "TrayArrowDown" },
      { key: "wydania", label: "Wydania", href: "/panel/wydania", icon: "ArrowSquareOut" },
      { key: "fulfillment", label: "Fulfillment", href: "/panel/fulfillment", icon: "Truck" },
    ],
  },
  {
    label: "Insights",
    items: [
      { key: "zapotrzebowanie", label: "Zapotrzebowanie", href: "/panel/zapotrzebowanie", icon: "Target", badgeKey: "zapotrzebowanie" },
      { key: "plany", label: "Co warto dodać", href: "/panel/plany", icon: "Sparkle", dotKey: "plany" },
      { key: "promocje", label: "Promocje", href: "/panel/promocje", icon: "Percent" },
      { key: "analityka", label: "Analityka", href: "/panel/analityka", icon: "ChartLine" },
    ],
  },
];

/** Bottom sticky group klienta (nad avatarem). */
export const PANEL_BOTTOM: NavSection[] = [
  {
    label: null,
    items: [
      { key: "notifications", label: "Powiadomienia", href: "/panel/notifications", icon: "Bell", dotKey: "notifications" },
      {
        key: "ustawienia",
        label: "Ustawienia",
        href: "/panel/ustawienia",
        icon: "GearSix",
        subs: [
          { key: "dane", label: "Dane", href: "/panel/dane", dot: "mute" },
          { key: "umowa", label: "Umowa", href: "/panel/umowa", dot: "mute" },
          { key: "warunki", label: "Warunki", href: "/panel/warunki", dot: "mute" },
        ],
      },
    ],
  },
];

/* ================= PANEL ADMINA ================= */

export const ADMIN_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { key: "queue", label: "Dashboard", href: "/admin", icon: "SquaresFour" },
      { key: "stats", label: "Statystyki", href: "/admin/stats", icon: "ChartBar" },
    ],
  },
  {
    label: "Operacje",
    items: [
      { key: "inbox", label: "Inbox", href: "/admin/inbox", icon: "EnvelopeSimple", badgeKey: "inbox" },
      { key: "submissions", label: "Submissions", href: "/admin/submissions", icon: "Tray", badgeKey: "submissions" },
      { key: "offers", label: "Offers (Zerr)", href: "/admin/offers", icon: "Handshake", badgeKey: "offers" },
      { key: "returns", label: "Returns", href: "/admin/returns", icon: "ArrowCounterClockwise" },
    ],
  },
  {
    label: "Relacje",
    items: [
      { key: "klienci", label: "Klienci", href: "/admin/klienci", icon: "Users" },
      { key: "crm", label: "CRM", href: "/admin/crm", icon: "Kanban" },
    ],
  },
  {
    label: "Workflow / CMS",
    items: [
      { key: "zapotrzebowanie", label: "Zapotrzebowanie", href: "/admin/zapotrzebowanie", icon: "Target" },
      { key: "co-warto-dodac", label: "Co warto dodać", href: "/admin/co-warto-dodac", icon: "Sparkle" },
      { key: "zmiany-ceny", label: "Zmiany cen", href: "/admin/zmiany-ceny", icon: "ChartLineDown" },
    ],
  },
  {
    label: "Finanse",
    items: [
      { key: "payouts", label: "Wypłaty", href: "/admin/payouts", icon: "Money", badgeKey: "payouts" },
    ],
  },
  {
    label: "Integracje & system",
    items: [
      { key: "integrations", label: "Fakturownia", href: "/admin/integrations/fakturownia", icon: "FileText", dotKey: "integrations" },
      { key: "audit", label: "Audit log", href: "/admin/audit", icon: "Scroll" },
    ],
  },
];

/** Liczby/kropki do badge'ów — shell podaje co ma; brak wpisu = brak badge. */
export type NavBadges = Record<string, number | boolean | undefined>;

/** Mobile bottom tab bar klienta: 4 taby + FAB w środku (Nowa oferta). */
export const PANEL_TABS = [
  { key: "dashboard", label: "Przegląd", href: "/panel", icon: "SquaresFour" },
  { key: "magazyn", label: "Magazyn", href: "/panel/magazyn", icon: "Package" },
  { key: "wallet", label: "Portfel", href: "/panel/wallet", icon: "Wallet" },
  { key: "more", label: "Więcej", href: "#", icon: "List" },
] as const;

/** Klucze subitemów per parent — do podświetlania parenta. */
export function isItemActive(item: NavItem, activeKey: string | undefined): boolean {
  if (!activeKey) return false;
  if (item.key === activeKey) return true;
  return item.subs?.some((s) => s.key === activeKey) ?? false;
}


/** Wszystkie linki nawigacji (itemy + subitemy) — do dopasowania pathname. */
function allNavLinks(sections: NavSection[]): Array<{ key: string; href: string; label: string }> {
  return sections.flatMap((sec) =>
    sec.items.flatMap((i) => [
      { key: i.key, href: i.href, label: i.label },
      ...(i.subs ?? []).map((s) => ({ key: s.key, href: s.href.split("?")[0], label: s.label })),
    ]),
  );
}

/**
 * Klucz aktywnej pozycji z pathname — najdłuższy pasujący prefiks href.
 * Fallback dla tras spoza nav (np. /panel/products/[id]) przez PATH_ACTIVE_HINTS.
 */
export function activeKeyFromPath(pathname: string, admin = false): string | undefined {
  const sections = admin ? ADMIN_SECTIONS : [...PANEL_SECTIONS, ...PANEL_BOTTOM];
  const links = allNavLinks(sections);
  const roots = new Set(["/panel", "/admin"]);
  let best: { key: string; len: number } | undefined;
  for (const l of links) {
    // Rooty (/panel, /admin) matchują TYLKO exact — inaczej prefiksowo
    // łapałyby każdą trasę i PATH_ACTIVE_HINTS nigdy by nie działały.
    const match = roots.has(l.href)
      ? pathname === l.href
      : pathname === l.href || pathname.startsWith(l.href + "/");
    if (match && (!best || l.href.length > best.len)) best = { key: l.key, len: l.href.length };
  }
  if (best) return best.key;
  for (const [prefix, key] of PATH_ACTIVE_HINTS) {
    if (pathname.startsWith(prefix)) return key;
  }
  return undefined;
}

/** Trasy bez własnej pozycji w nav → którą pozycję podświetlić. */
const PATH_ACTIVE_HINTS: Array<[string, string]> = [
  ["/panel/submissions", "przyjecia"],
  ["/panel/products", "magazyn"],
  ["/panel/offers", "sprzedaze"],
  ["/admin/integrations", "integrations"],
  // (trasy-redirecty jak /panel/my-sales nie potrzebują hintów — pathname
  // nigdy ich nie zobaczy, redirect() dzieje się server-side)
];

/** Label breadcrumba dla pathname (sekcja z nav-config). */
export function breadcrumbLabelFromPath(pathname: string, admin = false): string | undefined {
  const key = activeKeyFromPath(pathname, admin);
  if (!key) return undefined;
  const sections = admin ? ADMIN_SECTIONS : [...PANEL_SECTIONS, ...PANEL_BOTTOM];
  for (const sec of sections) {
    for (const i of sec.items) {
      if (i.key === key) return i.label;
      const sub = (i.subs ?? []).find((s) => s.key === key);
      if (sub) return sub.label;
    }
  }
  return undefined;
}
