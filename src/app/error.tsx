"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-soft">
        <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[68px] flex items-center">
          <Logo />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-[520px]">
          <div className="font-bold text-[80px] lg:text-[120px] leading-none tracking-[-0.05em] num text-coral">
            500
          </div>
          <h1 className="mt-4 font-bold text-[28px] tracking-[-0.025em]">
            Coś poszło nie tak.
          </h1>
          <p className="mt-3 text-text-soft text-[15px] leading-[1.6]">
            Złapaliśmy błąd serwera. Spróbuj ponownie albo wróć na stronę główną.
          </p>
          {error.digest && (
            <p className="mt-2 text-[11px] text-text-mute font-mono">
              ID błędu: {error.digest}
            </p>
          )}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={reset}
              className="btn-primary h-11 px-5 text-[14px]"
            >
              Spróbuj ponownie
            </button>
            <Link href="/" className="text-[14px] text-text-soft hover:text-text">
              Strona główna →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
