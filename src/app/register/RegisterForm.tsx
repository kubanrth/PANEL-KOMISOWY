"use client";

import { useActionState } from "react";
import { registerAction, type ActionState } from "./actions";
import { ArrowRight } from "@/components/ui/Button";

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(registerAction, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="input-label" htmlFor="email">E-mail</label>
        <input
          id="email" name="email" type="email" autoComplete="email"
          required placeholder="kuba@domena.pl" className="input"
        />
      </div>

      <div>
        <label className="input-label" htmlFor="password">Hasło</label>
        <input
          id="password" name="password" type="password" autoComplete="new-password"
          required minLength={8} placeholder="Minimum 8 znaków" className="input"
        />
      </div>

      <div>
        <label className="input-label" htmlFor="password_confirm">Powtórz hasło</label>
        <input
          id="password_confirm" name="password_confirm" type="password" autoComplete="new-password"
          required minLength={8} placeholder="Powtórz hasło" className="input"
        />
      </div>

      {state?.error && (
        <div className="rounded-[12px] bg-coral/10 border border-coral/30 px-4 py-3 text-[13px] text-coral">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-[12px] bg-mint/10 border border-mint/30 px-4 py-3 text-[13px] text-mint">
          {state.success}
        </div>
      )}

      <button
        type="submit" disabled={isPending}
        className="btn-primary w-full h-12 text-[14px] inline-flex items-center justify-center gap-2"
      >
        {isPending ? "Tworzenie konta…" : <>Załóż konto <ArrowRight /></>}
      </button>

      <p className="text-[12px] text-text-mute leading-relaxed">
        Klikając „Załóż konto" akceptujesz <a href="#" className="text-text hover:underline">Regulamin</a> oraz <a href="#" className="text-text hover:underline">Politykę prywatności</a>. Twoje dane chronimy zgodnie z RODO.
      </p>
    </form>
  );
}
