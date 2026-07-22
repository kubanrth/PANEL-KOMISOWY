import { cache } from "react";
import { createClient } from "./server";

/**
 * Szybka ścieżka auth dla STRON (Server Components).
 *
 * proxy.ts weryfikuje sesję przez auth.getUser() (network call do Supabase
 * Auth) na KAŻDYM requeście do /panel|/admin|/start — strony nie muszą
 * powtarzać tej weryfikacji drugim round-tripem. getSession() czyta
 * zweryfikowaną sesję z cookie (0 ms sieci).
 *
 * ZASADA: server actions i wszystko co MUTUJE dane zostaje na
 * supabase.auth.getUser() — pełna weryfikacja przy każdej mutacji.
 *
 * React cache() deduplikuje wywołania w ramach jednego renderu
 * (strona + shell + layout liczą się jako jeden request).
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
});

/** Wspólny superset pól profilu używany przez gate'y stron i shelle. */
export type OwnProfile = {
  first_name: string | null;
  last_name: string | null;
  role: "klient" | "admin" | "super_admin";
  account_type: "individual" | "business" | null;
  onboarded_at: string | null;
};

/**
 * Profil zalogowanego użytkownika — jedno zapytanie per request
 * (strona i shell dostają ten sam wynik z cache()).
 */
export const getOwnProfile = cache(async (): Promise<OwnProfile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name, role, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  return (data as OwnProfile | null) ?? null;
});

/** Podsumowanie portfela — jedno wykonanie per request (strona + shell). */
export const getWalletSummary = cache(async () => {
  const user = await getSessionUser();
  if (!user) return { balance: 0, available: 0, pending: 0 };
  const supabase = await createClient();
  const { data } = await supabase.rpc("wallet_summary", { klient: user.id });
  return {
    balance: (data?.[0]?.balance_cents as number | undefined) ?? 0,
    available: (data?.[0]?.available_cents as number | undefined) ?? 0,
    pending: (data?.[0]?.pending_cents as number | undefined) ?? 0,
  };
});

/** Dane chrome'u panelu (wallet + liczniki sidebara) — raz per request. */
export const getPanelChrome = cache(async () => {
  const user = await getSessionUser();
  if (!user) return { walletBalance: 0, walletAvailable: 0, badges: {} as Record<string, number | boolean | undefined> };
  const supabase = await createClient();
  try {
    const [summary, listed, demands, picks] = await Promise.all([
      getWalletSummary(),
      // Filtr właściciela jawnie (nie tylko RLS) — admin wchodzący w panel
      // klienta nie może widzieć globalnego licznika całego komisu.
      supabase
        .from("products")
        .select("*, submissions!inner(klient_id)", { count: "exact", head: true })
        .in("status", ["draft", "aqc", "listed", "offer"])
        .eq("submissions.klient_id", user.id),
      supabase.from("demand_listings").select("*", { count: "exact", head: true }).eq("active", true),
      supabase
        .from("kickback_picks")
        .select("*", { count: "exact", head: true })
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    ]);
    return {
      walletBalance: summary.balance,
      walletAvailable: summary.available,
      badges: {
        magazyn: listed.count ?? undefined,
        zapotrzebowanie: demands.count ?? undefined,
        plany: (picks.count ?? 0) > 0,
      } as Record<string, number | boolean | undefined>,
    };
  } catch {
    return { walletBalance: 0, walletAvailable: 0, badges: {} as Record<string, number | boolean | undefined> };
  }
});

/** Liczniki kolejek admina — raz per request. */
export const getAdminBadges = cache(async () => {
  const supabase = await createClient();
  try {
    const [payouts, offers, oferty, wycofania, ceny, wysylki] = await Promise.all([
      supabase.from("payouts").select("*", { count: "exact", head: true }).eq("status", "requested"),
      supabase.from("offers").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("products").select("*", { count: "exact", head: true }).is("listing_price_cents", null).in("status", ["draft", "aqc"]),
      supabase.from("returns").select("*", { count: "exact", head: true }).eq("resolution", "pending").in("reason", ["withdraw_short_term", "withdraw_long_term", "client_rejection"]),
      supabase.from("price_change_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("fulfillment_orders").select("*", { count: "exact", head: true }).eq("status", "pending").not("request_type", "is", null),
    ]);
    const zgloszenia = (wycofania.count ?? 0) + (ceny.count ?? 0) + (wysylki.count ?? 0);
    return {
      payouts: payouts.count ?? undefined,
      offers: offers.count ?? undefined,
      oferty: oferty.count || undefined,
      zgloszenia: zgloszenia || undefined,
    } as Record<string, number | boolean | undefined>;
  } catch {
    return {} as Record<string, number | boolean | undefined>;
  }
});
