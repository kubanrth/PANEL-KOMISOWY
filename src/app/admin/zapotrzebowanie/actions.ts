"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "admin" && prof?.role !== "super_admin") return null;
  return { supabase, userId: user.id };
}

/**
 * Publikuj nowe ogłoszenie zapotrzebowania. Kind decyduje który ID jest
 * używany (club_id / national_team_id / player_id). Free text fallback w
 * raw_label.
 */
export async function createDemandListing(formData: FormData): Promise<Result> {
  const ctx = await adminClient();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const kind = String(formData.get("kind") || "club") as "club" | "national_team" | "player";
  const targetId = String(formData.get("target_id") || "") || null;
  const rawLabel = String(formData.get("raw_label") || "").trim() || null;
  const season = String(formData.get("season") || "").trim() || null;
  const retro = formData.get("retro") === "on";
  const priceRaw = String(formData.get("target_price") || "");
  const target_price_cents = priceRaw
    ? Math.round(parseFloat(priceRaw.replace(/[^\d.,]/g, "").replace(",", ".")) * 100)
    : null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!targetId && !rawLabel) {
    return { ok: false, error: "Wybierz z katalogu lub wpisz nazwę ręcznie." };
  }

  const insert: Record<string, unknown> = {
    kind,
    raw_label: rawLabel,
    season,
    retro,
    target_price_cents,
    notes,
    published_by: ctx.userId,
    active: true,
  };
  if (kind === "club") insert.club_id = targetId;
  if (kind === "national_team") insert.national_team_id = targetId;
  if (kind === "player") insert.player_id = targetId;

  const { error } = await ctx.supabase.from("demand_listings").insert(insert);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/zapotrzebowanie");
  revalidatePath("/panel/zapotrzebowanie");
  return { ok: true };
}

export async function deactivateDemandListing(id: string): Promise<Result> {
  const ctx = await adminClient();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };
  const { error } = await ctx.supabase.from("demand_listings").update({ active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/zapotrzebowanie");
  revalidatePath("/panel/zapotrzebowanie");
  return { ok: true };
}
