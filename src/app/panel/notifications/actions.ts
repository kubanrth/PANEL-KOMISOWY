"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markRead(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/panel/notifications");
  return { ok: true };
}

/** Form-action variant — returns void as required by `<form action={...}>`. */
export async function markAllRead(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/panel/notifications");
}
