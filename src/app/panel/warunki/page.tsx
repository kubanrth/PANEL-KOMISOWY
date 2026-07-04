import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";

type Tile = { title: string; value: string; sub: string; accent?: string };

export default async function WarunkiPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at, master_agreement_signed_at, master_agreement_version")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const isBusiness = profile.account_type === "business";

  const tiles: Tile[] = [
    { title: "Rozliczenie sprzedaży", value: "14 dni", sub: "Karencja od daty sprzedaży", accent: "text-mint" },
    {
      title: "Podstawa rozliczenia",
      value: isBusiness ? "Faktura VAT" : "UKS",
      sub: isBusiness ? "Wystawiasz fakturę sprzedażową" : "Umowa Kupna-Sprzedaży (skan)",
    },
    { title: "Opłata wycofania", value: "5%", sub: "Wycofanie <60 dni · max 500 zł", accent: "text-amber" },
    { title: "Opłaty marketingowe", value: "Nie dotyczy", sub: "Brak dodatkowych kosztów dla komisanta" },
    { title: "Prowizja Kickback", value: "20%", sub: "Lub stała wypłata (Grail Point)" },
    { title: "Czas A&QC", value: "do 5 dni rob.", sub: "Od dostarczenia paczki" },
  ];

  return (
    <>
      <PageHeader
        label="Twoje aktualne warunki"
        title="Warunki komisowe"
        sub={`Reguły współpracy obowiązujące dla Twojego konta na podstawie podpisanej Umowy Komisowej${profile.master_agreement_version ? ` v${profile.master_agreement_version}` : ""}.`}
      />

      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <div key={t.title} className="card p-5">
            <div className="label">{t.title}</div>
            <div className={`mt-2 font-light text-[26px] tracking-[-0.02em] num ${t.accent ?? ""}`}>{t.value}</div>
            <div className="mt-1.5 text-[12px] text-text-mute">{t.sub}</div>
          </div>
        ))}
      </section>

      <section className="mt-10 card p-6">
        <div className="label">Powiązane dokumenty</div>
        <ul className="mt-4 space-y-2 text-[14px]">
          <li>
            <Link href="/panel/umowa" className="text-lime hover:underline">
              Umowa Komisowa →
            </Link>
            <span className="text-text-mute text-[12px] ml-2">(podpisana raz, obowiązuje dla wszystkich Ofert)</span>
          </li>
          <li>
            <Link href="/panel/uks" className="text-lime hover:underline">UKS →</Link>
            <span className="text-text-mute text-[12px] ml-2">(zeskanowane Umowy Kupna-Sprzedaży)</span>
          </li>
          <li>
            <Link href="/panel/faktury" className="text-lime hover:underline">Faktury i rozliczenia →</Link>
            <span className="text-text-mute text-[12px] ml-2">(wgraj fakturę / UKS dla rozliczenia)</span>
          </li>
        </ul>
      </section>
    </>
  );
}
