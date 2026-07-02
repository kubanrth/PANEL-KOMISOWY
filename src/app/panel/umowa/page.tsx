import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/format";
import { UmowaSign } from "./UmowaSign";

export default async function UmowaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at, master_agreement_signed_at, master_agreement_signed_method, master_agreement_version")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) redirect("/onboarding");

  const accountType = (profile.account_type ?? "individual") as "individual" | "business";
  const signed = Boolean(profile.master_agreement_signed_at);

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="umowa"
      breadcrumb={[{ label: "Umowa Komisowa" }]}
    >
      <PageHeader
        label="Dokument główny"
        title="Umowa Komisowa"
        sub="Podpisujesz raz. Obowiązuje dla wszystkich Twoich kolejnych Ofert (paczek) — nie podpisujesz nowej umowy przy każdej dostawie towaru."
      />

      {signed ? (
        <section className="mt-12">
          <div className="card p-7 lg:p-9">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <span className="h-12 w-12 rounded-full bg-mint/15 border border-mint/30 flex items-center justify-center text-mint">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </span>
                <div>
                  <div className="font-semibold text-xl tracking-[-0.025em]">Umowa podpisana</div>
                  <div className="text-[13px] text-text-mute mt-1">
                    {formatDateTime(profile.master_agreement_signed_at)} ·{" "}
                    {profile.master_agreement_signed_method === "autopay" ? "Autopay" : "Profil zaufany"} ·
                    wersja {profile.master_agreement_version ?? "4.2"}
                  </div>
                </div>
              </div>
              <ButtonLink href="/start" size="md">
                Nowa Oferta <ArrowRight size={14} />
              </ButtonLink>
            </div>
          </div>

          <div className="mt-8 card p-6 lg:p-8">
            <div className="label">Treść umowy</div>
            <div className="mt-2 font-semibold text-xl tracking-[-0.025em]">
              Umowa Sprzedaży w Formie Konsygnacji · v{profile.master_agreement_version ?? "4.2"}
            </div>

            <div className="mt-5 border-t border-border-soft pt-4 text-[13px] leading-[1.7] text-text-soft space-y-3">
              <p><span className="text-text font-semibold">§1.</span> Komitent powierza Komisantowi (Kickback sp. z o. o.) rzeczy ruchome, których specyfikacja każdorazowo stanowi załącznik (Oferta / paczka), w celu ich sprzedaży.</p>
              <p><span className="text-text font-semibold">§2.</span> Niniejsza umowa zawierana jest jednorazowo i obowiązuje dla wszystkich kolejnych Ofert (paczek) Komitenta.</p>
              <p><span className="text-text font-semibold">§3.</span> Własność rzeczy pozostaje przy Komitencie do momentu podpisania Umowy Kupna-Sprzedaży lub wystawienia FV po sprzedaży.</p>
              <p><span className="text-text font-semibold">§4.</span> 12-punktowy audyt A&amp;QC w terminie do 5 dni roboczych od dostarczenia paczki.</p>
              <p><span className="text-text font-semibold">§5.</span> Dla każdej rzeczy Komitent wybiera model rozliczenia: prowizja 20% albo stała wypłata.</p>
              <p><span className="text-text font-semibold">§6.</span> Komitent zachowuje prawo akceptacji wyceny, redukcji ceny oraz wycofania rzeczy.</p>
              <p><span className="text-text font-semibold">§7.</span> Środki ze sprzedaży deponowane są w Wallet. Wypłata odbywa się na pisemną dyspozycję Komitenta.</p>
            </div>

            <div className="mt-6 text-[12px] text-text-mute">
              Potrzebujesz aneksu lub chcesz odnowić wersję umowy?{" "}
              <Link href="mailto:hello@kickback.pl" className="text-text underline decoration-text-faint underline-offset-4 hover:decoration-lime">
                Napisz do nas
              </Link>
              .
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-12">
          <div className="card-bare bg-yellow/8 border border-yellow/25 rounded-[16px] p-5 mb-8 flex gap-3 items-start">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <div>
              <div className="font-semibold text-[15px]">Wymagany podpis umowy</div>
              <p className="mt-1 text-[13px] text-text-soft">
                Zanim wyślesz pierwszą Ofertę, podpisz Umowę Komisową. Robisz to raz —
                wszystkie kolejne paczki są obsługiwane bez dodatkowego podpisu.
              </p>
            </div>
          </div>

          <UmowaSign accountType={accountType} />
        </section>
      )}
    </PanelShell>
  );
}
