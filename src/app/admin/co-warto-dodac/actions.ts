"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function adminCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!["admin", "super_admin"].includes(prof?.role ?? "")) return null;
  return { supabase, userId: user.id };
}

function parseExpiresAt(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Akceptujemy YYYY-MM-DD lub pełen ISO.
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parsePriority(raw: string | null): number {
  const n = parseInt(String(raw ?? "100"), 10);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(10_000, n));
}

/* ====================================================== */
/* Create                                                  */
/* ====================================================== */

export async function createPick(formData: FormData): Promise<Result> {
  const ctx = await adminCtx();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tytuł jest wymagany." };

  const description = String(formData.get("description") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || null;
  const priority = parsePriority(formData.get("priority") as string | null);
  const image_url = String(formData.get("image_url") || "").trim() || null;
  const cta_label = String(formData.get("cta_label") || "").trim() || null;
  const cta_href = String(formData.get("cta_href") || "").trim() || null;
  const expires_at = parseExpiresAt(formData.get("expires_at") as string | null);

  const { error } = await ctx.supabase.from("kickback_picks").insert({
    title,
    description,
    category,
    priority,
    image_url,
    cta_label,
    cta_href,
    expires_at,
    active: true,
    created_by: ctx.userId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/co-warto-dodac");
  revalidatePath("/panel/plany");
  return { ok: true, message: "Pick opublikowany." };
}

/* ====================================================== */
/* Update                                                  */
/* ====================================================== */

export async function updatePick(id: string, formData: FormData): Promise<Result> {
  const ctx = await adminCtx();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tytuł jest wymagany." };

  const patch = {
    title,
    description: String(formData.get("description") || "").trim() || null,
    category: String(formData.get("category") || "").trim() || null,
    priority: parsePriority(formData.get("priority") as string | null),
    image_url: String(formData.get("image_url") || "").trim() || null,
    cta_label: String(formData.get("cta_label") || "").trim() || null,
    cta_href: String(formData.get("cta_href") || "").trim() || null,
    expires_at: parseExpiresAt(formData.get("expires_at") as string | null),
  };

  const { error } = await ctx.supabase.from("kickback_picks").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/co-warto-dodac");
  revalidatePath("/panel/plany");
  return { ok: true, message: "Pick zaktualizowany." };
}

/* ====================================================== */
/* Toggle active                                           */
/* ====================================================== */

export async function togglePickActive(id: string, nextActive: boolean): Promise<Result> {
  const ctx = await adminCtx();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const { error } = await ctx.supabase
    .from("kickback_picks")
    .update({ active: nextActive })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/co-warto-dodac");
  revalidatePath("/panel/plany");
  return { ok: true };
}

/* ====================================================== */
/* Delete                                                  */
/* ====================================================== */

export async function deletePick(id: string): Promise<Result> {
  const ctx = await adminCtx();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const { error } = await ctx.supabase.from("kickback_picks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/co-warto-dodac");
  revalidatePath("/panel/plany");
  return { ok: true };
}
