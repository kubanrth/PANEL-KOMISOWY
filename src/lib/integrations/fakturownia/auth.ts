import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Autoryzacja webhooków Fakturowni.
 *
 * Fakturownia NIE podpisuje webhooków HMAC-em. Wysyła nagłówek:
 *   Authorization: Bearer <token>
 * gdzie <token> to wartość wpisana w polu "Secret" przy konfiguracji
 * webhooka (Ustawienia → Ustawienia konta → Integracja → Webhooki).
 *
 * Porównanie stałoczasowe (timingSafeEqual) z FAKTUROWNIA_WEBHOOK_SECRET.
 * ponytail: statyczny token = sufit bezpieczeństwa API Fakturowni (brak
 * HMAC/anty-replay po ich stronie; replay mitygowany idempotentnym event_id).
 * Upgrade path: rotacja sekretu + IP allowlist Fakturowni w proxy.
 */

const SECRET = process.env.FAKTUROWNIA_WEBHOOK_SECRET ?? "";

export const AUTH_CONFIGURED = SECRET.length > 0;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_secret" | "missing_headers" | "bad_token" };

export function verifyBearerToken(authHeader: string | null): VerifyResult {
  if (!AUTH_CONFIGURED) return { ok: false, reason: "missing_secret" };
  if (!authHeader) return { ok: false, reason: "missing_headers" };

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, reason: "missing_headers" };

  const provided = Buffer.from(token, "utf8");
  const expected = Buffer.from(SECRET, "utf8");
  if (provided.length !== expected.length) return { ok: false, reason: "bad_token" };
  if (!timingSafeEqual(provided, expected)) return { ok: false, reason: "bad_token" };
  return { ok: true };
}
