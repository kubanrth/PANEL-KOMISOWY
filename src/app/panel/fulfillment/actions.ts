"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FulfillmentResult = { ok: true; count: number } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSTAL_RE = /^\d{2}-\d{3}$/;
const CARRIERS = ["DPD", "InPost", "DHL", "UPS"] as const;
/** Statusy produktu, z których można zlecić wysyłkę. */
const SHIPPABLE = ["listed", "offer", "aqc"] as const;

/** Sygnatury plików — Content-Type/rozszerzenie z przeglądarki nie są zaufane. */
const LABEL_MAGIC: Record<string, { bytes: number[]; mime: string }> = {
  pdf: { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf" },
  png: { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png" },
  jpg: { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  jpeg: { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
};

/** Comma-separated UUID → unikalna lista albo null. (kopia w scripts/selfcheck.mjs) */
function parseProductIds(raw: string): string[] | null {
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
  if (!ids.length || ids.some((id) => !UUID_RE.test(id))) return null;
  return ids;
}

/**
 * Klient zleca wysyłkę produktów z magazynu Kickback — albo załącza
 * własny list przewozowy (label_provided), albo podaje dane odbiorcy,
 * z których Kickback wygeneruje list (generate_label).
 *
 * Jeden wiersz fulfillment_orders per produkt, status 'pending'.
 * Wymaga migracji 015 (kolumny + bucket shipping-labels + RLS insert).
 */
export async function requestFulfillment(formData: FormData): Promise<FulfillmentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  // --- 1. Walidacja wejścia na brzegu ---
  const productIds = parseProductIds(String(formData.get("product_ids") || ""));
  if (!productIds) return { ok: false, error: "Zaznacz co najmniej jeden produkt." };

  const requestType = String(formData.get("request_type") || "");
  if (requestType !== "label_provided" && requestType !== "generate_label") {
    return { ok: false, error: "Wybierz sposób nadania: własny list przewozowy albo dane do wygenerowania listu." };
  }

  const notes = String(formData.get("notes") || "").trim() || null;
  if (notes && notes.length > 500) return { ok: false, error: "Notatka może mieć maksymalnie 500 znaków." };

  let labelFile: File | null = null;
  let labelExt = "";
  let recipientName: string | null = null;
  let recipientPhone: string | null = null;
  let recipientAddress: string | null = null;
  let recipientPostal: string | null = null;
  let recipientCity: string | null = null;
  let carrier: string | null = null;

  if (requestType === "label_provided") {
    const file = formData.get("label");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Załącz list przewozowy (PDF, PNG lub JPG)." };
    }
    if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Plik za duży (max 10 MB)." };
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const magic = LABEL_MAGIC[ext];
    if (!magic) return { ok: false, error: "Dozwolone formaty listu: PDF, PNG, JPG." };
    const head = new Uint8Array(await file.slice(0, magic.bytes.length).arrayBuffer());
    if (!magic.bytes.every((b, i) => head[i] === b)) {
      return { ok: false, error: "Plik nie jest poprawnym PDF/PNG/JPG." };
    }
    labelFile = file;
    labelExt = ext;
  } else {
    recipientName = String(formData.get("recipient_name") || "").trim() || null;
    recipientAddress = String(formData.get("recipient_address_line") || "").trim() || null;
    recipientCity = String(formData.get("recipient_city") || "").trim() || null;
    const postal = String(formData.get("recipient_postal_code") || "").trim();
    if (!recipientName || !recipientAddress || !recipientCity) {
      return { ok: false, error: "Uzupełnij dane odbiorcy: imię i nazwisko, adres oraz miasto." };
    }
    if (!POSTAL_RE.test(postal)) return { ok: false, error: "Kod pocztowy w formacie 00-000." };
    recipientPostal = postal;
    recipientPhone = String(formData.get("recipient_phone") || "").trim() || null;
    const carrierRaw = String(formData.get("carrier") || "");
    if (carrierRaw && !(CARRIERS as readonly string[]).includes(carrierRaw)) {
      return { ok: false, error: "Nieznany przewoźnik. Dostępne: DPD, InPost, DHL, UPS." };
    }
    carrier = carrierRaw || null;
  }

  // --- 2. Własność + stan produktów (RLS też filtruje, ale sprawdzamy jawnie) ---
  const { data: productsRaw, error: prodErr } = await supabase
    .from("products")
    .select("id, brand, model, status, submission_id, submissions!inner(klient_id)")
    .in("id", productIds);
  if (prodErr) return { ok: false, error: prodErr.message };

  type Row = {
    id: string;
    brand: string | null;
    model: string | null;
    status: string;
    submissions: { klient_id: string } | { klient_id: string }[] | null;
  };
  const products = (productsRaw ?? []) as Row[];
  const label = (p: Row) => [p.brand, p.model].filter(Boolean).join(" ") || p.id.slice(0, 8);

  const foundIds = new Set(products.map((p) => p.id));
  const missing = productIds.filter((id) => !foundIds.has(id));
  const notOwned = products.filter((p) => {
    const owner = Array.isArray(p.submissions) ? p.submissions[0]?.klient_id : p.submissions?.klient_id;
    return owner !== user.id;
  });
  if (missing.length || notOwned.length) {
    return { ok: false, error: "Część produktów nie istnieje lub nie należy do Ciebie." };
  }
  const badStatus = products.filter((p) => !(SHIPPABLE as readonly string[]).includes(p.status));
  if (badStatus.length) {
    return {
      ok: false,
      error: `Nie można zlecić wysyłki dla: ${badStatus.map(label).join(", ")} — status uniemożliwia wysyłkę (dozwolone: w magazynie, z ofertą lub w A&QC).`,
    };
  }

  // --- 3. Produkty z już otwartym zleceniem ---
  const { data: open, error: openErr } = await supabase
    .from("fulfillment_orders")
    .select("product_id")
    .in("product_id", productIds)
    .in("status", ["pending", "shipped"]);
  if (openErr) return { ok: false, error: openErr.message };
  if (open?.length) {
    const busy = new Set(open.map((o) => o.product_id as string));
    const names = products.filter((p) => busy.has(p.id)).map(label).join(", ");
    return { ok: false, error: `Te produkty mają już otwarte zlecenie wysyłki: ${names}.` };
  }

  // --- 4. Upload własnego listu (po walidacjach — brak osieroconych plików) ---
  let labelUrl: string | null = null;
  if (labelFile) {
    const objectName = `${user.id}/${crypto.randomUUID()}.${labelExt}`;
    const { error: upErr } = await supabase.storage
      .from("shipping-labels")
      .upload(objectName, labelFile, { contentType: LABEL_MAGIC[labelExt].mime, upsert: false });
    if (upErr) return { ok: false, error: `Upload nie powiódł się: ${upErr.message}` };
    const { data: signed } = await supabase.storage
      .from("shipping-labels")
      .createSignedUrl(objectName, 60 * 60 * 24 * 365);
    labelUrl = signed?.signedUrl ?? objectName;
  }

  // --- 5. Insert per produkt ---
  const rows = productIds.map((productId) => ({
    klient_id: user.id,
    product_id: productId,
    status: "pending",
    request_type: requestType,
    label_url: labelUrl,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    recipient_address_line: recipientAddress,
    recipient_postal_code: recipientPostal,
    recipient_city: recipientCity,
    carrier,
    notes,
    requested_by: user.id,
  }));
  const { error: insErr } = await supabase.from("fulfillment_orders").insert(rows);
  if (insErr) {
    // 23505 = partial unique index fulfillment_one_open_per_product (race dwóch submitów)
    return insErr.code === "23505"
      ? { ok: false, error: "Część produktów ma już otwarte zlecenie wysyłki. Odśwież stronę." }
      : { ok: false, error: insErr.message };
  }

  // Wpis do historii powiadomień — celowo non-blocking (wzorzec z magazyn/actions).
  // Wymaga policy notifications_insert_own (014) + enum 'fulfillment_requested' (015).
  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "fulfillment_requested",
    title: `Zleciłeś wysyłkę ${productIds.length} pozycji`,
    body:
      requestType === "label_provided"
        ? "Z załączonym własnym listem przewozowym. Kickback nada paczkę z magazynu."
        : `Kickback wygeneruje list przewozowy${carrier ? ` (${carrier})` : ""} i nada paczkę z magazynu.`,
    payload: { product_ids: productIds, request_type: requestType } as Record<string, unknown>,
  });

  revalidatePath("/panel/fulfillment");
  return { ok: true, count: productIds.length };
}
