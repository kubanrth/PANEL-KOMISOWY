import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { DaneForm } from "./DaneForm";

export default async function DanePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at, phone, pesel_or_id, company_name, nip, vat_id, address_line, postal_code, city")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="dane"
      breadcrumb={[{ label: "Dane rozliczeniowe" }]}
    >
      <PageHeader
        label={`Konto: ${profile.account_type === "individual" ? "Indywidualne" : "Biznesowe"}`}
        title="Dane rozliczeniowe"
        sub="Te dane trafiają na umowy komisowe, UKS i faktury. Trzymaj je aktualne — zmiana w trakcie aktywnej sprzedaży nie wpływa na już-wystawione dokumenty."
      />

      <section className="mt-8 max-w-[800px]">
        <DaneForm initial={profile} />
      </section>
    </PanelShell>
  );
}
