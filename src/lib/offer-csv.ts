/* Parser formatki CSV „Wgraj przez plik" (Nowa oferta).
   Format: nagłówek + wiersze; separator ; lub , (auto-detekcja),
   pola w cudzysłowach mogą zawierać separator/nowe linie/"" (escaped quote).
   ponytail: tylko CSV — xlsx wymagałby zależności; formatka instruuje
   „zapisz jako CSV", dodać SheetJS gdy klienci zaczną słać .xlsx. */

export type CsvProduct = {
  brand: string;
  model: string;
  category: string;
  size: string;
  condition: number;
  expectedPrice: string;
  minPrice: string;
  description: string;
};

export type CsvParseResult = {
  products: CsvProduct[];
  /** Błędy per wiersz (1-indexed licząc z nagłówkiem) — wiersz pominięty. */
  errors: string[];
};

/** Nagłówki formatki — kolejność kolumn jest stała. */
export const CSV_HEADERS = [
  "Marka*",
  "Model*",
  "Kategoria",
  "Rozmiar",
  "Stan (1-10)",
  "Cena oczekiwana (zł)*",
  "Cena minimalna (zł)",
  "Opis / uwagi",
] as const;

/** Rozbija tekst CSV na wiersze pól, honorując cudzysłowy. */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  // Usuń puste wiersze (same puste pola)
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export function parseOfferCsv(raw: string): CsvParseResult {
  const text = raw.replace(/^﻿/, ""); // BOM z Excela
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  // Auto-detekcja separatora: polski Excel zapisuje CSV ze średnikami.
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows = splitCsv(text, delimiter);
  if (rows.length < 2) return { products: [], errors: ["Plik nie zawiera żadnych wierszy z produktami."] };

  const products: CsvProduct[] = [];
  const errors: string[] = [];

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

/** Treść formatki do pobrania (średniki — otwiera się wprost w polskim Excelu). */
export function templateCsv(): string {
  const example = ["Nike", "Manchester United Home 1999", "Koszulka", "L", "9", "1 600", "1 200", "Oryginalna metka, stan bardzo dobry"];
  return "﻿" + [CSV_HEADERS.join(";"), example.join(";")].join("\r\n");
}
