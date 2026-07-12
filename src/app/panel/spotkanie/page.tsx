import { redirect } from "next/navigation";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";

/* Umów spotkanie — rezerwacja terminu online w kalendarzu Google.
   ponytail: zero własnego backendu — Google Calendar „appointment
   schedule" (harmonogram spotkań) osadzony iframe'em robi całość:
   wolne sloty, rezerwację, invite z linkiem Meet, przypomnienia.
   Własną integrację z Calendar API pisać dopiero, gdyby embed przestał
   wystarczać (branding, dane z panelu w rezerwacji). */

const BOOKING_URL = process.env.NEXT_PUBLIC_GCAL_BOOKING_URL;

export default async function SpotkaniePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  return (
    <>
      <PageHeader
        label="Spotkanie online · Google Meet"
        title="Umów spotkanie"
        sub="Wybierz wolny termin — spotkanie rezerwuje się od razu w kalendarzu Kickback, a Ty dostajesz zaproszenie z linkiem do rozmowy na maila."
      />

      <section className="mt-8">
        {BOOKING_URL ? (
          <div className="card overflow-hidden">
            <iframe
              src={BOOKING_URL}
              title="Rezerwacja spotkania — kalendarz Kickback"
              className="w-full h-[1100px] border-0 bg-white"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-10 text-center">
            <div className="font-semibold text-[15px]">Kalendarz rezerwacji jeszcze nie jest podpięty</div>
            <p className="mt-2 text-[13px] text-text-soft max-w-[52ch] mx-auto leading-[1.6]">
              Napisz do nas — umówimy termin ręcznie:{" "}
              <a href="mailto:kontakt@kickback.pl" className="text-lime hover:underline">kontakt@kickback.pl</a>
            </p>
          </div>
        )}
      </section>
    </>
  );
}
