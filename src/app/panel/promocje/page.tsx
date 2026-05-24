import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import { vatLabel } from "@/lib/types";
import type { Product } from "@/lib/types";

export default async function PromocjePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
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

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="promocje"
      breadcrumb={[{ label: "Twoje promocje" }]}
    >
      <section>
        <div className="label">{promoted.length} aktywnych promocji</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Twoje promocje.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Aktywne pozycje z ceną poniżej ceny przyjęcia. Sprawdź, na ile zredukowałeś, by przyspieszyć rotację.
        </p>
      </section>

      {promoted.length === 0 ? (
        <Empty />
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi label="Aktywne promocje" value={promoted.length.toString()} />
            <Kpi
              label="Łączna obniżka"
              value={formatPLN(totalDiscount, { decimals: false })}
              accent="text-amber"
            />
            <Kpi
              label="Średnia obniżka"
              value={
                promoted.length
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
                  : "—"
              }
            />
          </section>

          <section className="mt-8">
            <div className="card table-scroll">
              <div className="hidden md:grid grid-cols-[minmax(220px,3fr)_60px_120px_120px_70px_110px_70px] gap-3 px-4 py-3 label border-b border-border-soft">
                <div>Produkt</div>
                <div>Rozm.</div>
                <div>Cena bazowa</div>
                <div>Cena promo</div>
                <div>VAT</div>
                <div>Publikacja</div>
                <div>Dni</div>
              </div>
              {promoted.map((p) => {
                const since = p.published_at ?? p.created_at;
                const days = Math.max(
                  0,
                  Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000),
                );
                const baseline = p.expected_price_cents ?? 0;
                const promo = p.listing_price_cents ?? 0;
                const pct = baseline > 0 ? Math.round(((baseline - promo) / baseline) * 100) : 0;
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-[minmax(220px,3fr)_60px_120px_120px_70px_110px_70px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">{p.brand} · {p.model}</div>
                        <div className="text-[11px] text-text-mute">−{pct}%</div>
                      </div>
                    </div>
                    <div className="text-[12px] num text-text-soft">{p.size ?? "—"}</div>
                    <div className="text-[12px] num text-text-mute line-through">
                      {formatPLN(baseline, { decimals: false })}
                    </div>
                    <div className="text-[13px] font-semibold num text-amber">
                      {formatPLN(promo, { decimals: false })}
                    </div>
                    <div className="text-[12px] num text-text-soft">{vatLabel(p.vat_rate)}</div>
                    <div className="text-[12px] num text-text-soft">{formatDate(p.published_at ?? p.created_at)}</div>
                    <div className="text-[12px] num text-text-soft">{days} d</div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </PanelShell>
  );
}

function Kpi({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mt-2 font-bold text-2xl tracking-[-0.035em] num ${accent}`}>{value}</div>
    </div>
  );
}

function Empty() {
  return (
    <section className="mt-10">
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center">
        <div className="font-bold text-xl tracking-[-0.025em]">Brak aktywnych promocji</div>
        <p className="mt-2 text-text-soft text-[14px]">
          Twoje pozycje są wystawione w pełnej cenie. Promocje pojawią się gdy zredukujesz ceny w magazynie.
        </p>
        <div className="mt-6">
          <ButtonLink href="/panel/magazyn" size="md">
            Idź do magazynu <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
