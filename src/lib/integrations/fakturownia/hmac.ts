import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Fakturownia webhook signature verification.
 *
 * Wymagane headery:
 *   X-Fakturownia-Timestamp  — Unix seconds, payload-wide nonce
 *   X-Fakturownia-Signature  — hex(HMAC-SHA256(secret, timestamp + rawBody))
 *
 * Bezpieczeństwo:
 *   - HMAC liczone po RAW body (nie po re-JSON.stringify, bo whitespace/order zmienia hash)
 *   - timestamp window 5 min (anty-replay attack)
 *   - timingSafeEqual (anty side-channel timing leak)
 *   - secret z env, brak fallback / hardcode
 *
 * Konfiguracja po stronie Fakturowni:
 *   Settings → Webhooks → Add → POST URL → tutaj wklejasz endpoint
 *   Settings → Webhooks → Secret → wklejasz wartość z FAKTUROWNIA_WEBHOOK_SECRET
 */

const SECRET = process.env.FAKTUROWNIA_WEBHOOK_SECRET ?? "";
const MAX_AGE_SECONDS = 300; // 5 minutes

export const HMAC_CONFIGURED = SECRET.length > 0;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_secret" | "missing_headers" | "stale_timestamp" | "bad_signature" };

/**
 * Verifies a Fakturownia webhook signature.
 *
 * @param rawBody       Raw request body string (NOT re-serialized JSON).
 * @param timestampStr  Value of X-Fakturownia-Timestamp header (Unix seconds).
 * @param signatureHex  Value of X-Fakturownia-Signature header (hex).
 */
export function verifyHmacSignature(
  rawBody: string,
  timestampStr: string | null,
  signatureHex: string | null,
): VerifyResult {
  if (!HMAC_CONFIGURED) return { ok: false, reason: "missing_secret" };
  if (!timestampStr || !signatureHex) return { ok: false, reason: "missing_headers" };

  const ts = parseInt(timestampStr, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: "missing_headers" };

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > MAX_AGE_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const expected = createHmac("sha256", SECRET)
    .update(timestampStr + rawBody, "utf8")
    .digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(signatureHex.trim(), "hex");
  } catch {
    return { ok: false, reason: "bad_signature" };
  }

  // timingSafeEqual wymaga buforów tej samej długości — inaczej tylko length check.
  if (provided.length !== expected.length) {
    return { ok: false, reason: "bad_signature" };
  }

  if (!timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  return { ok: true };
}
