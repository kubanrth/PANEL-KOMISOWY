import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function PanelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <div className="min-h-screen">
      <header className="border-b border-border-soft sticky top-0 backdrop-blur-md bg-bg/70 z-30">
        <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[68px] flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-text-soft">
              {profile.first_name} {profile.last_name}
            </span>
            <span className="pill pill-mute">{profile.account_type === "individual" ? "Indywidualne" : "Biznesowe"}</span>
            <form action={signOut}>
              <button type="submit" className="text-[13px] text-text-soft hover:text-text transition-colors">
                Wyloguj
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-6 lg:px-10 py-16 lg:py-24">
        <div className="label">Panel klienta</div>
        <h1 className="mt-4 font-bold text-[44px] lg:text-[64px] leading-[1.02] tracking-[-0.04em]">
          Cześć, <span className="text-blue">{profile.first_name}</span>.
        </h1>
        <p className="mt-4 text-[17px] text-text-soft max-w-[58ch]">
          Konto utworzone. Pełen panel (Submissions, My Sales, Wallet, Notifications) w kolejnej sesji — Sesja 2 i 3 wg <Link href="https://github.com/kubanrth/PANEL-KOMISOWY/blob/main/PLAN.md" className="text-text underline decoration-text-faint underline-offset-4 hover:decoration-blue">PLAN.md</Link>.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl">
          <div className="card p-7">
            <div className="label">Submissions</div>
            <div className="mt-3 font-bold text-4xl tracking-[-0.04em] num text-text-mute">0</div>
            <div className="mt-2 text-[13px] text-text-mute">Wkrótce: Sesja 2</div>
          </div>
          <div className="card p-7">
            <div className="label">My Sales</div>
            <div className="mt-3 font-bold text-4xl tracking-[-0.04em] num text-text-mute">0</div>
            <div className="mt-2 text-[13px] text-text-mute">Wkrótce: Sesja 3</div>
          </div>
          <div className="card-gradient-blue p-7">
            <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wide">Wallet</div>
            <div className="mt-3 font-bold text-4xl tracking-[-0.04em] num text-white">0,00 zł</div>
            <div className="mt-2 text-white/80 text-[13px]">Wkrótce: Sesja 4</div>
          </div>
        </div>

        <div className="mt-12 inline-flex items-center gap-3 px-5 py-4 rounded-[16px] bg-amber/10 border border-amber/30 text-amber">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span className="text-[14px]">Tryb demo — bez integracji Autopay/PZ/banku. Środki testowe.</span>
        </div>
      </main>
    </div>
  );
}
