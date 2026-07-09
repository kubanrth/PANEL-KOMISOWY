"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

export type BankResult = { ok: true } | { ok: false; error: string };

/**
 * Admin ustawia konto bankowe klienta (konto z umowy komisowej).
 * Zastępuje samoobsługowe addBankAccount z panelu klienta — decyzja
 * 2026-07-08: "jedno stałe konto, my wiemy że to konto z umowy".
 * Nowe konto staje się domyślnym; poprzednie tracą is_default.
 */
export async function setClientBankAccount(formData: FormData): Promise<BankResult> {
  const { supabase } = await requireAdmin(); // pełny auth admina (mutacja)

  const klientId = String(formData.get("klient_id") ?? "").trim();
  const bankName = String(formData.get("bank_name") ?? "").trim();
  const ibanRaw = String(formData.get("iban") ?? "").replace(/\s+/g, "").toUpperCase();

  if (!/^[0-9a-f-]{36}$/i.test(klientId)) return { ok: false, error: "Nieprawidłowy klient." };
  if (bankName.length < 2) return { ok: false, error: "Podaj nazwę banku." };
  // Polski IBAN: PL + 26 cyfr (albo same 26 cyfr — dopniemy prefiks).
  const iban = /^\d{26}$/.test(ibanRaw) ? `PL${ibanRaw}` : ibanRaw;
  if (!/^PL\d{26}$/.test(iban)) return { ok: false, error: "IBAN w formacie PL + 26 cyfr." };

  const { error: unsetErr } = await supabase
    .from("bank_accounts")
    .update({ is_default: false })
    .eq("klient_id", klientId);
  if (unsetErr) return { ok: false, error: unsetErr.message };

  const { error } = await supabase
    .from("bank_accounts")
    .insert({ klient_id: klientId, bank_name: bankName, iban, is_default: true });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/klienci/${klientId}`);
  return { ok: true };
}
