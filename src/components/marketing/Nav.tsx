import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";
import { getTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MarketingMobileMenu } from "./MobileMenu";

export async function MarketingNav() {
  const theme = await getTheme();

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-bg/70 border-b border-border-soft">
      <div className="mx-auto max-w-[1240px] px-4 lg:px-10 h-[56px] lg:h-[60px] flex items-center justify-between gap-3">
        <Logo showSuffix={false} />

        {/* Desktop nav links — visible from lg up */}
        <nav className="hidden lg:flex items-center gap-8 text-[14px] text-text-soft">
          <Link href="#proces" className="hover:text-text transition-colors">Jak to działa</Link>
          <Link href="#aqc" className="hover:text-text transition-colors">Authentication</Link>
          <Link href="#wallet" className="hover:text-text transition-colors">Wallet</Link>
          <Link href="#stats" className="hover:text-text transition-colors">Liczby</Link>
          <Link href="#faq" className="hover:text-text transition-colors">FAQ</Link>
        </nav>

        <div className="flex items-center gap-2 lg:gap-3">
          {/* Desktop: login + CTA + theme */}
          <Link href="/login" className="hidden sm:inline-flex h-10 px-4 items-center text-[14px] text-text-soft hover:text-text transition-colors">
            Zaloguj się
          </Link>
          <ButtonLink href="/register" size="md" className="hidden sm:inline-flex">
            Sprzedaj z nami
            <ArrowRight />
          </ButtonLink>
          <div className="hidden lg:block">
            <ThemeToggle current={theme} />
          </div>

          {/* Mobile: hamburger (visible under sm + always for theme/nav access) */}
          <div className="lg:hidden">
            <MarketingMobileMenu theme={theme} />
          </div>
        </div>
      </div>
    </header>
  );
}
