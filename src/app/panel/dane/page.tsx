import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { DaneForm } from "./DaneForm";

export default async function DanePage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at, phone, pesel_or_id, company_name, nip, vat_id, address_line, postal_code, city")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <>
      <PageHeader
        label={`Konto: ${profile.account_type === "individual" ? "Indywidualne" : "Biznesowe"}`}
        title="Dane rozliczeniowe"
        sub="Te dane trafiają na umowy komisowe, UKS i faktury. Trzymaj je aktualne — zmiana w trakcie aktywnej sprzedaży nie wpływa na już-wystawione dokumenty."
      />

      <section className="mt-8 max-w-[800px]">
        <DaneForm initial={profile} />
      </section>
    </>
  );
}
