/* Runnable check dla nietrywialnej logiki formatowania (ponytail rule).
   Uruchom: node scripts/selfcheck.mjs — exit 1 gdy cokolwiek pęknie. */
const norm = (s) => s.replace(/[  ]/g, " ");

// --- plural (kopia logiki z src/lib/format.ts — TS nie odpala się w node bez builda) ---
function plural(n, [one, few, many]) {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}
const P = ["pozycja", "pozycje", "pozycji"];
const pluralCases = [[1,"pozycja"],[2,"pozycje"],[4,"pozycje"],[5,"pozycji"],[11,"pozycji"],[12,"pozycji"],[14,"pozycji"],[22,"pozycje"],[24,"pozycje"],[25,"pozycji"],[112,"pozycji"],[122,"pozycje"]];
for (const [n, want] of pluralCases) {
  const got = plural(n, P);
  if (got !== want) { console.error(`plural(${n}) = ${got}, oczekiwano ${want}`); process.exit(1); }
}

// --- formatPLN grouping (logika forceGrouping z src/lib/format.ts) ---
const PLN_INT = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const PLN = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fg = (str) => str.replace(/\d{4,}/g, (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, " "));
const moneyCases = [
  [fg(PLN_INT.format(8240)), "8 240 zł"],
  [fg(PLN.format(89.5)), "89,50 zł"],
  [fg(PLN_INT.format(148000)), "148 000 zł"],
  [fg(PLN.format(2340.75)), "2 340,75 zł"],
  [fg(PLN_INT.format(999)), "999 zł"],
];
for (const [got, want] of moneyCases) {
  if (norm(got) !== want) { console.error(`grouping: ${norm(got)}, oczekiwano ${want}`); process.exit(1); }
}

// --- parsePriceToCents (kopia logiki z MagazynTable.tsx — polskie formaty cen) ---
function parsePriceToCents(raw) {
  const s = raw.replace(/[^\d.,]/g, "");
  if (!s || (s.match(/,/g) ?? []).length > 1) return null;
  let normalized;
  if (s.includes(",")) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = s.split(".");
    normalized = parts.length === 2 && parts[1].length <= 2 ? s : parts.join("");
  }
  const value = parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}
const priceCases = [
  ["1200", 120000],
  ["1200,50", 120050],
  ["1 200", 120000],
  ["1.200", 120000],      // kropka jako separator tysięcy (stary kod: 120)
  ["1.200,50", 120050],
  ["12.5", 1250],
  ["1200 zł", 120000],
  ["", null],
  ["abc", null],
  ["0", null],
  ["-50", 5000],           // regex zjada minus; server i tak waliduje > 0
  ["1,2,3", null],
];
for (const [input, want] of priceCases) {
  const got = parsePriceToCents(input);
  if (got !== want) { console.error(`parsePriceToCents(${JSON.stringify(input)}) = ${got}, oczekiwano ${want}`); process.exit(1); }
}

// --- fulfillment: parseProductIds + kod pocztowy (kopia logiki z panel/fulfillment/actions.ts) ---
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseProductIds(raw) {
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
  if (!ids.length || ids.some((id) => !UUID_RE.test(id))) return null;
  return ids;
}
const A = "11111111-2222-3333-4444-555555555555";
const B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const idCases = [
  ["", null],
  ["   ", null],
  ["abc", null],
  [A, [A]],
  [`${A},${B}`, [A, B]],
  [` ${A} , ${B} `, [A, B]],       // trim
  [`${A},${A},${B}`, [A, B]],      // dedup
  [`${A},`, [A]],                  // trailing comma
  [`${A},not-a-uuid`, null],       // jeden zły = całość odrzucona
];
for (const [input, want] of idCases) {
  const got = parseProductIds(input);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.error(`parseProductIds(${JSON.stringify(input)}) = ${JSON.stringify(got)}, oczekiwano ${JSON.stringify(want)}`);
    process.exit(1);
  }
}

