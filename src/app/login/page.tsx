import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { LoginForm } from "./LoginForm";

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-soft">
        <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[68px] flex items-center justify-between">
          <Logo />
          <Link href="/register" className="text-[14px] text-text-soft hover:text-text transition-colors">
            Nie masz konta? <span className="text-text font-semibold">Zarejestruj się</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[420px]">
          <h1 className="font-bold text-[44px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
            Zaloguj się.
          </h1>
          <p className="mt-3 text-[15px] text-text-soft">
            Wróć do swoich Submissions, Wallet i powiadomień.
          </p>

          <div className="mt-10">
            <LoginForm next={next} />
          </div>

          <hr className="my-8 border-border-soft" />

          <div className="text-center text-[13px] text-text-mute">
            Logując się akceptujesz <Link href="#" className="text-text hover:underline">Regulamin</Link> oraz <Link href="#" className="text-text hover:underline">Politykę prywatności</Link>.
          </div>
        </div>
      </main>
    </div>
  );
}
