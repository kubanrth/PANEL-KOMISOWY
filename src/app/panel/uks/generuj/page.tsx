import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getOwnProfile } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type { Product } from "@/lib/types";

/* Generator UKS — drukowalna umowa kupna-sprzedaży dla sprzedanej pozycji.
   Wzorzec print jak etykieta nadania (#print-area + data-print-trigger).
   Flow: wydrukuj → podpisz → wgraj skan w /panel/uks.
   ponytail: bez PDF-a server-side (pdfkit/puppeteer) — window.print()
   robi PDF systemowo; generować plik dopiero gdy klienci poproszą. */

// Dane kupującego (komis) — te same co na etykiecie nadania.
const BUYER = ["Kickback sp. z o. o.", "ul. Postępu 14", "02-676 Warszawa"];

export default async function GenerujUksPage(props: { searchParams: Promise<{ product?: string; products?: string }> }) {
  const sp = await props.searchParams;
  // Jedna umowa na wiele pozycji: ?products=id1,id2 (legacy: ?product=id).
  const ids = (sp.products ?? sp.product ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^[0-9a-f-]{36}$/i.test(x))
    .slice(0, 50);
  if (ids.length === 0) redirect("/panel/uks");

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const profile = await getOwnProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");

  // RLS zawęża do produktów klienta — cudze id po prostu nie wrócą.
  type Row = Pick<Product, "id" | "brand" | "model" | "size" | "sku" | "condition" | "status" | "listing_price_cents" | "expected_price_cents" | "sold_at" | "submission_id">;
  const { data: productsRaw } = await supabase
    .from("products")
    .select("id, brand, model, size, sku, condition, status, listing_price_cents, expected_price_cents, sold_at, submission_id")
    .in("id", ids);
  const items = (productsRaw ?? []) as Row[];
  if (items.length === 0) notFound();

  const { data: fullProfile } = await supabase
    .from("profiles")
    .select("first_name, last_name, pesel_or_id, address_line, postal_code, city, account_type, company_name, nip")
    .eq("id", user.id)
    .maybeSingle();

  const priceOf = (p: Row) => p.listing_price_cents ?? p.expected_price_cents ?? 0;
  const total = items.reduce((a, p) => a + priceOf(p), 0);
  const sellerName = fullProfile?.account_type === "business" && fullProfile.company_name
    ? fullProfile.company_name
    : [fullProfile?.first_name, fullProfile?.last_name].filter(Boolean).join(" ") || "—";
  const sellerAddr = [fullProfile?.address_line, [fullProfile?.postal_code, fullProfile?.city].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");
  const sellerId = fullProfile?.account_type === "business"
    ? (fullProfile?.nip ? `NIP: ${fullProfile.nip}` : null)
    : (fullProfile?.pesel_or_id ? `PESEL / nr dok.: ${fullProfile.pesel_or_id}` : null);
  const docDate = items[0].sold_at ?? new Date().toISOString();
  const docNo = items.length === 1 ? `UKS/${items[0].sku}` : `UKS/${items[0].sku}+${items.length - 1}`;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          label={items.length === 1
            ? `${items[0].sku} · ${items[0].brand} ${items[0].model}`
            : `${items.length} pozycji · łącznie ${formatPLN(total, { decimals: false })}`}
          title="Umowa Kupna-Sprzedaży"
          sub="Wydrukuj dokument, podpisz i wgraj skan w zakładce UKS. Dane stron i przedmiotu uzupełniliśmy z panelu."
        />
        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <button type="button" data-print-trigger className="btn-primary h-11 px-5 text-[13px] inline-flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
            </svg>
            Drukuj / zapisz PDF
          </button>
          <ButtonLink href="/panel/uks" variant="ghost" size="md">← Wróć do UKS</ButtonLink>
        </div>
        {!sellerAddr && (
          <div className="mt-4 rounded-[12px] bg-yellow/10 border border-yellow/30 px-4 py-3 text-[13px] text-yellow max-w-[64ch]">
            Brak adresu w Twoim profilu — uzupełnij go w Ustawienia → Dane, żeby umowa była kompletna.
          </div>
        )}
      </div>

      {/* Dokument — biała kartka, drukuje się tylko ten blok */}
      <section id="print-area" className="mt-8 print:mt-0">
        <div className="bg-white text-black rounded-[16px] print:rounded-none p-8 lg:p-12 max-w-[820px] leading-[1.6] text-[13px]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          <div className="text-center">
            <div className="text-[18px] font-bold tracking-wide uppercase">Umowa Kupna-Sprzedaży</div>
            <div className="mt-1 text-[12px] text-black/60">nr {docNo} · zawarta dnia {formatDate(docDate)} w Warszawie</div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-black/50">Sprzedający</div>
              <div className="mt-2 font-semibold">{sellerName}</div>
              <div>{sellerAddr || "………………………………………"}</div>
              <div>{sellerId ?? "PESEL / nr dok.: ………………………"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-black/50">Kupujący</div>
              {BUYER.map((l, i) => <div key={l} className={i === 0 ? "mt-2 font-semibold" : ""}>{l}</div>)}
            </div>
          </div>

          <div className="mt-8">
            <div className="text-[10px] uppercase tracking-[0.18em] text-black/50">§1 · Przedmiot umowy</div>
            <p className="mt-2">
              Sprzedający przenosi na Kupującego własność następujących rzeczy używanych,
              a Kupujący rzeczy te nabywa za cenę określoną w §2:
            </p>
            <table className="mt-3 w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Lp.", "Przedmiot", "Rozmiar", "Stan", "Nr kat.", "Cena"].map((h, i) => (
                    <th key={h} className="border border-black/30 px-2 py-1.5 font-semibold" style={{ textAlign: i >= 5 ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((p, i) => (
                  <tr key={p.id}>
                    <td className="border border-black/30 px-2 py-1.5">{i + 1}</td>
                    <td className="border border-black/30 px-2 py-1.5"><strong>{p.brand} {p.model}</strong></td>
                    <td className="border border-black/30 px-2 py-1.5">{p.size ?? "—"}</td>
                    <td className="border border-black/30 px-2 py-1.5">{p.condition ? `${p.condition}/10` : "—"}</td>
                    <td className="border border-black/30 px-2 py-1.5" style={{ fontFamily: "monospace" }}>{p.sku}</td>
                    <td className="border border-black/30 px-2 py-1.5" style={{ textAlign: "right" }}>{formatPLN(priceOf(p))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-black/50">§2 · Cena</div>
            <p className="mt-2">
              Łączna cena sprzedaży wynosi <strong>{formatPLN(total)}</strong> (słownie: ……………………………………………………).
              Zapłata nastąpi przelewem na rachunek Sprzedającego wskazany w umowie komisowej.
            </p>
          </div>

          <div className="mt-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-black/50">§3 · Oświadczenia</div>
            <p className="mt-2">
              Sprzedający oświadcza, że rzecz stanowi jego własność, jest wolna od wad prawnych oraz praw osób
              trzecich. Kupujący oświadcza, że stan techniczny rzeczy jest mu znany. W sprawach nieuregulowanych
              stosuje się przepisy Kodeksu cywilnego. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach,
              po jednym dla każdej ze stron.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-8 text-center">
            <div>
              <div className="border-t border-black/40 pt-2 text-[11px]">Sprzedający</div>
            </div>
            <div>
              <div className="border-t border-black/40 pt-2 text-[11px]">Kupujący</div>
            </div>
          </div>
        </div>
      </section>

      <PrintScript />
    </>
  );
}

function PrintScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          document.querySelectorAll('[data-print-trigger]').forEach(el => {
            el.addEventListener('click', () => window.print());
          });
        `,
      }}
    />
  );
}
