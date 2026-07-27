"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type UksResult = { ok: true } | { ok: false; error: string };

/**
 * Wgranie podpisanego UKS (skan/PDF). Plik ląduje w bucketcie `invoices`
 * (RLS: folder = auth uid — ten sam wzorzec co faktury), rekord w
 * `documents` z type='umowa_ks'. Skan traktujemy jako podpisany.
 */
export async function uploadUks(formData: FormData): Promise<UksResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Wybierz plik." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Plik za duży (max 10 MB)." };
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  if (!["pdf", "png", "jpg", "jpeg", "webp", "heic"].includes(ext)) {
    return { ok: false, error: "Dozwolone formaty: PDF, PNG, JPG, WEBP, HEIC." };
  }

  const submissionId = String(formData.get("submission_id") || "").trim() || null;

  const objectName = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("invoices")
    .upload(objectName, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: `Upload nie powiódł się: ${upErr.message}` };

  const { data: signed, error: signErr } = await supabase.storage
    .from("invoices")
    .createSignedUrl(objectName, 60 * 60 * 24 * 365);
  if (signErr || !signed?.signedUrl) {
    return { ok: false, error: "Nie udało się przygotować linku do dokumentu — spróbuj ponownie." };
  }

  const { error: insErr } = await supabase.from("documents").insert({
    klient_id: user.id,
    submission_id: submissionId,
    type: "umowa_ks",
    file_url: signed.signedUrl,
    signed_at: new Date().toISOString(),
    signed_method: "skan",
  });
  if (insErr) return { ok: false, error: insErr.message };

  // Non-blocking info dla admina/klienta w powiadomieniach.
  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "document_required",
    title: "Wgrałeś Umowę Kupna-Sprzedaży",
    body: "UKS trafił do dokumentów rozliczeniowych.",
  });

  revalidatePath("/panel/uks");
  return { ok: true };
}
