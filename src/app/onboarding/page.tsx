import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // If already onboarded, jump to panel
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarded_at) redirect("/panel");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-soft">
        <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[68px] flex items-center justify-between">
          <Logo />
          <span className="text-[13px] text-text-mute num">{user.email}</span>
        </div>
      </header>

      <main className="flex-1 px-6 py-12 lg:py-16">
        <div className="mx-auto max-w-[760px]">
          <div className="label">Krok 1 z 1 · Profil</div>
          <h1 className="mt-4 font-bold text-[44px] lg:text-[60px] leading-[1.02] tracking-[-0.04em]">
            Sprzedajesz <span className="text-text-soft">jako kto?</span>
          </h1>
          <p className="mt-4 text-[16px] text-text-soft max-w-[60ch]">
            Od typu konta zależy forma odblokowania środków z Wallet — przed pierwszą Submission możesz to jeszcze zmienić.
          </p>

          <div className="mt-12">
            <OnboardingForm />
          </div>
        </div>
      </main>
    </div>
  );
}
