"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function makeSlug(): string {
  // Short URL-safe slug, base32 (excluding ambiguous chars)
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export async function generateQrForProduct(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!prof || !["admin", "super_admin"].includes(prof.role)) return;

  const productId = String(formData.get("product_id") || "");
  if (!productId) return;

  // Generate unique slug
  let slug = makeSlug();
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase.from("qr_codes").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = makeSlug();
  }

  await supabase.from("qr_codes").insert({
    product_id: productId,
    slug,
  });

  await supabase.from("audit_log").insert({
    actor_id: user.id, action: "qr_generate", target_type: "product", target_id: productId, payload: { slug },
  });

  revalidatePath("/admin/qr");
  redirect(`/admin/qr/${productId}`);
}
