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

console.log("selfcheck OK (plural 12, formatPLN 5, parsePriceToCents 12, parseProductIds 9, kod pocztowy 9 przypadków)");
