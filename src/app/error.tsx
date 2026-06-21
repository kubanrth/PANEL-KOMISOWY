"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-soft">
        <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[60px] flex items-center">
          <Logo />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="text-center max-w-[560px] w-full">
          <div className="font-bold text-[80px] lg:text-[120px] leading-none tracking-[-0.05em] num text-coral">
            500
          </div>
          <h1 className="mt-4 font-bold text-[28px] tracking-[-0.025em]">
            Coś poszło nie tak.
          </h1>
          <p className="mt-3 text-text-soft text-[15px] leading-[1.6]">
            Złapaliśmy błąd serwera. Spróbuj ponownie albo wyloguj się i zaloguj ponownie.
          </p>

          {error.digest && (
            <p className="mt-2 text-[11px] text-text-mute font-mono">
              ID błędu: {error.digest}
            </p>
          )}

          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={reset}
              className="btn-primary h-11 px-5 text-[14px]"
            >
              Spróbuj ponownie
            </button>
            <Link href="/login" className="btn-ghost h-11 px-5 text-[14px] inline-flex items-center">
              Zaloguj się ponownie
            </Link>
            <Link href="/" className="text-[14px] text-text-soft hover:text-text">
              Strona główna →
            </Link>
          </div>

          {(error.message || error.digest) && (
            <div className="mt-10 text-left">
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="text-[11px] text-text-mute hover:text-text underline decoration-text-faint underline-offset-4"
              >
                {showDetails ? "Ukryj szczegóły techniczne" : "Pokaż szczegóły techniczne"}
              </button>
              {showDetails && (
                <pre className="mt-3 p-4 rounded-[12px] bg-surface border border-border-soft text-[11px] text-text-soft font-mono whitespace-pre-wrap break-all overflow-x-auto">
                  {error.message || "(brak komunikatu)"}
                  {error.digest && `\n\nDigest: ${error.digest}`}
                  {error.stack && `\n\n${error.stack.split("\n").slice(0, 5).join("\n")}`}
                </pre>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
