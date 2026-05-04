"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "./actions";
import { ArrowRight } from "@/components/ui/Button";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}

      <div>
        <label className="input-label" htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="kuba@domena.pl"
          className="input"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label className="input-label" htmlFor="password">Hasło</label>
          <a href="/forgot-password" className="text-[12px] text-text-soft hover:text-text">
            Zapomniałeś?
          </a>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          placeholder="••••••••"
          className="input"
        />
      </div>

      {state?.error && (
        <div className="rounded-[12px] bg-coral/10 border border-coral/30 px-4 py-3 text-[13px] text-coral">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full h-12 text-[14px] inline-flex items-center justify-center gap-2"
      >
        {isPending ? "Logowanie…" : <>Zaloguj się <ArrowRight /></>}
      </button>
    </form>
  );
}
