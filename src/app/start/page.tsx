import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/server";
import { StartFlow } from "./StartFlow";

export default async function StartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/register?next=/start");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at, master_agreement_signed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) redirect("/onboarding");
  if (!profile.master_agreement_signed_at) redirect("/panel/umowa?next=/start");

  const accountType = (profile.account_type ?? "individual") as "individual" | "business";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-soft sticky top-0 z-30 backdrop-blur-md bg-bg/80">
        <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[68px] flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-[13px] text-text-soft">
              {profile.first_name} {profile.last_name}
            </span>
            <a href="/panel" className="text-[13px] text-text-soft hover:text-text transition-colors">
              ← Wróć do panelu
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-10 lg:py-14">
        <div className="mx-auto max-w-[920px]">
          <StartFlow accountType={accountType} />
        </div>
      </main>
    </div>
  );
}
