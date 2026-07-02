import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/format";
import type { AppDocument } from "@/lib/types";

export default async function UksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: docsRaw } = await supabase
    .from("documents")
    .select("*")
    .eq("type", "umowa_ks")
    .order("created_at", { ascending: false });
  const docs = (docsRaw ?? []) as AppDocument[];

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="uks"
      breadcrumb={[{ label: "UKS" }]}
    >
      <PageHeader
        label={`${docs.length} dokumentów · Umowy Kupna-Sprzedaży`}
        title="UKS"
        sub="Wszystkie zeskanowane UKS, na podstawie których rozliczane są Twoje sprzedaże (dla kont indywidualnych). Pobierz dokument do księgowości."
      />

      {docs.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Brak UKS"
            sub="UKS są generowane przy rozliczaniu sprzedaży. Sprawdź sekcję Faktury i rozliczenia."
            action={
              <ButtonLink href="/panel/faktury" size="md">
                Faktury i rozliczenia <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <section className="mt-8">
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[180px_minmax(220px,3fr)_140px_140px_120px] gap-3 px-4 h-11 items-center label border-b border-border">
              <div>Dokument</div>
              <div>Powiązanie</div>
              <div>Podpisano</div>
              <div>Status</div>
              <div className="text-right">Akcja</div>
            </div>
            {docs.map((d) => (
              <div
                key={d.id}
                className="grid grid-cols-[180px_minmax(220px,3fr)_140px_140px_120px] gap-3 px-4 py-3.5 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
              >
                <div className="text-[13px] num font-medium">UKS-{d.id.slice(0, 8).toUpperCase()}</div>
                <div className="text-[12px] text-text-soft">
                  {d.submission_id ? (
                    <Link href={`/panel/submissions/${d.submission_id}`} className="text-lime hover:underline num">
                      {d.submission_id}
                    </Link>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="text-[12px] num text-text-soft">{formatDate(d.signed_at ?? d.created_at)}</div>
                <div>
                  {d.signed_at ? (
                    <span className="pill pill-mint">
                      <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                      Podpisane
                    </span>
                  ) : (
                    <span className="pill pill-mute">Oczekuje</span>
                  )}
                </div>
                <div className="text-right">
                  {d.file_url ? (
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="text-[12px] text-lime hover:underline">
                      Pobierz PDF →
                    </a>
                  ) : (
                    <span className="text-[11px] text-text-faint">brak pliku</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </PanelShell>
  );
}
