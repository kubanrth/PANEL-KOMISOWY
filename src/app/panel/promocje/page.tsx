import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/panel/StatusPill";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import { vatLabel } from "@/lib/types";
import type { Product } from "@/lib/types";

/* Twoje promocje — redesign: hero banner (card-gradient-dark + glow-blob)
   z największą obniżką + lista mniejszych bannerów z pigułką AKTYWNA. */

export default async function PromocjePage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: productsRaw } = await supabase
    .from("products")
    .select("*")
    .in("status", ["listed", "offer"])
    .order("published_at", { ascending: false, nullsFirst: false });

  const all = (productsRaw ?? []) as Product[];
  // Promocja = listing_price < expected_price (klient zaakceptował redukcję
  // albo admin obniżył).
  const promoted = all.filter(
    (p) =>
      p.listing_price_cents != null &&
      p.expected_price_cents != null &&
      p.listing_price_cents < p.expected_price_cents,
  );

  const totalDiscount = promoted.reduce(
    (acc, p) => acc + ((p.expected_price_cents ?? 0) - (p.listing_price_cents ?? 0)),
    0,
  );

  const avgPct = promoted.length
    ? `${Math.round(
        promoted.reduce(
          (a, p) =>
            a +
            (((p.expected_price_cents ?? 0) - (p.listing_price_cents ?? 0)) /
              (p.expected_price_cents ?? 1)) *
              100,
          0,
        ) / promoted.length,
      )}%`
    : "—";

  // Hero = największa procentowa obniżka; reszta jako mniejsze bannery.
  const sorted = [...promoted].sort((a, b) => promoPct(b) - promoPct(a));
  const hero = sorted[0];
  const rest = sorted.slice(1);

  return (
    <>
      <PageHeader
        label={`${promoted.length} aktywnych promocji`}
        title="Twoje promocje"
        sub="Aktywne pozycje z ceną poniżej ceny przyjęcia. Sprawdź, na ile zredukowałeś, by przyspieszyć rotację."
      />

      {promoted.length === 0 ? (
        <section className="mt-8">
          <EmptyState
            title="Brak aktywnych promocji"
            sub="Twoje pozycje są wystawione w pełnej cenie. Promocje pojawią się, gdy zredukujesz ceny w magazynie."
            action={
              <ButtonLink href="/panel/magazyn" size="md">
                Idź do magazynu <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </section>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label="Aktywne promocje" value={promoted.length} />
            <KpiCard label="Łączna obniżka" value={formatPLN(totalDiscount, { decimals: false })} mono />
            <KpiCard label="Średnia obniżka" value={avgPct} mono />
          </section>

          {/* Hero — największa obniżka */}
          {hero && (
            <section className="mt-6">
              <div className="card-gradient-dark p-8 lg:p-10 relative overflow-hidden">
                <div className="glow-blob" aria-hidden />
                <div className="relative">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Pill variant="lime">Aktywna</Pill>
                    <span className="label !text-mint/80">Największa obniżka · −{promoPct(hero)}%</span>
                  </div>
                  <div className="mt-5 flex items-center gap-4">
                    <ProductThumb photos={hero.photos} brand={hero.brand} size="lg" />
                    <div className="min-w-0">
                      <h2 className="font-light text-[24px] lg:text-[32px] leading-[1.08] tracking-[-0.02em]">
                        {hero.brand} {hero.model}
                      </h2>
                      <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                        <span className="text-[22px] lg:text-[26px] num text-mint">
                          {formatPLN(hero.listing_price_cents ?? 0, { decimals: false })}
                        </span>
                        <span className="text-[14px] num text-text-mute line-through">
                          {formatPLN(hero.expected_price_cents ?? 0, { decimals: false })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-text-soft">
                    <span>Rozm. <span className="num text-text">{hero.size ?? "—"}</span></span>
                    <span>VAT <span className="num text-text">{vatLabel(hero.vat_rate)}</span></span>
                    <span>Publikacja <span className="num text-text">{formatDate(hero.published_at ?? hero.created_at)}</span></span>
                    <span>W promocji <span className="num text-text">{daysSince(hero)} d</span></span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Pozostałe promocje — mniejsze bannery */}
          {rest.length > 0 && (
            <section className="mt-6 space-y-2">
              {rest.map((p) => (
                <div key={p.id} className="card p-4 flex items-center gap-4 flex-wrap hover:bg-surface-2/40 transition-colors">
                  <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium truncate">{p.brand} {p.model}</div>
                    <div className="mt-0.5 text-[11px] text-text-mute num">
                      −{promoPct(p)}% · rozm. {p.size ?? "—"} · VAT {vatLabel(p.vat_rate)}
                    </div>
                  </div>
                  <div className="hidden md:block text-[11px] num text-text-mute">
                    {formatDate(p.published_at ?? p.created_at)} · {daysSince(p)} d
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] num text-mint">
                      {formatPLN(p.listing_price_cents ?? 0, { decimals: false })}
                    </div>
                    <div className="text-[11px] num text-text-mute line-through">
                      {formatPLN(p.expected_price_cents ?? 0, { decimals: false })}
                    </div>
                  </div>
                  <Pill variant="lime">Aktywna</Pill>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}

function promoPct(p: Product): number {
  const baseline = p.expected_price_cents ?? 0;
  const promo = p.listing_price_cents ?? 0;
  return baseline > 0 ? Math.round(((baseline - promo) / baseline) * 100) : 0;
}

function daysSince(p: Product): number {
  const since = p.published_at ?? p.created_at;
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000));
}
