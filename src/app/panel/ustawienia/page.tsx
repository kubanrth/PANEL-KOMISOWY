import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PasswordForm } from "./PasswordForm";

export default async function UstawieniaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="ustawienia"
      breadcrumb={[{ label: "Ustawienia" }]}
    >
      <section>
        <div className="label">Konto · {user.email}</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Ustawienia.
        </h1>
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-elev p-6">
          <div className="label">Hasło</div>
          <div className="mt-1 font-semibold text-lg tracking-[-0.025em]">Zmień hasło konta</div>
          <p className="mt-2 text-[13px] text-text-soft">Minimum 8 znaków.</p>
          <div className="mt-5">
            <PasswordForm />
          </div>
        </div>

        <div className="card-elev p-6">
          <div className="label">Twój opiekun konta</div>
          <div className="mt-1 font-semibold text-lg tracking-[-0.025em]">Wsparcie Kickback</div>
          <p className="mt-2 text-[13px] text-text-soft">
            Pytania, problemy z A&amp;QC, rozliczeniami albo wypłatami — pisz lub dzwoń.
          </p>
          <div className="mt-5 space-y-3 text-[14px]">
            <ContactLine label="Email" value="hello@kickback.pl" href="mailto:hello@kickback.pl" />
            <ContactLine label="Telefon" value="+48 22 000 00 00" href="tel:+48220000000" />
            <ContactLine label="WhatsApp" value="+48 22 000 00 00" href="https://wa.me/48220000000" />
          </div>
        </div>

        <div className="card-elev p-6">
          <div className="label">Preferencje powiadomień</div>
          <div className="mt-1 font-semibold text-lg tracking-[-0.025em]">Kanały kontaktu</div>
          <p className="mt-2 text-[13px] text-text-soft">
            Email i in-app są zawsze włączone. Pozostałe kanały — wkrótce.
          </p>
          <ul className="mt-5 space-y-2 text-[13px]">
            <PrefRow label="Email" enabled />
            <PrefRow label="In-app" enabled />
            <PrefRow label="SMS" />
            <PrefRow label="Push" />
          </ul>
        </div>

        <div className="card-elev p-6">
          <div className="label">Inne</div>
          <div className="mt-1 font-semibold text-lg tracking-[-0.025em]">Dane rozliczeniowe</div>
          <p className="mt-2 text-[13px] text-text-soft">
            Imię, adres, NIP, dane firmowe — edytuj w osobnej zakładce.
          </p>
          <div className="mt-5">
            <Link href="/panel/dane" className="text-[13px] text-blue hover:underline">
              Przejdź do danych rozliczeniowych →
            </Link>
          </div>
        </div>
      </section>
    </PanelShell>
  );
}

function ContactLine({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-mute text-[12px]">{label}</span>
      <a href={href} className="text-text hover:text-blue transition-colors num">{value}</a>
    </div>
  );
}

function PrefRow({ label, enabled = false }: { label: string; enabled?: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-text-soft">{label}</span>
      <span className={`pill ${enabled ? "pill-mint" : "pill-mute"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-mint" : "bg-text-mute"}`} />
        {enabled ? "Włączone" : "Wkrótce"}
      </span>
    </li>
  );
}
