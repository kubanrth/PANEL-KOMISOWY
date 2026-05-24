import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "./PanelShell";

export type PanelComingSoonProps = {
  /** Stable nav key from nav-config — used to highlight the sidebar item. */
  navKey: string;
  /** Page H1 (PL). */
  title: string;
  /** One-line subtitle under H1, describes what the page will deliver. */
  description: string;
  /** Bullet list of what the page will show when complete (optional). */
  features?: string[];
  /** Which phase delivers this (shown as small chip — "Faza 3" etc.). */
  phase?: string;
};

/**
 * Reusable "Wkrótce" page for routes that are wired into the new menu but
 * not yet implemented. Phase 1 ships the menu structure; deeper phases
 * replace these stubs with real content one by one.
 *
 * Each stub still runs the auth + onboarded checks via PanelShell so users
 * land in `/login` / `/onboarding` instead of seeing a broken page.
 */
export async function PanelComingSoon({
  navKey,
  title,
  description,
  features,
  phase,
}: PanelComingSoonProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active={navKey}
      breadcrumb={[{ label: title }]}
    >
      <section>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="label">Wkrótce</span>
          {phase && (
            <span className="pill pill-blue">
              <span className="h-1.5 w-1.5 rounded-full bg-blue" />
              {phase}
            </span>
          )}
        </div>
        <h1 className="mt-4 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          {title}
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          {description}
        </p>
      </section>

      {features && features.length > 0 && (
        <section className="mt-10 max-w-[640px]">
          <div className="card p-6">
            <div className="label">Co tu znajdziesz</div>
            <ul className="mt-4 space-y-2.5 text-[14px] text-text-soft">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue mt-2 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-6 text-[13px] text-text-mute">
          Pracujemy nad tym ekranem. Tymczasem możesz skorzystać z{" "}
          <a href="/panel" className="text-text underline decoration-text-faint underline-offset-4 hover:decoration-blue">
            panelu głównego
          </a>
          {" "}lub{" "}
          <a href="mailto:hello@kickback.pl" className="text-text underline decoration-text-faint underline-offset-4 hover:decoration-blue">
            napisać do nas
          </a>
          .
        </div>
      </section>
    </PanelShell>
  );
}
