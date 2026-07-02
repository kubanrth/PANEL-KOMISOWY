import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmissionStatusPill } from "@/components/panel/StatusPill";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type { Submission, Product } from "@/lib/types";

/**
 * Przyjęcia magazynowe = lista submissions w stanie podpisanym/dostarczonym.
 * Każda paczka generuje "PZ-{submission_id}" dokument przyjęcia z agregatami.
 * Prezentacja: pionowy timeline per paczka (gramatyka E1/C8 z karty produktu).
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
      <PageHeader
        label="Dokumenty PZ"
        title="Przyjęcia magazynowe"
        sub="Każda Twoja paczka wysłana do Kickback generuje dokument PZ (Przyjęcie Magazynowe). Sprawdź historię, wartości i kliknij PZ żeby zobaczyć pozycje."
      />

      {subs.length === 0 ? (
        <section className="mt-8">
          <EmptyState
            title="Brak przyjęć"
            sub="Wyślij pierwszą Ofertę — po przyjęciu paczki do magazynu zobaczysz tu dokument PZ."
            action={
              <ButtonLink href="/start" size="md">
                Nowa Oferta <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </section>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard label="Dokumentów PZ" value={subs.length} />
            <KpiCard label="Pozycji łącznie" value={totalCount} />
            <KpiCard label="Łączna wartość" value={formatPLN(totalValue, { decimals: false })} mono />
          </section>

          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {subs.map((s) => {
              const agg = aggBySubmission.get(s.id) ?? { count: 0, value: 0 };
              return (
                <div key={s.id} className="card p-6">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium num">PZ-{s.id.replace("SUB-", "")}</div>
                      <div className="mt-1 text-[11px] num text-text-mute">
                        {formatDate(s.signed_at ?? s.created_at)} · {agg.count} poz. · {formatPLN(agg.value, { decimals: false })}
                      </div>
                    </div>
                    <SubmissionStatusPill status={s.status} />
                  </div>

                  <div className="mt-5">
                    <PzTimeline status={s.status} signedAt={s.signed_at ?? s.created_at} />
                  </div>

                  <div className="mt-5 pt-4 border-t border-border-soft">
                    <Link
                      href={`/panel/submissions/${s.id}`}
                      className="inline-flex items-center gap-1.5 text-[13px] text-text-soft hover:text-lime transition-colors"
                    >
                      Sprawdź dokument <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </PanelShell>
  );
}

/* Pionowy timeline PZ: lime dot 11px done, hollow pending, linia bg-border.
   Jedyny znany timestamp = signed_at (krok 1); kolejne kroki bez dat. */
function PzTimeline({ status, signedAt }: { status: Submission["status"]; signedAt: string }) {
  const doneCount =
    status === "signed" ? 1 : status === "in_transit" ? 2 : status === "aqc" ? 3 : 4;
  const steps: Array<{ label: string; at: string | null }> = [
    { label: "Oferta podpisana", at: signedAt },
    { label: "Paczka w transporcie", at: null },
    { label: "Przyjęta do magazynu — A&QC", at: null },
    { label: "Wystawiona w sprzedaży", at: null },
  ];
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const done = i < doneCount;
        const last = i === steps.length - 1;
        return (
          <li key={s.label} className="relative pl-6 pb-4 last:pb-0">
            {!last && (
              <span className="absolute left-[5px] top-4 bottom-0 w-px bg-border" aria-hidden />
            )}
            <span
              className={`absolute left-0 top-1 h-[11px] w-[11px] rounded-full ${
                done ? "bg-lime" : "border border-border bg-transparent"
              }`}
              aria-hidden
            />
            <div className={`text-[13px] ${done ? "" : "text-text-mute"}`}>{s.label}</div>
            {done && s.at && (
              <div className="text-[11px] num text-text-mute mt-0.5">{formatDate(s.at)}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
