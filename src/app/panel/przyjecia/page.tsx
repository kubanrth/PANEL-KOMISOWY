import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import { SUBMISSION_STATUS_LABEL, type Submission, type Product } from "@/lib/types";

/**
 * Przyjęcia magazynowe = lista submissions w stanie podpisanym/dostarczonym.
 * Każda paczka generuje "PZ-{submission_id}" dokument przyjęcia z agregatami.
 */
export default async function PrzyjeciaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: subsRaw } = await supabase
    .from("submissions")
    .select("*")
    .in("status", ["signed", "in_transit", "aqc", "listed", "sold", "payout"])
    .order("signed_at", { ascending: false, nullsFirst: false });
  const subs = (subsRaw ?? []) as Submission[];

  const ids = subs.map((s) => s.id);
  const { data: prodsRaw } = ids.length
    ? await supabase
        .from("products")
        .select("submission_id, expected_price_cents, listing_price_cents")
        .in("submission_id", ids)
    : { data: [] as Pick<Product, "submission_id" | "expected_price_cents" | "listing_price_cents">[] };
  const prods = prodsRaw ?? [];

  const aggBySubmission = new Map<string, { count: number; value: number }>();
  for (const p of prods) {
    const cur = aggBySubmission.get(p.submission_id) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += p.listing_price_cents ?? p.expected_price_cents ?? 0;
    aggBySubmission.set(p.submission_id, cur);
  }

  const totalValue = Array.from(aggBySubmission.values()).reduce((a, x) => a + x.value, 0);
  const totalCount = Array.from(aggBySubmission.values()).reduce((a, x) => a + x.count, 0);

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="przyjecia"
      breadcrumb={[{ label: "Przyjęcia magazynowe" }]}
    >
      <section>
        <div className="label">Dokumenty PZ</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Przyjęcia magazynowe.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Każda Twoja paczka wysłana do Kickback generuje dokument PZ (Przyjęcie Magazynowe).
          Sprawdź historię, wartości i kliknij PZ żeby zobaczyć pozycje.
        </p>
      </section>

      {subs.length === 0 ? (
        <Empty />
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi label="Dokumentów PZ" value={subs.length.toString()} />
            <Kpi label="Pozycji łącznie" value={totalCount.toString()} />
            <Kpi label="Łączna wartość" value={formatPLN(totalValue, { decimals: false })} />
          </section>

          <section className="mt-8">
            <div className="card table-scroll">
              <div className="hidden md:grid grid-cols-[160px_120px_140px_80px_140px_120px] gap-3 px-4 py-3 label border-b border-border-soft">
                <div>Numer PZ</div>
                <div>Data przyjęcia</div>
                <div>Wartość</div>
                <div>Pozycji</div>
                <div>Status</div>
                <div className="text-right">Akcje</div>
              </div>
              {subs.map((s) => {
                const agg = aggBySubmission.get(s.id) ?? { count: 0, value: 0 };
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[160px_120px_140px_80px_140px_120px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/30"
                  >
                    <div className="text-[13px] num font-medium">PZ-{s.id.replace("SUB-", "")}</div>
                    <div className="text-[12px] num text-text-soft">{formatDate(s.signed_at ?? s.created_at)}</div>
                    <div className="text-[13px] font-semibold num">{formatPLN(agg.value, { decimals: false })}</div>
                    <div className="text-[12px] num text-text-soft">{agg.count}</div>
                    <div>
                      <span className="pill pill-mute">{SUBMISSION_STATUS_LABEL[s.status]}</span>
                    </div>
                    <div className="text-right">
                      <Link
                        href={`/panel/submissions/${s.id}`}
                        className="text-[12px] text-blue hover:underline"
                      >
                        Sprawdź dokument →
                      </Link>
                    </div>
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-2 font-bold text-2xl tracking-[-0.035em] num">{value}</div>
    </div>
  );
}

function Empty() {
  return (
    <section className="mt-10">
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center">
        <div className="font-bold text-xl tracking-[-0.025em]">Brak przyjęć</div>
        <p className="mt-2 text-text-soft text-[14px]">
          Wyślij pierwszą Ofertę — po przyjęciu paczki do magazynu zobaczysz tu dokument PZ.
        </p>
        <div className="mt-6">
          <ButtonLink href="/start" size="md">
            Nowa Oferta <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
