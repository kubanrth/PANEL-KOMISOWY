import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmissionStatusPill } from "@/components/panel/StatusPill";
import { ArrowRight, ButtonLink } from "@/components/ui/Button";
import { formatDate, formatPLN } from "@/lib/format";
import type { Submission, SubmissionStatus, Product } from "@/lib/types";

/* Oferty (submissions) — redesign: taby-chipy statusów z licznikami,
   tabela numer · data · pozycje · wartość · status · chevron. */

type TabKey = "all" | "progress" | "listed" | "done" | "closed";

const TABS: Array<{ v: TabKey; l: string; statuses: SubmissionStatus[] | null }> = [
  { v: "all", l: "Wszystkie", statuses: null },
  { v: "progress", l: "W toku", statuses: ["draft", "signed", "in_transit", "aqc"] },
  { v: "listed", l: "W sprzedaży", statuses: ["listed"] },
  { v: "done", l: "Zakończone", statuses: ["sold", "payout"] },
  { v: "closed", l: "Zamknięte", statuses: ["withdrawn", "returned"] },
];

export default async function SubmissionsListPage(props: {
  searchParams: Promise<{ status?: TabKey }>;
}) {
  const sp = await props.searchParams;
  const tab: TabKey = TABS.some((t) => t.v === sp.status) ? sp.status! : "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: submissionsRaw } = await supabase
    .from("submissions")
    .select("id, status, signed_at, signed_method, commission_rate, created_at")
    .order("created_at", { ascending: false });

  const submissions = (submissionsRaw ?? []) as Submission[];

  const submissionIds = submissions.map((s) => s.id);
  const { data: productsRaw } = submissionIds.length
    ? await supabase
        .from("products")
        .select("submission_id, expected_price_cents, listing_price_cents, status, brand, model")
        .in("submission_id", submissionIds)
    : { data: [] as Array<Pick<Product, "submission_id" | "expected_price_cents" | "listing_price_cents" | "status" | "brand" | "model">> };

  const products = productsRaw ?? [];

  const countFor = (t: (typeof TABS)[number]) =>
    t.statuses === null
      ? submissions.length
      : submissions.filter((s) => t.statuses!.includes(s.status)).length;

  const activeTab = TABS.find((t) => t.v === tab)!;
  const visible =
    activeTab.statuses === null
      ? submissions
      : submissions.filter((s) => activeTab.statuses!.includes(s.status));

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="submissions"
      breadcrumb={[{ label: "Submissions" }]}
    >
      <PageHeader
        label={`${submissions.length} ofert · umowy komisowe`}
        title="Oferty"
        sub="Każda oferta to osobna Umowa Komisowa — pełen przepływ od wysłania pakunku do odblokowania środków w Wallet."
        action={
          <ButtonLink href="/start" size="md">
            Nowa oferta <ArrowRight size={14} />
          </ButtonLink>
        }
      />

      {submissions.length === 0 ? (
        <section className="mt-8">
          <EmptyState
            title="Nie masz jeszcze żadnej oferty"
            sub="Oferta to umowa komisowa + zestaw produktów do sprzedaży. Wypełnienie zajmie ~6 minut."
            action={
              <ButtonLink href="/start" size="md">
                Rozpocznij pierwszą <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </section>
      ) : (
        <>
          {/* Taby statusów z licznikami */}
          <section className="mt-8 flex flex-wrap items-center gap-1.5">
            {TABS.map((t) => {
              const active = tab === t.v;
              const count = countFor(t);
              const href = t.v === "all" ? "/panel/submissions" : `/panel/submissions?status=${t.v}`;
              return (
                <Link
                  key={t.v}
                  href={href}
                  className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium border transition-colors ${
                    active
                      ? "border-lime/40 bg-lime/10 text-lime"
                      : "border-border bg-surface text-text-soft hover:text-text hover:bg-surface-2"
                  }`}
                >
                  {t.l}
                  <span className={`text-[11px] num ${active ? "text-lime/80" : "text-text-mute"}`}>
                    {count}
                  </span>
                </Link>
              );
            })}
          </section>

          {/* Tabela ofert */}
          <section className="mt-6">
            {visible.length === 0 ? (
              <EmptyState
                title={`Brak ofert: ${activeTab.l.toLowerCase()}`}
                sub="Zmień filtr statusu albo dodaj nową ofertę."
                action={
                  <ButtonLink href="/start" variant="ghost" size="sm">
                    Nowa oferta <ArrowRight size={14} />
                  </ButtonLink>
                }
              />
            ) : (
              <div className="card table-scroll">
                <div className="hidden md:grid grid-cols-[minmax(150px,1.4fr)_110px_90px_150px_minmax(150px,1fr)_36px] gap-3 px-4 h-11 label border-b border-border items-center">
                  <div>Numer</div>
                  <div>Data</div>
                  <div>Pozycje</div>
                  <div>Wartość szac.</div>
                  <div>Status</div>
                  <div />
                </div>

                {visible.map((s) => {
                  const subProducts = products.filter((p) => p.submission_id === s.id);
                  const value = subProducts.reduce(
                    (acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0),
                    0,
                  );
                  return (
                    <Link
                      key={s.id}
                      href={`/panel/submissions/${s.id}`}
                      className="grid grid-cols-2 md:grid-cols-[minmax(150px,1.4fr)_110px_90px_150px_minmax(150px,1fr)_36px] gap-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium num truncate group-hover:text-lime transition-colors">
                          {s.id}
                        </div>
                        <div className="md:hidden mt-0.5 text-[11px] num text-text-mute">
                          {formatDate(s.created_at)} · {subProducts.length} poz.
                        </div>
                      </div>
                      <div className="hidden md:block text-[12px] num text-text-soft">
                        {formatDate(s.created_at)}
                      </div>
                      <div className="hidden md:block text-[12px] num text-text-soft">
                        {subProducts.length}
                      </div>
                      <div className="hidden md:block text-[13px] num">
                        {formatPLN(value, { decimals: false })}
                      </div>
                      <div className="flex items-center justify-end md:justify-start gap-2">
                        <SubmissionStatusPill status={s.status} />
                      </div>
                      <div className="hidden md:flex justify-end text-text-faint group-hover:text-text-soft transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </PanelShell>
  );
}
