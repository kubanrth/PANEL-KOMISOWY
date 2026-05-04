"use client";

import { useActionState, useState } from "react";
import { saveOnboarding, type OnboardingState } from "./actions";
import { ArrowRight } from "@/components/ui/Button";

export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(saveOnboarding, undefined);
  const [type, setType] = useState<"individual" | "business">("individual");

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="account_type" value={type} />

      {/* Account type cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TypeCard
          letter="A"
          title="Indywidualne"
          desc="Osoba fizyczna. Wypłata po podpisaniu Umowy Kupna-Sprzedaży."
          active={type === "individual"}
          onClick={() => setType("individual")}
        />
        <TypeCard
          letter="B"
          title="Biznesowe"
          desc="Firma. Wypłata po wystawieniu faktury sprzedażowej."
          active={type === "business"}
          onClick={() => setType("business")}
        />
      </div>

      {/* Common name fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="input-label" htmlFor="first_name">Imię</label>
          <input id="first_name" name="first_name" required placeholder="Kuba" className="input" />
        </div>
        <div>
          <label className="input-label" htmlFor="last_name">Nazwisko</label>
          <input id="last_name" name="last_name" required placeholder="North" className="input" />
        </div>
      </div>

      {/* Conditional: individual vs business */}
      {type === "individual" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="input-label" htmlFor="pesel_or_id">PESEL lub Nr Dowodu</label>
            <input id="pesel_or_id" name="pesel_or_id" required placeholder="00000000000" className="input" />
          </div>
          <div>
            <label className="input-label" htmlFor="phone">Telefon</label>
            <input id="phone" name="phone" type="tel" placeholder="+48 ___ ___ ___" className="input" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="input-label" htmlFor="company">Nazwa firmy</label>
            <input id="company" name="company" required placeholder="Kickback sp. z o.o." className="input" />
          </div>
          <div>
            <label className="input-label" htmlFor="nip">NIP</label>
            <input id="nip" name="nip" required placeholder="0000000000" className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="input-label" htmlFor="phone">Telefon kontaktowy</label>
            <input id="phone" name="phone" type="tel" placeholder="+48 ___ ___ ___" className="input" />
          </div>
        </div>
      )}

      {state?.error && (
        <div className="rounded-[12px] bg-coral/10 border border-coral/30 px-4 py-3 text-[13px] text-coral">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary h-12 px-7 text-[14px] inline-flex items-center justify-center gap-2"
      >
        {isPending ? "Zapisywanie…" : <>Zakończ rejestrację <ArrowRight /></>}
      </button>
    </form>
  );
}

function TypeCard({ letter, title, desc, active, onClick }: { letter: string; title: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-6 rounded-[16px] border-2 transition-all ${
        active
          ? "border-blue bg-blue/5"
          : "border-border hover:border-text-mute bg-surface"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="font-bold text-2xl tracking-[-0.04em] text-blue">{letter}</span>
        <span className={`h-5 w-5 rounded-full border-2 ${active ? "border-blue bg-blue" : "border-border"} flex items-center justify-center transition-colors`}>
          {active && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
      </div>
      <div className="mt-5 font-semibold text-xl tracking-[-0.025em]">{title}</div>
      <div className="mt-2 text-[13px] text-text-soft leading-[1.5]">{desc}</div>
    </button>
  );
}
