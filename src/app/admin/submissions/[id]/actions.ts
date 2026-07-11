"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pushProductToFakturownia } from "@/lib/integrations/fakturownia/push";
import { PRODUCT_STAGES, type ProductStage } from "@/lib/types";

type Result = { ok: true; note?: string } | { ok: false; error: string };

/**
 * Admin ustawia etap pipeline'u magazynowego produktu (formularz
 * w /admin/submissions/[id]). Etap 'listing' = następca A&QC pass:
 * promuje status do 'listed', pushuje produkt do Fakturowni
 * i notyfikuje właściciela.
 */
export async function updateProductStage(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Brak sesji." };

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "admin" && prof?.role !== "super_admin") {
    return { ok: false, error: "Brak uprawnień." };
  }

  const productId = String(formData.get("product_id") ?? "").trim();
  const stage = String(formData.get("stage") ?? "") as ProductStage;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { ok: false, error: "Nieprawidłowy produkt." };
  if (!PRODUCT_STAGES.some((s) => s.key === stage)) return { ok: false, error: "Nieznany etap." };

  const { data: product } = await supabase
    .from("products")
    .select("id, status, stage, brand, model, submission_id, submissions ( klient_id )")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Produkt nie istnieje." };

  const goesLive = stage === "listing" && ["draft", "aqc"].includes(product.status as string);
  const { error: updErr } = await supabase
    .from("products")
    .update({
      stage,
      // Promocja statusu tylko w przód i tylko na 'listing' — etapy wstecz
      // nie cofają produktu, który już jest w sprzedaży/sprzedany.
      ...(goesLive ? { status: "listed", published_at: new Date().toISOString() } : {}),
    })
    .eq("id", productId);
  if (updErr) return { ok: false, error: updErr.message };

  let note: string | undefined;
  if (goesLive) {
    const sub = Array.isArray(product.submissions) ? product.submissions[0] : product.submissions;
    if (sub?.klient_id) {
      // Non-blocking — brak notyfikacji nie może zablokować wystawienia.
      await supabase.from("notifications").insert({
        user_id: sub.klient_id,
        type: "aqc_complete",
        title: `Wystawione: ${product.brand} ${product.model}`,
        body: "Produkt przeszedł weryfikację i jest w sprzedaży.",
        ref_id: product.id,
      });
    }
    const push = await pushProductToFakturownia(productId);
    if (!push.ok) {
      note = push.queued
        ? "Wystawione; push do Fakturowni nie powiódł się — trafił do kolejki (Integracje → replay)."
        : `Wystawione; push do Fakturowni nie powiódł się: ${push.error.message}`;
    }
  }

  revalidatePath(`/admin/submissions/${product.submission_id}`);
  revalidatePath("/admin/submissions");
  return { ok: true, note };
}
