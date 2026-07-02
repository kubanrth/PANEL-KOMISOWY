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

console.log("selfcheck OK (plural 12 przypadków, formatPLN 5 przypadków)");
