import "server-only";

/**
 * Fakturownia REST client (cienka warstwa).
 *
 * API docs: https://app.fakturownia.pl/api
 *
 * Auth model: kazde wywolanie autoryzowane przez `api_token` query param
 * lub Bearer header. Trzymamy w env FAKTUROWNIA_API_KEY.
 *
 * Konfiguracja per-instalacja:
 *   FAKTUROWNIA_API_KEY    — API token z konta Fakturownia (klient Daniel)
 *   FAKTUROWNIA_BASE_URL   — np. https://kickback.fakturownia.pl (twoja subdomena)
 */

const API_KEY = process.env.FAKTUROWNIA_API_KEY ?? "";
const BASE_URL = (process.env.FAKTUROWNIA_BASE_URL ?? "").replace(/\/$/, "");

export const FAKTUROWNIA_CONFIGURED =
  API_KEY.length > 0 && BASE_URL.startsWith("http");

export type FakturowniaError = {
  code: "not_configured" | "http_error" | "network" | "parse_error" | "auth";
  httpStatus?: number;
  message: string;
  body?: string;
};

export type FakturowniaProductInput = {
  warehouseId: number;
  sku: string;
  name: string;
  priceGrossCents: number;
  vatRate: number;       // 0.230, 0.080, 0.050, 0.000
  description?: string;
  ean?: string;
};

export type FakturowniaProductCreated = {
  id: number;
  code: string;          // = sku po stronie Fakturowni
};

/**
 * Tworzy produkt w magazynie komisanta. Wywoływane z server action
 * `pushProductToFakturownia` po A&QC pass.
 *
 * Endpoint: POST /products.json
 */
export async function createFakturowniaProduct(
  input: FakturowniaProductInput,
): Promise<{ ok: true; data: FakturowniaProductCreated } | { ok: false; error: FakturowniaError }> {
  if (!FAKTUROWNIA_CONFIGURED) {
    return {
      ok: false,
      error: {
        code: "not_configured",
        message: "Fakturownia not configured — set FAKTUROWNIA_API_KEY + FAKTUROWNIA_BASE_URL.",
      },
    };
  }

  const body = {
    api_token: API_KEY,
    product: {
      name: input.name,
      code: input.sku,
      price_gross: (input.priceGrossCents / 100).toFixed(2),
      tax: Math.round(input.vatRate * 100),       // Fakturownia oczekuje % jako liczby (23, 8, 5, 0)
      warehouse_id: input.warehouseId,
      description: input.description ?? null,
      ean: input.ean ?? null,
    },
  };

  return await callJson<FakturowniaProductCreated>("/products.json", "POST", body);
}

/**
 * Lista magazynów konta (do admin UI configu).
 *
 * Endpoint: GET /warehouses.json
 */
export async function listFakturowniaWarehouses(): Promise<
  { ok: true; warehouses: Array<{ id: number; name: string }> } | { ok: false; error: FakturowniaError }
> {
  if (!FAKTUROWNIA_CONFIGURED) {
    return {
      ok: false,
      error: { code: "not_configured", message: "Fakturownia not configured." },
    };
  }
  const r = await callJson<Array<{ id: number; name: string }>>(
    `/warehouses.json?api_token=${encodeURIComponent(API_KEY)}`,
    "GET",
  );
  if (!r.ok) return r;
  return { ok: true, warehouses: r.data };
}

/* ====================================================== */
/* internal                                                */
/* ====================================================== */

async function callJson<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: FakturowniaError }> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      // No caching for API calls
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      error: { code: "network", message: e instanceof Error ? e.message : String(e) },
    };
  }

  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: { code: "auth", httpStatus: res.status, message: text, body: text } };
  }
  if (!res.ok) {
    return { ok: false, error: { code: "http_error", httpStatus: res.status, message: text, body: text } };
  }
  if (!text) return { ok: true, data: undefined as unknown as T };
  try {
    const data = JSON.parse(text) as T;
    return { ok: true, data: data };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "parse_error",
        httpStatus: res.status,
        message: `Parse error: ${e instanceof Error ? e.message : String(e)}`,
        body: text.slice(0, 500),
      },
    };
  }
}

/**
 * Retry helper z exponential backoff. Używany w pushProductToFakturownia.
 * Próbuje N razy z opóźnieniami [500ms, 1500ms, 4000ms].
 */
export async function withRetry<T>(
  fn: () => Promise<{ ok: true; data: T } | { ok: false; error: FakturowniaError }>,
  attempts = 3,
): Promise<{ ok: true; data: T } | { ok: false; error: FakturowniaError; attemptsMade: number }> {
  const delays = [500, 1500, 4000];
  let lastErr: FakturowniaError | null = null;
  for (let i = 0; i < attempts; i++) {
    const r = await fn();
    if (r.ok) return r;
    lastErr = r.error;
    // Don't retry auth / config errors — they won't get better.
    if (r.error.code === "auth" || r.error.code === "not_configured" || r.error.code === "parse_error") {
      return { ok: false, error: r.error, attemptsMade: i + 1 };
    }
    if (i < attempts - 1) {
      await new Promise((res) => setTimeout(res, delays[i] ?? 4000));
    }
  }
  return { ok: false, error: lastErr ?? { code: "http_error", message: "unknown" }, attemptsMade: attempts };
}
