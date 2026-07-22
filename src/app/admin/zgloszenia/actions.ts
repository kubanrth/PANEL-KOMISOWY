"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdminMutation() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Brak sesji." };
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (prof?.role !== "admin" && prof?.role !== "super_admin") return { supabase, error: "Brak uprawnień." };
  return { supabase, error: null };
}

/** Admin oznacza zgłoszenie fulfillment jako wysłane (tracking + kurier). */
export async function markFulfillmentShipped(formData: FormData): Promise<void> {
  const { supabase, error: authErr } = await requireAdminMutation();
  if (authErr) return;

  const id = String(formData.get("order_id") ?? "");
  const tracking = String(formData.get("tracking_number") ?? "").trim();
  const carrier = String(formData.get("carrier") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !tracking) return;

  const { error } = await supabase
    .from("fulfillment_orders")
    .update({ status: "shipped", tracking_number: tracking, carrier: carrier || null, shipped_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return;

  revalidatePath("/admin/zgloszenia");
}

/** Admin oznacza wysyłkę jako doręczoną. */
export async function markFulfillmentDelivered(formData: FormData): Promise<void> {
  const { supabase, error: authErr } = await requireAdminMutation();
  if (authErr) return;

  const id = String(formData.get("order_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  const { error } = await supabase
    .from("fulfillment_orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "shipped");
  if (error) return;

  revalidatePath("/admin/zgloszenia");
}
