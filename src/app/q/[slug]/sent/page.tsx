import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ArrowRight } from "@/components/ui/Button";

export default async function OfferSentPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border-soft">
        <div className="mx-auto max-w-[920px] px-6 h-[68px] flex items-center justify-between">
          <Logo />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-[480px]">
          <div className="h-16 w-16 rounded-full bg-mint/15 border border-mint/30 flex items-center justify-center mx-auto text-mint">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 12 2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="mt-6 font-bold text-[36px] tracking-[-0.04em]">Oferta wysłana.</h1>
          <p className="mt-3 text-text-soft text-[15px] leading-[1.6]">
            Sprzedający dostał powiadomienie. Może zaakceptować, kontrować lub odrzucić Twoją ofertę. Powiadomimy Cię e-mailem, jeśli go podałeś.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href={`/q/${slug}`} className="text-[13px] text-text-soft hover:text-text">
              ← Wróć do produktu
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