const POSTAL_RE = /^\d{2}-\d{3}$/;
const postalCases = [
  ["00-950", true],
  ["31-002", true],
  ["00950", false],
  ["0-950", false],
  ["00-95", false],
  ["00-9500", false],
  ["ab-cde", false],
  [" 00-950", false],  // action trimuje przed testem; regex sam nie przepuszcza spacji
  ["", false],
];
for (const [input, want] of postalCases) {
  const got = POSTAL_RE.test(input);
  if (got !== want) { console.error(`POSTAL_RE(${JSON.stringify(input)}) = ${got}, oczekiwano ${want}`); process.exit(1); }
}


// --- activeKeyFromPath (kopia logiki z src/components/panel/nav-config.ts) ---
// Nietrywialne: rooty matchują tylko exact, reszta longest-prefix, potem hinty.
function activeKeyFromPath(pathname, links, hints) {
  const roots = new Set(["/panel", "/admin"]);
  let best;
  for (const l of links) {
    const match = roots.has(l.href)
      ? pathname === l.href
      : pathname === l.href || pathname.startsWith(l.href + "/");
    if (match && (!best || l.href.length > best.len)) best = { key: l.key, len: l.href.length };
  }
  if (best) return best.key;
  for (const [prefix, key] of hints) if (pathname.startsWith(prefix)) return key;
  return undefined;
}
{
  const links = [
    { href: "/panel", key: "dashboard" },
    { href: "/panel/magazyn", key: "magazyn" },
    { href: "/panel/wallet", key: "wallet" },
    { href: "/admin", key: "queue" },
    { href: "/admin/returns", key: "returns" },
  ];
  const hints = [["/panel/products", "magazyn"], ["/admin/integrations", "integrations"]];
  const navCases = [
    ["/panel", "dashboard"],                    // root exact
    ["/panel/magazyn", "magazyn"],
    ["/panel/magazyn/abc", "magazyn"],          // prefix z separatorem
    ["/panel/magazynek", undefined],            // prefix BEZ separatora nie łapie
    ["/panel/products/123", "magazyn"],         // hint działa (root nie zjada trasy)
    ["/admin/integrations/fakturownia", "integrations"],
    ["/admin", "queue"],
    ["/admin/returns", "returns"],
    ["/login", undefined],
  ];
  for (const [path, want] of navCases) {
    const got = activeKeyFromPath(path, links, hints);
    if (got !== want) { console.error(`activeKeyFromPath(${path}) = ${got}, oczekiwano ${want}`); process.exit(1); }
  }
}


// --- parseOfferCsv (kopia logiki z src/lib/offer-csv.ts — formatka „Wgraj przez plik") ---
function splitCsv(text, delimiter) {
  const rows = []; let row = []; let field = ""; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = ""; rows.push(row); row = [];
    } else field += ch;
  }
  row.push(field); rows.push(row);
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}
function parseOfferCsv(raw) {
  const text = raw.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = splitCsv(text, delimiter);
  if (rows.length < 2) return { products: [], errors: ["empty"] };
  const products = []; const errors = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r].map((c) => c.trim());
    const rowNo = r + 1;
    const [brand = "", model = "", category = "", size = "", conditionRaw = "", expectedPrice = "", minPrice = "", description = ""] = cells;
    if (!brand) { errors.push(`Wiersz ${rowNo}: brak marki.`); continue; }
    if (!model) { errors.push(`Wiersz ${rowNo}: brak modelu.`); continue; }
    if (!expectedPrice) { errors.push(`Wiersz ${rowNo}: brak ceny oczekiwanej.`); continue; }
    let condition = 9;
    if (conditionRaw) {
      const n = parseInt(conditionRaw, 10);
      if (Number.isNaN(n) || n < 1 || n > 10) { errors.push(`Wiersz ${rowNo}: stan musi być liczbą 1–10.`); continue; }
      condition = n;
    }
    products.push({ brand, model, category, size, condition, expectedPrice, minPrice, description });
  }
  return { products, errors };
}
{
  const H = "Marka*;Model*;Kategoria;Rozmiar;Stan (1-10);Cena oczekiwana (zł)*;Cena minimalna (zł);Opis / uwagi";
  const csvCases = [
    // [opis, wejście, oczekiwane produkty, oczekiwane błędy]
    ["średniki + BOM", "\uFEFF" + H + "\r\nNike;MU Home 1999;Koszulka;L;9;1 600;1 200;ok", 1, 0],
    ["przecinki", "Marka*,Model*,Kat,R,Stan,Cena,Min,Opis\nAdidas,Arsenal 2003,,,8,2 200,,", 1, 0],
    ["cudzysłów z separatorem", H + '\nNike;"Home; retro";;;;900;;"opis, z przecinkiem"', 1, 0],
    ["escaped quote", H + '\nNike;"Model ""X""";;;;500;;', 1, 0],
    ["brak marki → błąd", H + "\n;Model;;;;100;;", 0, 1],
    ["brak ceny → błąd", H + "\nNike;Model;;;;;;", 0, 1],
    ["zły stan → błąd", H + "\nNike;Model;;;15;100;;", 0, 1],
    ["puste wiersze pomijane", H + "\n\nNike;Model;;;;100;;\n\n", 1, 0],
    ["domyślny stan 9", H + "\nNike;Model;;;;100;;", 1, 0],
  ];
  for (const [name, input, wantP, wantE] of csvCases) {
    const got = parseOfferCsv(input);
    if (got.products.length !== wantP || got.errors.length !== wantE) {
      console.error(`parseOfferCsv[${name}]: products=${got.products.length}/${wantP}, errors=${got.errors.length}/${wantE}`, got.errors);
      process.exit(1);
    }
  }
  const d9 = parseOfferCsv(H + "\nNike;Model;;;;100;;").products[0];
  if (d9.condition !== 9) { console.error("parseOfferCsv: domyślny stan != 9"); process.exit(1); }
}

