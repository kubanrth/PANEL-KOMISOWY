"use client";

import { useRef, useState, useTransition } from "react";
import { changePassword } from "./actions";

export function PasswordForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  return (
    <form
      ref={ref}
      action={(formData) =>
        start(async () => {
          setMsg(null);
          const res = await changePassword(formData);
          if (res.ok) {
            setMsg({ kind: "ok", text: res.message ?? "OK" });
            ref.current?.reset();
          } else {
            setMsg({ kind: "err", text: res.error });
          }
        })
      }
      className="space-y-4"
    >
      <div>
        <label className="input-label">Nowe hasło</label>
        <input type="password" name="password" autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="input-label">Powtórz nowe hasło</label>
        <input type="password" name="confirm" autoComplete="new-password" className="input" />
      </div>
      {msg && (
        <div className={`text-[13px] ${msg.kind === "ok" ? "text-mint" : "text-coral"}`}>{msg.text}</div>
      )}
      <div>
        <button type="submit" disabled={pending} className="btn-primary h-10 px-5 text-[14px]">
          {pending ? "Zmieniam…" : "Zmień hasło"}
        </button>
      </div>
    </form>
  );
}
