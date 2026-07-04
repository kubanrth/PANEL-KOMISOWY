import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/panel/StatusPill";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate, takeHomeCents } from "@/lib/format";
import type { Product, Submission } from "@/lib/types";

/* Nadchodzące wypłaty — redesign: sticky KPI „Łącznie w tym roku", 2 KPI
   (gotowe / karencja), tabela z label-headerem i pigułkami mint/yellow.
   ponytail: brak tabeli payoutów w tym widoku (query nietknięte) — statusy
   ZLECONA/W REALIZACJI dojdą, gdy widok dostanie dane z `payouts`. */

export default async function WyplatyPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: soldsRaw } = await supabase
    .from("products")
    .select("*")
    .eq("status", "sold")
    .order("sold_at", { ascending: false, nullsFirst: false });
  const solds = (soldsRaw ?? []) as Product[];

  const subIds = Array.from(new Set(solds.map((p) => p.submission_id)));
  const { data: subs } = subIds.length
    ? await supabase
        .from("submissions")
        .select("id, commission_rate")
        .in("id", subIds)
    : { data: [] as Array<Pick<Submission, "id" | "commission_rate">> };
  const subById = new Map((subs ?? []).map((s) => [s.id, s]));

  const now = Date.now();
  const FOURTEEN_D = 14 * 86_400_000;

  const pending = solds.filter((p) => p.sold_at && now - new Date(p.sold_at).getTime() < FOURTEEN_D);
  const ready = solds.filter((p) => p.sold_at && now - new Date(p.sold_at).getTime() >= FOURTEEN_D);

  const pendingValue = pending.reduce((a, p) => a + (p.listing_price_cents ?? 0), 0);
  const readyValue = ready.reduce((a, p) => a + (p.listing_price_cents ?? 0), 0);
  const pendingPayoutForKlient = pending.reduce((a, p) => {
    const rate = subById.get(p.submission_id)?.commission_rate ?? 0.2;
    return a + (takeHomeCents(p.listing_price_cents ?? 0, rate) ?? 0);
  }, 0);
  const readyPayoutForKlient = ready.reduce((a, p) => {
    const rate = subById.get(p.submission_id)?.commission_rate ?? 0.2;
    return a + (takeHomeCents(p.listing_price_cents ?? 0, rate) ?? 0);
  }, 0);

  // Sticky KPI: Twój udział ze sprzedaży w bieżącym roku (prezentacyjna agregacja).
  const thisYear = new Date().getFullYear();
  const soldThisYear = solds.filter((p) => p.sold_at && new Date(p.sold_at).getFullYear() === thisYear);
  const yearTakeHome = soldThisYear.reduce((a, p) => {
    const rate = subById.get(p.submission_id)?.commission_rate ?? 0.2;
    return a + (takeHomeCents(p.listing_price_cents ?? 0, rate) ?? 0);
  }, 0);

  return (
    <>
      <PageHeader
        label="Panel · Twoje pieniądze"
        title="Nadchodzące wypłaty"
        sub="Po sprzedaży obowiązuje 14-dniowa karencja. Po jej upływie środki są gotowe do rozliczenia fakturą / UKS, a następnie wypłaty na konto."
      />

      {/* Sticky KPI — łącznie w tym roku */}
      <div className="sticky top-0 lg:top-[60px] z-10 mt-8 -mx-4 lg:-mx-10 px-4 lg:px-10 py-3 bg-bg/85 backdrop-blur-md border-b border-border-soft flex items-baseline justify-between gap-3">
        <span className="label">Łącznie w tym roku</span>
        <span className="num text-[18px] font-light tracking-[-0.02em]">
          {formatPLN(yearTakeHome, { decimals: false })}
          <span className="ml-2 text-[11px] text-text-mute">{soldThisYear.length} sprzedaży</span>
        </span>
      </div>

      {/* KPI: gotowe / karencja */}
      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <KpiCard
          label="Gotowe do rozliczenia"
          value={<span className="text-mint">{formatPLN(readyValue, { decimals: false })}</span>}
          mono
          sub={`Twój udział po prowizji: ${formatPLN(readyPayoutForKlient, { decimals: false })} · ${ready.length} pozycji`}
        >
          {ready.length > 0 && (
            <ButtonLink href="/panel/faktury" variant="ghost" size="sm">
              Wgraj fakturę / UKS <ArrowRight size={14} />
            </ButtonLink>
          )}
        </KpiCard>
        <KpiCard
          label="Oczekuje na zamknięcie · 14 dni"
          value={<span className="text-yellow">{formatPLN(pendingValue, { decimals: false })}</span>}
          mono
          sub={`Twój udział po prowizji: ${formatPLN(pendingPayoutForKlient, { decimals: false })} · ${pending.length} pozycji`}
        />
      </section>

      {/* Lista sprzedaży oczekujących i gotowych */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="label">Lista</div>
            <h2 className="mt-2 font-light text-[22px] tracking-[-0.02em]">Sprzedaże oczekujące i gotowe</h2>
          </div>
          <ButtonLink href="/panel/sprzedaze" variant="ghost" size="sm">
            Pełna historia sprzedaży
          </ButtonLink>
        </div>

        {solds.length === 0 ? (
          <EmptyState
            title="Brak sprzedaży"
            sub="Wypłaty pojawią się tu po pierwszej transakcji."
          />
        ) : (
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[minmax(220px,3fr)_110px_120px_120px_110px_150px] gap-3 px-4 h-11 label border-b border-border items-center">
              <div>Koszulka</div>
              <div>Sprzedano</div>
              <div>Kwota</div>
              <div>Twój udział</div>
              <div>Rozliczenie</div>
              <div>Status</div>
            </div>
            {[...ready, ...pending].map((p) => {
              const rate = subById.get(p.submission_id)?.commission_rate ?? 0.2;
              const takeHome = takeHomeCents(p.listing_price_cents ?? 0, rate) ?? 0;
              const isReady = p.sold_at && now - new Date(p.sold_at).getTime() >= FOURTEEN_D;
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-1 md:grid-cols-[minmax(220px,3fr)_110px_120px_120px_110px_150px] gap-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium truncate">{p.brand} {p.model}</div>
                      <div className="text-[11px] num text-text-mute truncate">
                        Sprzedano: {formatDate(p.sold_at)}
                      </div>
                      <div className="md:hidden text-[11px] num text-text-mute truncate">
                        Twój udział: <span className="text-mint">{formatPLN(takeHome, { decimals: false })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:block text-[12px] num text-text-soft">{formatDate(p.sold_at)}</div>
                  <div className="hidden md:block text-[13px] num">
                    {formatPLN(p.listing_price_cents ?? 0, { decimals: false })}
                  </div>
                  <div className="hidden md:block text-[13px] num text-mint">
                    {formatPLN(takeHome, { decimals: false })}
                  </div>
                  <div className={`hidden md:block text-[12px] num ${p.settlement_at ? "text-text-soft" : "text-text-faint"}`}>
                    {formatDate(p.settlement_at)}
                  </div>
                  <div className="flex md:block items-center">
                    <Pill variant={isReady ? "mint" : "yellow"}>
                      {isReady ? "Gotowe" : "Karencja 14d"}
                    </Pill>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
