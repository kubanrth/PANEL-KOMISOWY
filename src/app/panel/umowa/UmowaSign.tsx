"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@/components/ui/Button";
import { signMasterAgreement } from "./actions";

type SignMethod = "autopay" | "pz";

export function UmowaSign({ accountType }: { accountType: "individual" | "business" }) {
  const router = useRouter();
  const [method, setMethod] = useState<SignMethod>("autopay");
  const [signing, setSigning] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSign() {
    setError(null);
    setSigning(true);
    // Mock Autopay/PZ delay (production = OAuth popup)
    setTimeout(() => {
      startTransition(async () => {
        const result = await signMasterAgreement(method);
        setSigning(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      });
    }, 1400);
  }

  return (
    <div className="space-y-8">
      {/* Contract preview */}
      <div className="card p-6 lg:p-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="label">Treść umowy</div>
            <div className="mt-2 font-semibold text-xl tracking-[-0.025em]">
              Umowa Sprzedaży w Formie Konsygnacji
            </div>
            <div className="mt-1 text-[12px] text-text-mute">Wersja 4.2 · obowiązuje od 01.04.2026</div>
          </div>
          <span className="pill pill-mute">
            Konto: {accountType === "individual" ? "Indywidualne" : "Biznesowe"}
          </span>
        </div>
        <div className="mt-5 max-h-[260px] overflow-y-auto border-t border-b border-border-soft py-4 text-[13px] leading-[1.7] text-text-soft space-y-2 pr-2">
          <p><span className="text-text font-semibold">§1.</span> Komitent powierza Komisantowi (Kickback sp. z o. o.) rzeczy ruchome, których specyfikacja każdorazowo stanowi załącznik (Oferta / paczka), w celu ich sprzedaży.</p>
          <p><span className="text-text font-semibold">§2.</span> Niniejsza umowa zawierana jest jednorazowo i obowiązuje dla wszystkich kolejnych Ofert (paczek) Komitenta — bez konieczności ponownego podpisu.</p>
          <p><span className="text-text font-semibold">§3.</span> Własność rzeczy pozostaje przy Komitencie do momentu podpisania Umowy Kupna-Sprzedaży lub wystawienia FV po sprzedaży.</p>
          <p><span className="text-text font-semibold">§4.</span> Komisant zobowiązuje się do procedury Authentication &amp; Quality Control (12-punktowy audyt) w terminie do 5 dni roboczych od dostarczenia paczki.</p>
          <p><span className="text-text font-semibold">§5.</span> Komitent dla każdej rzeczy może wybrać model rozliczenia: (a) prowizja 20% od ceny sprzedaży, (b) stała wypłata — Komitent deklaruje kwotę, Komisant sprzedaje za dowolną cenę powyżej.</p>
          <p><span className="text-text font-semibold">§6.</span> Komitent zachowuje prawo akceptacji wyceny, redukcji ceny oraz wycofania rzeczy zgodnie z polityką zwrotów.</p>
          <p><span className="text-text font-semibold">§7.</span> Środki ze sprzedaży deponowane są w Wallet. Wypłata odbywa się na pisemną dyspozycję Komitenta po podpisaniu Umowy K-S lub wystawieniu FV.</p>
        </div>
      </div>

      {/* Method */}
      <div>
        <div className="label mb-4">Metoda podpisu</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MethodCard
            letter="A"
            title="Autopay"
            desc="Logowanie do banku (mTransfer, Santander, ING, PKO BP). Tożsamość przez Open Banking."
            tags={["~ 90 sek", "14 banków PL"]}
            active={method === "autopay"}
            onClick={() => setMethod("autopay")}
          />
          <MethodCard
            letter="B"
            title="Profil zaufany"
            desc="Logowanie do gov.pl. Podpis elektroniczny z mocą prawną dokumentu papierowego."
            tags={["~ 3 min", "gov.pl"]}
            active={method === "pz"}
            onClick={() => setMethod("pz")}
          />
        </div>
      </div>

      {/* Demo banner */}
      <div className="rounded-[12px] bg-yellow/8 border border-yellow/25 px-4 py-3 text-[13px] text-yellow inline-flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
        Tryb demo — Autopay i PZ symulowane (real OAuth w Phase 4).
      </div>

      {error && (
        <div className="rounded-[12px] bg-coral/10 border border-coral/30 px-4 py-3 text-[13px] text-coral">
          {error}
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleSign}
          disabled={signing || pending}
          className="btn-primary h-12 px-7 text-[14px] inline-flex items-center gap-3"
        >
          {signing || pending
            ? <>Podpisywanie…</>
            : <>Podpisz przez {method === "autopay" ? "Autopay" : "Profil zaufany"} <ArrowRight /></>}
        </button>
      </div>
    </div>
  );
}

function MethodCard({
  letter, title, desc, tags, active, onClick,
}: {
  letter: string; title: string; desc: string; tags: string[]; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-6 rounded-[16px] border-2 transition-colors ${
        active ? "border-lime/60 bg-lime/5" : "border-border hover:border-text-mute bg-surface"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="font-bold text-2xl tracking-[-0.04em] text-lime">{letter}</span>
        <span className={`h-5 w-5 rounded-full border-2 ${active ? "border-lime bg-lime" : "border-border"} flex items-center justify-center`}>
          {active && <span className="h-2 w-2 rounded-full bg-[#05140B]" />}
        </span>
      </div>
      <div className="mt-5 font-semibold text-xl tracking-[-0.025em]">{title}</div>
      <div className="mt-2 text-[13px] text-text-soft leading-[1.5]">{desc}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="text-[11px] px-2 py-1 rounded-md bg-surface-2 border border-border text-text-soft">
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}
