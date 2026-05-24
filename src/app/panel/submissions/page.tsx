import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { SubmissionStatusPill } from "@/components/panel/StatusPill";
import { ArrowRight, ButtonLink } from "@/components/ui/Button";
import { formatDate, formatPLN } from "@/lib/format";
import type { Submission, Product } from "@/lib/types";

export default async function SubmissionsListPage() {
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

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="submissions"
      breadcrumb={[{ label: "Submissions" }]}
      cta={
        <ButtonLink href="/start" size="md">
          Nowa Submission <ArrowRight size={14} />
        </ButtonLink>
      }
    >
      <section>
        <div className="label">{submissions.length} aktywnych</div>
        <h1 className="mt-4 font-bold text-[28px] lg:text-[36px] leading-[1.02] tracking-[-0.04em]">
          Submissions <span className="text-text-soft">/ pakunki.</span>
        </h1>
        <p className="mt-4 text-[16px] text-text-soft max-w-[60ch]">
          Każda Submission = osobna Umowa Komisowa. Pełen przepływ od wysłania do odblokowania środków w Wallet.
        </p>
      </section>

      {submissions.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="mt-12 space-y-4">
          {submissions.map((s) => {
            const subProducts = products.filter((p) => p.submission_id === s.id);
            const value = subProducts.reduce(
              (acc, p) => acc + (p.listing_price_cents ?? p.expected_price_cents ?? 0),
              0,
            );
            return (
              <Link
                key={s.id}
                href={`/panel/submissions/${s.id}`}
                className="block card p-6 lg:p-7 hover:border-blue/40 transition-colors group"
              >
                <div className="grid grid-cols-12 gap-5 items-center">
                  <div className="col-span-12 md:col-span-3">
                    <div className="label">Submission</div>
                    <div className="mt-1.5 font-bold text-xl tracking-[-0.025em] num">{s.id}</div>
                    <div className="mt-1 text-[12px] text-text-mute num">{formatDate(s.created_at)}</div>
                  </div>

                  <div className="col-span-12 md:col-span-3">
                    <div className="label">Status</div>
                    <div className="mt-2"><SubmissionStatusPill status={s.status} /></div>
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <div className="label">Produkty · {subProducts.length}</div>
                    <div className="mt-1.5 text-[14px] text-text-soft truncate">
                      {subProducts.slice(0, 2).map((p) => `${p.brand} · ${p.model}`).join(", ")}
                      {subProducts.length > 2 && ` + ${subProducts.length - 2} więcej`}
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-2 text-right">
                    <div className="label">Wartość</div>
                    <div className="mt-1.5 font-bold text-xl tracking-[-0.025em] num">
                      {formatPLN(value, { decimals: false })}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </PanelShell>
  );
}

function EmptyState() {
  return (
    <section className="mt-12">
      <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[24px] p-12 lg:p-16 text-center">
        <div className="font-bold text-2xl lg:text-3xl tracking-[-0.025em]">
          Nie masz jeszcze żadnej Submission
        </div>
        <p className="mt-3 text-text-soft max-w-[44ch] mx-auto">
          Submission to umowa komisowa + zestaw produktów do sprzedaży. Wypełnienie zajmie ~6 minut.
        </p>
        <div className="mt-8">
          <ButtonLink href="/start" size="lg">
            Rozpocznij pierwszą <ArrowRight size={18} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
