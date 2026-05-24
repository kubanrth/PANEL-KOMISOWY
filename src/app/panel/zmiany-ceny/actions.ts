"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Klient ostatecznie cofa swoją własną sugestię (status pending) lub
 * decyduje co zrobić ze sugestią admina ("nasza rekomendacja"). RLS
 * pozwala update tylko własnych pending wpisów.
 */
export async function decideOnPriceChange(
  requestId: string,
  decision: "cancelled",
): Promise<ActionResult> {
  if (decision !== "cancelled") return { ok: false, error: "Niepoprawna decyzja." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  const { error } = await supabase
    .from("price_change_requests")
    .update({ status: "cancelled", decided_at: new Date().toISOString(), decided_by: user.id })
    .eq("id", requestId)
    .eq("requested_by", user.id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/zmiany-ceny");
  return { ok: true };
}
