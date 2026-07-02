import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-soft">
        <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[68px] flex items-center justify-between">
          <Logo />
          <Link href="/login" className="text-[14px] text-text-soft hover:text-text transition-colors">
            Masz już konto? <span className="text-text font-semibold">Zaloguj się</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-0">
        {/* form side */}
        <div className="col-span-12 lg:col-span-7 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-[440px]">
            <h1 className="font-bold text-[30px] lg:text-[36px] leading-[1.02] tracking-[-0.04em]">
              Załóż konto.
            </h1>
            <p className="mt-3 text-[15px] text-text-soft">
              2 minuty. Pierwsza Submission — kolejne 6 minut.
            </p>

            <div className="mt-10">
              <RegisterForm />
            </div>
          </div>
        </div>

        {/* showcase side */}
        <aside className="hidden lg:flex col-span-5 border-l border-border-soft bg-bg-soft/40 items-center justify-center p-10">
          <div className="max-w-[420px] w-full">
            <div className="card-gradient-dark rounded-[24px] p-7 mb-5">
              <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wide">Średnia wycena</div>
              <div className="mt-2 font-bold text-5xl tracking-[-0.04em] text-white num">3 dni</div>
              <div className="mt-2 text-white/80 text-[13px]">12-punktowy audyt A&amp;QC</div>
            </div>

            <div className="card-gradient-dark rounded-[24px] p-7 mb-5">
              <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wide">Wypłata po sprzedaży</div>
              <div className="mt-2 font-bold text-5xl tracking-[-0.04em] text-white num">14 dni</div>
              <div className="mt-2 text-white/80 text-[13px]">Karencja zgodna z Umową K-S</div>
            </div>

            <div className="card p-7">
              <div className="label">Co dostaniesz</div>
              <ul className="mt-4 space-y-3 text-[14px]">
                {[
                  "Panel klienta ze Sprzedażami",
                  "Wallet z subkontem Santander",
                  "Powiadomienia w czasie rzeczywistym",
                  "Negocjacje z kupującymi (Zerr)",
                ].map((it) => (
                  <li key={it} className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
