"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message?: string; importedCount?: number; skipped?: string[] } | { ok: false; error: string };

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

function parsePriceCents(raw: string | null): number | null {
  if (!raw) return null;
  const num = parseFloat(String(raw).replace(/[^\d.,]/g, "").replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function parseSizes(raw: FormDataEntryValue | null): string[] {
  if (raw == null) return [];
  // Multi-select form sends comma-separated string or array of strings.
  const s = String(raw).trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 12); // hard cap, anti-abuse
}

/* ====================================================== */
/* Create                                                  */
/* ====================================================== */

export async function createDemandListing(formData: FormData): Promise<Result> {
  const ctx = await adminClient();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const kind = String(formData.get("kind") || "club") as "club" | "national_team" | "player";
  const targetId = String(formData.get("target_id") || "") || null;
  const rawLabel = String(formData.get("raw_label") || "").trim() || null;
  const season = String(formData.get("season") || "").trim() || null;
  const retro = formData.get("retro") === "on";
  const target_price_cents = parsePriceCents(String(formData.get("target_price") || ""));
  const notes = String(formData.get("notes") || "").trim() || null;
  const notes_admin = String(formData.get("notes_admin") || "").trim() || null;
  const sizes = parseSizes(formData.get("sizes"));

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
    notes_admin,
    sizes,
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

/* ====================================================== */
/* Update existing entry                                   */
/* ====================================================== */

export async function updateDemandListing(id: string, formData: FormData): Promise<Result> {
  const ctx = await adminClient();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  // Same fields as create, but we keep kind + target_id immutable
  // (zmiana rodzaju = nowy wpis, czystsze niż wieloznaczne migracje FK).
  const season = String(formData.get("season") || "").trim() || null;
  const retro = formData.get("retro") === "on";
  const target_price_cents = parsePriceCents(String(formData.get("target_price") || ""));
  const notes = String(formData.get("notes") || "").trim() || null;
  const notes_admin = String(formData.get("notes_admin") || "").trim() || null;
  const sizes = parseSizes(formData.get("sizes"));
  const rawLabel = String(formData.get("raw_label") || "").trim() || null;

  const { error } = await ctx.supabase
    .from("demand_listings")
    .update({
      season,
      retro,
      target_price_cents,
      notes,
      notes_admin,
      sizes,
      raw_label: rawLabel,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/zapotrzebowanie");
  revalidatePath("/panel/zapotrzebowanie");
  return { ok: true, message: "Zaktualizowano." };
}

/* ====================================================== */
/* Deactivate / Reactivate                                 */
/* ====================================================== */

export async function deactivateDemandListing(id: string): Promise<Result> {
  return await setActive(id, false);
}

export async function reactivateDemandListing(id: string): Promise<Result> {
  return await setActive(id, true);
}

async function setActive(id: string, active: boolean): Promise<Result> {
  const ctx = await adminClient();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };
  const { error } = await ctx.supabase.from("demand_listings").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/zapotrzebowanie");
  revalidatePath("/panel/zapotrzebowanie");
  return { ok: true };
}

/* ====================================================== */
/* Bulk import (CSV)                                       */
/* ====================================================== */

/**
 * Format CSV (UTF-8, separator przecinek):
 *
 *   kind,nazwa,sezon,retro,cena,rozmiary,notatki
 *   club,Real Madryt,2003/04,1,2500,M;L,
 *   player,Robert Lewandowski,2024/25,0,1800,L,
 *   national_team,Polska,Euro 2024,0,900,M;L;XL,
 *
 * Header wymagane. `kind` musi być z: club, national_team, player.
 * `nazwa` matchowana po dokładnym name z dictionary (clubs/national_teams/players).
 * Jeśli nazwa nie znaleziona w katalogu — wpis trafia z raw_label fallback.
 * `retro` = 1/0/yes/no/true/false. `rozmiary` separowane średnikiem.
 */
export async function bulkImportDemandListings(csvText: string): Promise<Result> {
  const ctx = await adminClient();
  if (!ctx) return { ok: false, error: "Brak uprawnień." };

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { ok: false, error: "Brak wierszy do importu (potrzebny header + co najmniej 1 wiersz danych)." };
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const colKind = header.indexOf("kind");
  const colNazwa = header.indexOf("nazwa");
  const colSezon = header.indexOf("sezon");
  const colRetro = header.indexOf("retro");
  const colCena = header.indexOf("cena");
  const colRozmiary = header.indexOf("rozmiary");
  const colNotatki = header.indexOf("notatki");

  if (colKind < 0 || colNazwa < 0) {
    return { ok: false, error: "Brak wymaganych kolumn: kind, nazwa." };
  }

  // Załaduj słowniki dla matchowania po nazwie
  const [clubsRes, teamsRes, playersRes] = await Promise.all([
    ctx.supabase.from("clubs").select("id, name"),
    ctx.supabase.from("national_teams").select("id, name"),
    ctx.supabase.from("players").select("id, full_name"),
  ]);
  const clubByName = new Map(((clubsRes.data ?? []) as Array<{ id: string; name: string }>)
    .map((c) => [c.name.toLowerCase().trim(), c.id]));
  const teamByName = new Map(((teamsRes.data ?? []) as Array<{ id: string; name: string }>)
    .map((t) => [t.name.toLowerCase().trim(), t.id]));
  const playerByName = new Map(((playersRes.data ?? []) as Array<{ id: string; full_name: string }>)
    .map((p) => [p.full_name.toLowerCase().trim(), p.id]));

  const rows: Record<string, unknown>[] = [];
  const skipped: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;
    const cells = rawLine.split(",").map((c) => c.trim());

    const kindRaw = (cells[colKind] || "").toLowerCase();
    const kind =
      kindRaw === "club" || kindRaw === "national_team" || kindRaw === "player" ? kindRaw : null;
    const nazwa = cells[colNazwa] || "";
    if (!kind || !nazwa) {
      skipped.push(`Wiersz ${i + 1}: brak kind / nazwy`);
      continue;
    }
    const sezon = colSezon >= 0 ? cells[colSezon] || null : null;
    const retroRaw = colRetro >= 0 ? (cells[colRetro] || "").toLowerCase() : "";
    const retro = ["1", "yes", "y", "true", "tak"].includes(retroRaw);
    const cena = colCena >= 0 ? parsePriceCents(cells[colCena]) : null;
    const rozmiaryRaw = colRozmiary >= 0 ? cells[colRozmiary] || "" : "";
    const sizes = rozmiaryRaw
      .split(/[;|]/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 12);
    const notatki = colNotatki >= 0 ? cells[colNotatki] || null : null;

    // Match po nazwie w katalogu
    const lookupKey = nazwa.toLowerCase().trim();
    let targetId: string | null = null;
    if (kind === "club") targetId = clubByName.get(lookupKey) ?? null;
    if (kind === "national_team") targetId = teamByName.get(lookupKey) ?? null;
    if (kind === "player") targetId = playerByName.get(lookupKey) ?? null;

    const row: Record<string, unknown> = {
      kind,
      raw_label: targetId ? null : nazwa, // fallback gdy nie ma w katalogu
      season: sezon,
      retro,
      target_price_cents: cena,
      sizes,
      notes: notatki,
      published_by: ctx.userId,
      active: true,
    };
    if (kind === "club") row.club_id = targetId;
    if (kind === "national_team") row.national_team_id = targetId;
    if (kind === "player") row.player_id = targetId;

    rows.push(row);
  }

  if (rows.length === 0) {
    return { ok: false, error: `Brak prawidłowych wierszy do importu. Skipped: ${skipped.join("; ")}` };
  }

  const { error } = await ctx.supabase.from("demand_listings").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/zapotrzebowanie");
  revalidatePath("/panel/zapotrzebowanie");
  return { ok: true, message: `Zaimportowano ${rows.length} wierszy.`, importedCount: rows.length, skipped };
}
