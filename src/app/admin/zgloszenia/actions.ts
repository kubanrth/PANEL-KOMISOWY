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

  const { data: row, error } = await supabase
    .from("fulfillment_orders")
    .update({ status: "shipped", tracking_number: tracking, carrier: carrier || null, shipped_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("klient_id, recipient_name, buyer_name")
    .maybeSingle();
  if (error || !row) return;

  // Non-blocking — komisant widzi tracking od razu w powiadomieniach.
  await supabase.from("notifications").insert({
    user_id: row.klient_id,
    type: "fulfillment_requested",
    title: "Paczka wysłana do Twojego kupującego",
    body: `${carrier ? carrier + " · " : ""}tracking: ${tracking}${row.recipient_name || row.buyer_name ? ` · odbiorca: ${row.recipient_name ?? row.buyer_name}` : ""}`,
    ref_id: id,
  });

  revalidatePath("/admin/zgloszenia");
  revalidatePath("/panel/fulfillment");
}

/** Admin oznacza wysyłkę jako doręczoną. */
export async function markFulfillmentDelivered(formData: FormData): Promise<void> {
  const { supabase, error: authErr } = await requireAdminMutation();
  if (authErr) return;

  const id = String(formData.get("order_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  const { data: row, error } = await supabase
    .from("fulfillment_orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "shipped")
    .select("klient_id, recipient_name, buyer_name")
    .maybeSingle();
  if (error || !row) return;

  await supabase.from("notifications").insert({
    user_id: row.klient_id,
    type: "fulfillment_requested",
    title: "Paczka doręczona",
    body: row.recipient_name || row.buyer_name ? `Odbiorca: ${row.recipient_name ?? row.buyer_name}.` : null,
    ref_id: id,
  });

  revalidatePath("/admin/zgloszenia");
  revalidatePath("/panel/fulfillment");
}
