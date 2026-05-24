import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate, takeHomeCents } from "@/lib/format";
import type { Product, Submission } from "@/lib/types";

export default async function WyplatyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
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

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="wyplaty"
      breadcrumb={[{ label: "Nadchodzące wypłaty" }]}
    >
      <section>
        <div className="label">Twoje pieniądze</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Nadchodzące wypłaty.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Po sprzedaży obowiązuje 14-dniowa karencja. Po jej upływie Funds są gotowe do rozliczenia
          fakturą / UKS, a następnie wypłaty na konto.
        </p>
      </section>

      {/* Dwa kafelki */}
      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-gradient-blue p-6 lg:p-8 rounded-[20px]">
          <div className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">
            Gotowe do rozliczenia
          </div>
          <div className="mt-2 font-bold text-4xl lg:text-5xl tracking-[-0.04em] num text-white">
            {formatPLN(readyValue, { decimals: false })}
          </div>
          <div className="mt-2 text-white/80 text-[13px] num">
            Twój udział po prowizji: {formatPLN(readyPayoutForKlient, { decimals: false })}
          </div>
          <div className="mt-1 text-white/70 text-[12px] num">{ready.length} pozycji</div>
          {ready.length > 0 && (
            <div className="mt-5">
              <Link
                href="/panel/faktury"
                className="inline-flex items-center gap-2 bg-white text-bg px-4 py-2 text-[13px] font-semibold rounded-[10px] hover:bg-white/90 transition-colors"
              >
                Wgraj fakturę / UKS <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>

        <div className="card-elev p-6 lg:p-8 rounded-[20px]">
          <div className="label">Oczekuje na zamknięcie · 14d</div>
          <div className="mt-2 font-bold text-4xl lg:text-5xl tracking-[-0.04em] num">
            {formatPLN(pendingValue, { decimals: false })}
          </div>
          <div className="mt-2 text-text-soft text-[13px] num">
            Twój udział po prowizji: <span className="text-mint">{formatPLN(pendingPayoutForKlient, { decimals: false })}</span>
          </div>
          <div className="mt-1 text-text-mute text-[12px] num">{pending.length} pozycji</div>
        </div>
      </section>

      {/* Lista (sprzedaże skopiowane) */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label">Lista</div>
            <h2 className="mt-1 font-semibold text-xl tracking-[-0.025em]">Sprzedaże oczekujące i gotowe</h2>
          </div>
          <ButtonLink href="/panel/sprzedaze" variant="ghost" size="sm">
            Pełna historia sprzedaży
          </ButtonLink>
        </div>

        {solds.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center text-text-soft text-[14px]">
            Brak sprzedaży — wypłaty pojawią się tu po pierwszej transakcji.
          </div>
        ) : (
          <div className="card overflow-hidden">
            {[...ready, ...pending].map((p) => {
              const rate = subById.get(p.submission_id)?.commission_rate ?? 0.2;
              const takeHome = takeHomeCents(p.listing_price_cents ?? 0, rate) ?? 0;
              const isReady = p.sold_at && now - new Date(p.sold_at).getTime() >= FOURTEEN_D;
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[minmax(220px,3fr)_120px_120px_120px_140px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{p.brand} · {p.model}</div>
                      <div className="text-[11px] text-text-mute num">
                        Sprzedano: {formatDate(p.sold_at)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold num">
                    {formatPLN(p.listing_price_cents ?? 0, { decimals: false })}
                  </div>
                  <div className="text-[13px] num text-mint">
                    {formatPLN(takeHome, { decimals: false })}
                  </div>
                  <div className="text-[12px] num text-text-soft">{formatDate(p.settlement_at)}</div>
                  <div>
                    <span className={`pill ${isReady ? "pill-mint" : "pill-amber"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isReady ? "bg-mint" : "bg-amber"}`} />
                      {isReady ? "Gotowe" : "Karencja 14d"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PanelShell>
  );
}