console.log("selfcheck OK (plural 12, formatPLN 5, parsePriceToCents 12, parseProductIds 9, kod pocztowy 9, activeKeyFromPath 9, parseOfferCsv 9 przypadków)");

// --- parser webhooka Fakturowni (kopia logiki kind/event_id z route.ts) ---
{
  const SALE_KINDS = new Set(["vat", "receipt", "bill", "final", "kp"]);
  const pick = (o, k) => (typeof o[k] === "string" && o[k].length > 0 ? o[k] : null);
  const parse = (payload) => {
    const inv = payload.invoice ?? payload.document ?? payload;
    const invId = inv.id != null ? String(inv.id) : "";
    const invKind = pick(inv, "kind") ?? "";
    const eventName = pick(payload, "event") ?? pick(payload, "event_type") ?? pick(payload, "type") ?? "";
    const isDestroy = /destroy|delete/i.test(eventName);
    const isInvoice = invId !== "" && ("positions" in inv || "number" in inv || invKind !== "");
    let kind = "unknown";
    if (isInvoice && !isDestroy && (SALE_KINDS.has(invKind) || invKind === "")) kind = "invoice_sale";
    else if (/mm|movement|magazyn|przesun/i.test(eventName)) kind = "mm_sale";
    else if (isInvoice) kind = `invoice_${invKind || "other"}${isDestroy ? "_destroy" : ""}`;
    else if (eventName) kind = eventName;
    return kind;
  };
  const cases = [
    [{ event: "invoice:create", invoice: { id: 1, kind: "receipt", positions: [] } }, "invoice_sale"],
    [{ event: "invoice:create", invoice: { id: 2, kind: "vat", number: "F/1" } }, "invoice_sale"],
    [{ event: "invoice:destroy", invoice: { id: 3, kind: "vat", number: "F/1" } }, "invoice_vat_destroy"],
    [{ event: "invoice:create", invoice: { id: 4, kind: "proforma", positions: [] } }, "invoice_proforma"],
    [{ id: 5, kind: "receipt", positions: [] }, "invoice_sale"], // płaski payload
    [{ event: "client:create", client: { id: 9 } }, "client:create"],
    [{ event: "warehouse_movement", document: { id: 7 } }, "mm_sale"],
  ];
  for (const [p, want] of cases) {
    const got = parse(p);
    if (got !== want) { console.error(`fakturownia parse: ${JSON.stringify(p.event ?? p.kind)} → ${got}, oczekiwano ${want}`); process.exit(1); }
  }
  console.log("parser webhooka Fakturowni OK (7 przypadków)");
}
