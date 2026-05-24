import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { SubmissionStatusPill } from "@/components/panel/StatusPill";
import { formatPLN, formatDate, takeHomeCents } from "@/lib/format";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import type { Product, Submission } from "@/lib/types";

export default async function PanelPage() {
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

  // Get user's submissions + product count + sum
  const { data: submissionsRaw } = await supabase
    .from("submissions")
    .select("id, status, signed_at, signed_method, commission_rate, created_at")
    .order("created_at", { ascending: false });

  const submissions = (submissionsRaw ?? []) as Pick<
    Submission,
    "id" | "status" | "signed_at" | "signed_method" | "commission_rate" | "created_at"
  >[];

  const submissionIds = submissions.map((s) => s.id);
  const { data: productsRaw } = submissionIds.length
    ? await supabase
        .from("products")
        .select("submission_id, expected_price_cents, listing_price_cents, status, brand, model")
        .in("submission_id", submissionIds)
    : { data: [] as Pick<Product, "submission_id" | "expected_price_cents" | "listing_price_cents" | "status" | "brand" | "model">[] };

  const products = productsRaw ?? [];

  // KPIs
  const totalSubmissions = submissions.length;
  const totalProducts = products.length;
  const listed = products.filter((p) => p.status === "listed").length;
  const sold = products.filter((p) => p.status === "sold").length;

  const totalGross = products.reduce((acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0), 0);
  const totalTakeHome = products.reduce(
    (acc, p) => acc + (takeHomeCents(p.listing_price_cents ?? p.expected_price_cents ?? 0, 0.20) ?? 0),
    0,
  );

  const recent = submissions.slice(0, 4);

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      walletBalance={0}
      walletAvailable={0}
      active="dashboard"
    >
      {/* Hero */}
      <section>
        <div className="label">Panel klienta · {formatDate(new Date())}</div>
        <h1 className="mt-4 font-bold text-[32px] lg:text-[44px] leading-[1.02] tracking-[-0.04em]">
          Cześć, <span className="text-blue">{profile.first_name}</span>.
        </h1>
        {totalSubmissions === 0 && (
          <p className="mt-4 text-[17px] text-text-soft max-w-[60ch]">
            Nie masz jeszcze żadnej Oferty. Zacznij od pierwszej — zajmie to ~6 minut.
          </p>
        )}
        {totalSubmissions > 0 && (
          <p className="mt-4 text-[17px] text-text-soft max-w-[60ch]">
            Masz {totalSubmissions} {plural(totalSubmissions, ["Ofertę", "Oferty", "Ofert"])} z {totalProducts} {plural(totalProducts, ["produktem", "produktami", "produktami"])}.
          </p>
        )}
      </section>

      {/* KPIs */}
      <section className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Oferty" value={totalSubmissions} sub="łącznie" />
        <Kpi label="W sprzedaży" value={listed} sub={`z ${totalProducts} produktów`} />
        <Kpi label="Sprzedane" value={sold} sub="zakończone" />
        <Kpi
          label="Twój udział"
          value={null}
          custom={
            <div className="font-bold text-3xl tracking-[-0.04em] num text-mint">
              {formatPLN(totalTakeHome, { decimals: false })}
            </div>
          }
          sub="po prowizji 20%"
        />
      </section>

      {/* Empty state OR recent submissions */}
      {totalSubmissions === 0 ? (
        <section className="mt-12">
          <div className="card-gradient-purple p-10 lg:p-14 rounded-[24px] relative overflow-hidden">
            <div className="max-w-[520px]">
              <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">
                Pierwsza sprzedaż
              </div>
              <h2 className="mt-3 font-bold text-[26px] lg:text-[36px] leading-[1.02] tracking-[-0.04em] text-white">
                Powierz pierwszą rzecz.
              </h2>
              <p className="mt-4 text-white/85 text-[16px] leading-[1.6]">
                Wypełnij formularz Oferty, podpisz Umowę Komisową, dostaniesz etykietę nadania DPD. My weryfikujemy, sprzedajemy, wypłacamy.
              </p>
              <div className="mt-8">
                <Link
                  href="/start"
                  className="inline-flex items-center gap-2 bg-white text-bg px-7 py-4 text-[15px] font-semibold rounded-[12px] hover:bg-white/90 transition-colors"
                >
                  Wypełnij formularz
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="label">Ostatnie</div>
              <h2 className="mt-2 font-bold text-2xl lg:text-3xl tracking-[-0.025em]">Twoje Oferty</h2>
            </div>
            <Link href="/panel/submissions" className="text-[14px] text-text-soft hover:text-text inline-flex items-center gap-2">
              Zobacz wszystkie <ArrowRight size={14} />
            </Link>
          </div>

          <div className="card overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 label border-b border-border-soft">
              <div className="col-span-3">Oferta</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-2">Data</div>
              <div className="col-span-2 text-right">Liczba</div>
              <div className="col-span-2 text-right">Wartość</div>
            </div>
            {recent.map((s) => {
              const subProducts = products.filter((p) => p.submission_id === s.id);
              const value = subProducts.reduce(
                (acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0),
                0,
              );
              return (
                <Link
                  key={s.id}
                  href={`/panel/submissions/${s.id}`}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <div className="col-span-3 num text-[14px]">{s.id}</div>
                  <div className="col-span-3"><SubmissionStatusPill status={s.status} /></div>
                  <div className="col-span-2 text-[13px] text-text-mute num">{formatDate(s.created_at)}</div>
                  <div className="col-span-2 text-right text-[13px] num">
                    {subProducts.length} {plural(subProducts.length, ["produkt", "produkty", "produktów"])}
                  </div>
                  <div className="col-span-2 text-right font-semibold text-[15px] num">
                    {formatPLN(value, { decimals: false })}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Demo banner */}
      <div className="mt-12 inline-flex items-center gap-3 px-5 py-4 rounded-[16px] bg-amber/10 border border-amber/30 text-amber">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
        <span className="text-[14px]">Tryb demo — bez integracji Autopay/PZ/banku DPD. Oferty zapisywane w DB, pieniądze testowe.</span>
      </div>
    </PanelShell>
  );
}

function Kpi({
  label, value, custom, sub,
}: {
  label: string;
  value: number | null;
  custom?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="card p-6">
      <div className="label">{label}</div>
      {custom ?? (
        <div className="mt-3 font-bold text-3xl tracking-[-0.04em] num">
          {value}
        </div>
      )}
      {sub && <div className="mt-2 text-[12px] text-text-mute">{sub}</div>}
    </div>
  );
}

function plural(n: number, [one, few, many]: [string, string, string]): string {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}
