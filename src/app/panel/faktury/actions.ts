"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type UploadResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Uploaduj fakturę / UKS dla rozliczenia sprzedaży.
 * Plik trafia do bucketu `invoices/{user_id}/{uuid}.{ext}` (storage RLS:
 * folder = auth uid). Po uploadzie tworzymy rekord w `invoices`.
 *
 * Server action akceptuje FormData ze standardowego `<form>` (file + type +
 * invoiceNumber + amount). Brak custom request body — Next.js 16 routing
 * lubi proste form submits.
 */
export async function uploadInvoice(formData: FormData): Promise<UploadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Wybierz plik." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "Plik za duży (max 10 MB)." };
  }

  const type = String(formData.get("type") || "faktura_vat");
  const invoiceNumber = String(formData.get("invoice_number") || "").trim() || null;
  const amountRaw = String(formData.get("amount") || "");
  const amount = amountRaw
    ? Math.round(parseFloat(amountRaw.replace(/[^\d.,]/g, "").replace(",", ".")) * 100)
    : null;

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const objectName = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("invoices")
    .upload(objectName, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}` };

  const { data: signed } = await supabase.storage
    .from("invoices")
    .createSignedUrl(objectName, 60 * 60 * 24 * 365);

  const { data: row, error: insErr } = await supabase
    .from("invoices")
    .insert({
      klient_id: user.id,
      type: type as "faktura_vat" | "uks" | "inne",
      file_url: signed?.signedUrl ?? objectName,
      invoice_number: invoiceNumber,
      amount_cents: amount,
      status: "uploaded",
    })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: insErr.message };

  // Powiadomienie admina
  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "document_required",
    title: "Wgrałeś fakturę / UKS",
    body: `Czeka na akceptację administratora. ${invoiceNumber ? `Numer: ${invoiceNumber}.` : ""}`,
    payload: { invoice_id: row.id } as Record<string, unknown>,
  });

  revalidatePath("/panel/faktury");
  revalidatePath("/panel/wallet");
  return { ok: true, id: row.id };
}
