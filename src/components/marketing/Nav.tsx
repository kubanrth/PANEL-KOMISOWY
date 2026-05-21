import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-bg/70 border-b border-border-soft">
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[60px] flex items-center justify-between">
        <Logo showSuffix={false} />

        <nav className="hidden lg:flex items-center gap-8 text-[14px] text-text-soft">
          <Link href="#proces" className="hover:text-text transition-colors">Jak to działa</Link>
          <Link href="#aqc" className="hover:text-text transition-colors">Authentication</Link>
          <Link href="#wallet" className="hover:text-text transition-colors">Wallet</Link>
          <Link href="#stats" className="hover:text-text transition-colors">Liczby</Link>
          <Link href="#faq" className="hover:text-text transition-colors">FAQ</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden sm:inline-flex h-10 px-4 items-center text-[14px] text-text-soft hover:text-text transition-colors">
            Zaloguj się
          </Link>
          <ButtonLink href="/register" size="md">
            Sprzedaj z nami
            <ArrowRight />
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
