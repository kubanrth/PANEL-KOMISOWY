import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-soft">
        <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[68px] flex items-center">
          <Logo />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-[480px]">
          <div className="font-bold text-[120px] lg:text-[160px] leading-none tracking-[-0.05em] num bg-gradient-to-r from-blue via-purple to-pink bg-clip-text text-transparent">
            404
          </div>
          <h1 className="mt-4 font-bold text-[28px] tracking-[-0.025em]">
            Strona nie istnieje.
          </h1>
          <p className="mt-3 text-text-soft text-[15px] leading-[1.6]">
            Link wygasł, zmieniliśmy strukturę albo wpisałeś coś dziwnego. Wróć do panelu.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <ButtonLink href="/" size="md">
              Strona główna <ArrowRight size={14} />
            </ButtonLink>
            <Link href="/panel" className="text-[14px] text-text-soft hover:text-text">
              Panel klienta →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
