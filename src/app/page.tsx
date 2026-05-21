import Link from "next/link";
import { MarketingNav } from "@/components/marketing/Nav";
import { ButtonLink, ArrowRight } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <>
      <MarketingNav />

      <main className="flex-1">
        <Hero />
        <TrustBar />
        <Process />
        <Authentication />
        <PanelPreview />
        <Wallet />
        <Stats />
        <Faq />
        <FinalCta />
      </main>

      <Footer />
    </>
  );
}

/* ====================================================== HERO */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border-soft">
      <div className="glow-blob" />
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 pt-10 lg:pt-14 pb-16 lg:pb-20 relative">
        <div className="grid grid-cols-12 gap-8 lg:gap-12 items-stretch">

          <div className="col-span-12 lg:col-span-7 flex flex-col">
            <h1 className="rise font-bold text-[44px] sm:text-[56px] lg:text-[72px] xl:text-[84px] leading-[0.98] tracking-[-0.045em]">
              Sprzedaj swoje<br />
              rzeczy, na które<br />
              <span className="bg-gradient-to-r from-blue via-purple to-pink bg-clip-text text-transparent">
                ktoś czeka.
              </span>
            </h1>

            <p className="rise delay-1 mt-6 max-w-[56ch] text-[16px] lg:text-[17px] leading-[1.55] text-text-soft">
              Powierzasz nam swoje przedmioty. Weryfikujemy autentyczność, ustalamy wycenę,
              sprzedajemy w naszych kanałach. Ty śledzisz każdą sprzedaż i wypłatę z jednego panelu.
            </p>

            <div className="rise delay-2 mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/register" size="lg">
                Wypełnij formularz
                <ArrowRight size={18} />
              </ButtonLink>
              <ButtonLink href="#proces" variant="ghost" size="lg">
                Jak to działa
              </ButtonLink>
            </div>

            <div className="rise delay-3 mt-auto pt-10 grid grid-cols-3 gap-6 max-w-xl border-t border-border-soft">
              <Stat value="3" unit="dni" label="Średni czas wyceny" />
              <Stat value="14" unit="dni" label="Wypłata po sprzedaży" />
              <Stat value="12" unit="pkt." label="Audyt autentyczności" />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 flex">
            <HeroCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div>
      <div className="font-bold text-3xl tracking-[-0.04em] num">
        {value}
        <span className="text-text-mute text-base ml-1 font-normal">{unit}</span>
      </div>
      <div className="mt-1.5 text-[13px] text-text-mute">{label}</div>
    </div>
  );
}

function HeroCard() {
  return (
    <div className="card-gradient-purple rounded-[24px] p-7 lg:p-8 relative overflow-hidden flex flex-col w-full">
      <div className="flex items-center justify-between">
        <span className="pill bg-white/15 text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Twój Wallet
        </span>
        <span className="text-white/60 text-[12px] font-medium">02.05.2026</span>
      </div>

      <div className="mt-auto">
        <div className="text-white/70 text-[13px] font-medium uppercase tracking-wide">Saldo dostępne</div>
        <div className="mt-2 font-bold text-[64px] lg:text-[80px] leading-none tracking-[-0.05em] text-white num">
          7&nbsp;240
          <span className="text-white/60 text-3xl ml-2 font-normal">zł</span>
        </div>
        <div className="mt-2 text-white/80 text-[14px] num">+ 1&nbsp;536 zł · ostatnia sprzedaż</div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <MiniStat label="Sprzedanych" value="12" />
        <MiniStat label="W sprzedaży" value="6" />
        <MiniStat label="Pending" value="2&nbsp;520" suffix="zł" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="bg-white/10 rounded-[12px] p-3">
      <div className="text-white/70 text-[11px] font-medium uppercase tracking-wide">{label}</div>
      <div className="mt-1 font-semibold text-white text-lg num">
        {value}
        {suffix && <span className="text-white/70 text-xs ml-1 font-normal">{suffix}</span>}
      </div>
    </div>
  );
}

/* ====================================================== TRUST BAR */
function TrustBar() {
  const items = [
    { title: "Authentication & QC", sub: "12-punktowy audyt", icon: ShieldIcon },
    { title: "Subkonto Santander", sub: "Środki klientów odseparowane", icon: BankIcon },
    { title: "Autopay / Profil zaufany", sub: "Podpis w 90 sek.", icon: SignIcon },
    { title: "Wsparcie 24h", sub: "Twój dedykowany konsygnator", icon: ChatIcon },
  ];
  return (
    <section className="border-b border-border-soft bg-bg-soft/40">
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 py-7 grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-8">
        {items.map((it) => (
          <div key={it.title} className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[12px] bg-surface-2 border border-border flex items-center justify-center text-blue">
              <it.icon />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-text">{it.title}</div>
              <div className="text-[12px] text-text-mute">{it.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ====================================================== PROCES */
function Process() {
  const steps = [
    {
      n: "01",
      time: "~ 6 min",
      title: "Powierz",
      body: "Podpisujesz Umowę Sprzedaży w Formie Konsygnacji online — Autopay lub Profil Zaufany. Generujemy etykietę nadania.",
    },
    {
      n: "02",
      time: "~ 3 dni",
      title: "Weryfikujemy",
      body: "Każda rzecz przechodzi 12-punktowy audyt Authentication & QC. Otrzymujesz wycenę z uzasadnieniem.",
    },
    {
      n: "03",
      time: "live",
      title: "Sprzedajemy",
      body: "Wystawiamy w naszych kanałach. W panelu śledzisz statystyki, akceptujesz oferty, redukujesz cenę.",
    },
    {
      n: "04",
      time: "~ 14 dni",
      title: "Wypłacamy",
      body: "Po sprzedaży środki czekają w Twoim Wallet. Dokumentujesz transakcję — odblokowujesz wypłatę.",
    },
  ];

  return (
    <section id="proces" className="border-b border-border-soft py-24 lg:py-32">
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10">
        <div className="grid grid-cols-12 gap-10 mb-16">
          <div className="col-span-12 lg:col-span-5">
            <div className="label">Proces</div>
            <h2 className="mt-4 font-bold text-[40px] lg:text-[60px] leading-[1.02] tracking-[-0.04em]">
              Cztery kroki<br />
              <span className="text-text-soft">do wypłaty.</span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            {/* spacer matches the height of the "Proces" label on the left so the paragraph
                aligns with the H2 heading, not with the section label. */}
            <div aria-hidden className="label hidden lg:block invisible">Proces</div>
            <p className="lg:mt-4 text-[17px] leading-[1.7] text-text-soft max-w-[58ch]">
              Konsygnacja Kickback to model, w którym Ty zatrzymujesz wartość, a my zdejmujemy z Ciebie ryzyko i obsługę. Wszystko — od umowy po wypłatę — w jednym, jasnym panelu.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {steps.map((s) => (
            <article key={s.n} className="card p-7">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[28px] tracking-[-0.04em] text-blue num">{s.n}</span>
                <span className="label">{s.time}</span>
              </div>
              <h3 className="mt-8 font-bold text-2xl tracking-[-0.025em]">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-[1.6] text-text-soft">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ====================================================== AUTHENTICATION */
function Authentication() {
  return (
    <section id="aqc" className="border-b border-border-soft py-24 lg:py-32 bg-bg-soft/40">
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 grid grid-cols-12 gap-10 lg:gap-14 items-center">

        <div className="col-span-12 lg:col-span-6">
          <div className="card-elev rounded-[24px] p-7 lg:p-8 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="label">Audit · SUB-08412</span>
              <span className="pill pill-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                PASS · 11/12
              </span>
            </div>

            <div className="mt-7">
              <div className="font-bold text-2xl tracking-[-0.025em]">Maison Margiela · Tabi</div>
              <div className="mt-1 text-text-mute text-[13px] num">EU 42 · stan 9/10</div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              {[
                ["Stitching", "10/10", "mint"],
                ["Leather", "10/10", "mint"],
                ["Hardware", "10/10", "mint"],
                ["Logo", "10/10", "mint"],
                ["Sole", "10/10", "mint"],
                ["Box & tags", "8/10", "amber"],
              ].map(([k, v, c]) => (
                <div key={k} className="flex justify-between border-b border-border-soft pb-2">
                  <span className="text-text-soft">{k}</span>
                  <span className={`num font-semibold ${c === "mint" ? "text-mint" : "text-amber"}`}>{v}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 pt-5 border-t border-border flex items-center justify-between">
              <span className="label">Wycena rekomend.</span>
              <span className="font-bold text-[28px] tracking-[-0.035em] num">
                2&nbsp;480 <span className="text-text-mute text-lg font-normal">zł</span>
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 lg:pl-6">
          <div className="label">Authentication & Quality Control</div>
          <h2 className="mt-4 font-bold text-[40px] lg:text-[58px] leading-[1.02] tracking-[-0.04em]">
            Każda rzecz<br />
            przechodzi <span className="text-blue">przez nasze ręce.</span>
          </h2>
          <p className="mt-7 max-w-[52ch] text-[17px] leading-[1.7] text-text-soft">
            Dwunastopunktowy audyt — autentyczność, stan, kompletność, materiał, hardware. Nie wystawiamy nic, czego sami byśmy nie kupili. Każdą decyzję uzasadniamy w panelu.
          </p>

          <ul className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 max-w-[480px] text-[15px]">
            {[
              "Weryfikacja oryginalności",
              "Audyt stanu (1–10)",
              "Materiał i wykończenie",
              "Hardware i logotypy",
              "Box, tagi, dokumenty",
              "Wycena rynkowa P50",
            ].map((it) => (
              <li key={it} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-blue flex-shrink-0" />
                {it}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ====================================================== PANEL PREVIEW */
function PanelPreview() {
  return (
    <section id="panel" className="border-b border-border-soft py-24 lg:py-32">
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10">

        <div className="grid grid-cols-12 gap-10 mb-12 items-end">
          <div className="col-span-12 lg:col-span-7">
            <div className="label">Twój panel</div>
            <h2 className="mt-4 font-bold text-[40px] lg:text-[60px] leading-[1.02] tracking-[-0.04em]">
              Pełna kontrola<br />
              <span className="text-text-soft">w jednym widoku.</span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-5">
            <p className="text-[16px] leading-[1.65] text-text-soft max-w-[44ch]">
              Oferty, Inventory, My Sales, Wallet. Decydujesz o każdej cenie, akceptujesz wycenę, redukujesz, wycofujesz rzecz na żądanie.
            </p>
          </div>
        </div>

        <div className="card overflow-hidden">
          {/* browser bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-soft">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-coral/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-mint/80" />
            </div>
            <span className="text-[12px] text-text-mute num">panel.kickback.pl / my-sales</span>
            <span className="label">@kuban</span>
          </div>

          <div className="grid grid-cols-12">
            {/* rail */}
            <aside className="col-span-12 md:col-span-3 border-r border-border p-6 bg-surface">
              <div className="label">Panel</div>
              <ul className="mt-4 space-y-2.5 text-[14px]">
                <RailItem label="Oferty" badge="8" />
                <RailItem label="Inventory" badge="12" />
                <RailItem label="My Sales" badge="12" active />
                <RailItem label="Wallet" badge="7 240 zł" badgeAccent />
                <RailItem label="Powiadomienia" badge="3" badgeAccent />
                <RailItem label="Statystyki" />
                <RailItem label="Ustawienia" muted />
              </ul>

              <hr className="my-7 border-border-soft" />

              <div className="label">Wallet</div>
              <div className="mt-2 font-bold text-2xl tracking-[-0.035em] num">
                7&nbsp;240 <span className="text-text-mute text-base font-normal">zł</span>
              </div>
              <div className="mt-1 text-[12px] text-text-mute">Odblokowane: 4 720 zł</div>
            </aside>

            {/* main */}
            <div className="col-span-12 md:col-span-9 p-6 lg:p-8 bg-surface-2/30">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
                <div>
                  <div className="label">My Sales</div>
                  <div className="font-bold text-2xl tracking-[-0.025em] mt-1.5">12 powierzonych rzeczy</div>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <FilterChip label="Wszystkie · 12" active />
                  <FilterChip label="Listed · 6" />
                  <FilterChip label="Sold · 4" />
                  <FilterChip label="QC · 2" />
                </div>
              </div>

              <div className="border-t border-border">
                <TableHeader />
                <Row brand="Maison Margiela" model="Tabi Loafers" meta="EU 42 · stan 9/10" sub="SUB-08412" status="Listed" statusVariant="mint" price="2 480" share="1 984 zł" colorA="#3F4661" colorB="#1F2638" />
                <Row brand="Acne Studios" model="Bla Konst" meta="M · denim · stan 9/10" sub="SUB-08407" status="Sprzedane · 14d" statusVariant="mint" price="1 920" share="1 536 zł" colorA="#5A6B85" colorB="#2D3848" />
                <Row brand="Off-White™" model="Industrial Belt" meta="L · 200 cm · stan 8/10" sub="SUB-08390" status="Oferta · 720" statusVariant="amber" price="820" share="576 zł" colorA="#605342" colorB="#3D3328" />
                <Row brand="Bottega Veneta" model="Cassette" meta="small · padded" sub="SUB-08376" status="A&QC" statusVariant="mute" price="est. 4 200" share="3 360 zł" colorA="#4D4536" colorB="#2D2820" />
              </div>

              <div className="mt-6 flex items-center justify-between text-[13px] text-text-mute">
                <span>4 z 12 pozycji</span>
                <span className="flex items-center gap-3">
                  <Link href="#" className="hover:text-text">Eksport CSV</Link>
                  <span className="text-text-faint">·</span>
                  <Link href="#" className="hover:text-text">Drukuj umowę</Link>
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

function RailItem({ label, badge, active, muted, badgeAccent }: { label: string; badge?: string; active?: boolean; muted?: boolean; badgeAccent?: boolean }) {
  return (
    <li className={`flex items-center justify-between py-2 px-3 -mx-3 rounded-[10px] ${active ? "bg-blue/10 text-blue font-semibold" : muted ? "text-text-mute" : "text-text-soft hover:text-text"}`}>
      <span>{label}</span>
      {badge && (
        <span className={`text-[11px] num ${badgeAccent ? (active ? "text-blue" : "text-mint") : active ? "text-blue" : "text-text-mute"}`}>
          {badge}
        </span>
      )}
    </li>
  );
}

function FilterChip({ label, active }: { label: string; active?: boolean }) {
  const cls = active
    ? "bg-text text-bg font-semibold"
    : "bg-surface text-text-soft hover:bg-surface-2";
  return <span className={`px-3 py-1.5 rounded-[10px] ${cls}`}>{label}</span>;
}

function TableHeader() {
  return (
    <div className="grid grid-cols-12 gap-4 px-1 py-3 label">
      <div className="col-span-5">Produkt</div>
      <div className="col-span-2">Oferta</div>
      <div className="col-span-2">Status</div>
      <div className="col-span-2 text-right">Cena</div>
      <div className="col-span-1 text-right">Twój udział</div>
    </div>
  );
}

function Row({
  brand, model, meta, sub, status, statusVariant, price, share, colorA, colorB,
}: {
  brand: string; model: string; meta: string; sub: string;
  status: string; statusVariant: "mint" | "amber" | "mute";
  price: string; share: string; colorA: string; colorB: string;
}) {
  const pillCls =
    statusVariant === "mint" ? "pill pill-mint"
    : statusVariant === "amber" ? "pill pill-amber"
    : "pill pill-mute";
  const dot =
    statusVariant === "mint" ? "bg-mint"
    : statusVariant === "amber" ? "bg-amber"
    : "bg-text-mute";

  return (
    <div className="grid grid-cols-12 gap-4 px-1 py-5 items-center border-t border-border-soft">
      <div className="col-span-5 flex items-center gap-4">
        <span
          className="h-12 w-12 rounded-[12px] flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${colorA}, ${colorB})` }}
        />
        <div>
          <div className="text-[15px] text-text">{brand} · {model}</div>
          <div className="text-[12px] text-text-mute mt-0.5 num">{meta}</div>
        </div>
      </div>
      <div className="col-span-2 text-[13px] text-text-mute num">{sub}</div>
      <div className="col-span-2">
        <span className={pillCls}>
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {status}
        </span>
      </div>
      <div className="col-span-2 text-right font-bold text-xl tracking-[-0.025em] num">
        {price} <span className="text-text-mute text-sm font-normal">zł</span>
      </div>
      <div className="col-span-1 text-right text-[13px] text-text-soft num">{share}</div>
    </div>
  );
}

/* ====================================================== WALLET */
function Wallet() {
  return (
    <section id="wallet" className="border-b border-border-soft py-24 lg:py-32 bg-bg-soft/40">
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 grid grid-cols-12 gap-10 lg:gap-14 items-center">

        <div className="col-span-12 lg:col-span-5">
          <div className="label">Wallet</div>
          <h2 className="mt-4 font-bold text-[40px] lg:text-[58px] leading-[1.02] tracking-[-0.04em]">
            Twoje środki<br />
            <span className="text-mint">na Twoich warunkach.</span>
          </h2>
          <p className="mt-7 max-w-[44ch] text-[16px] leading-[1.7] text-text-soft">
            Funds ze sprzedaży lądują w Wallet. Wypłacasz na konto kiedy chcesz, lub zostawiasz w depozycie pod opieką Kickback. Środki klientów trzymamy na osobnym subkoncie Santander.
          </p>

          <div className="mt-10 space-y-5 max-w-[44ch]">
            <UnlockOption letter="A" title="Osoba fizyczna" body="Upload podpisanej Umowy Kupna-Sprzedaży odblokowuje Funds." />
            <UnlockOption letter="B" title="Konto biznesowe" body="Wystawiasz fakturę sprzedażową — Funds odblokowane natychmiast." />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="card-elev p-7 lg:p-9 rounded-[24px]">
            <div className="flex items-center justify-between">
              <span className="label">Wallet · stan na 02.05.2026</span>
              <span className="pill pill-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                Dostępne 4 720 zł
              </span>
            </div>

            <div className="mt-7">
              <div className="font-bold text-[80px] lg:text-[112px] leading-none tracking-[-0.05em] num">
                7&nbsp;240
                <span className="text-text-mute text-3xl ml-3 font-normal">zł</span>
              </div>
              <div className="mt-3 text-[14px] text-text-mute">Funds w portfelu</div>
            </div>

            <hr className="my-8 border-border-soft" />

            <div className="grid grid-cols-3 gap-6">
              <BalanceCol label="Odblokowane" value="4 720" sub="Wypłaty: aktywne" valueClass="text-mint" />
              <BalanceCol label="Pending · 14d" value="2 520" sub="Odblok. ~ 12.05" />
              <BalanceCol label="YTD 2026" value="18,4 tys." sub="+22% vs. 2025" subClass="text-mint" />
            </div>

            <hr className="my-8 border-border-soft" />

            <ul className="space-y-4">
              <Tx avatar="#3F4661" title="Sprzedaż · Acne Bla Konst" sub="SUB-08407 · 28.04.2026" amount="+ 1 536" amountClass="text-mint" />
              <Tx avatar="#3A3D4A" title="Wypłata · Santander" sub="22.04.2026 · **** 3214" amount="− 2 800" amountClass="text-text-mute" />
              <Tx avatar="#605342" title="Sprzedaż · Off-White Belt" sub="SUB-08390 · 18.04.2026" amount="+ 576" amountClass="text-mint" />
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <button className="btn-primary h-12 px-5 text-[14px]">Wypłać na konto</button>
              <button className="btn-ghost h-12 px-5 text-[14px]">Pobierz Umowę K-S</button>
              <button className="btn-ghost h-12 px-5 text-[14px]">Wystaw FV</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function UnlockOption({ letter, title, body }: { letter: string; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <span className="font-bold text-2xl tracking-[-0.04em] text-blue mt-0.5 w-6 flex-shrink-0">{letter}</span>
      <div>
        <div className="text-[15px] font-semibold">{title}</div>
        <div className="text-[14px] text-text-soft mt-1">{body}</div>
      </div>
    </div>
  );
}

function BalanceCol({ label, value, sub, valueClass = "", subClass = "text-text-mute" }: { label: string; value: string; sub: string; valueClass?: string; subClass?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`mt-2 font-bold text-2xl tracking-[-0.035em] num ${valueClass}`}>{value}</div>
      <div className={`mt-1 text-[12px] ${subClass}`}>{sub}</div>
    </div>
  );
}

function Tx({ avatar, title, sub, amount, amountClass = "" }: { avatar: string; title: string; sub: string; amount: string; amountClass?: string }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <span className="h-9 w-9 rounded-full flex-shrink-0" style={{ background: avatar }} />
        <div className="min-w-0">
          <div className="text-[14px] truncate">{title}</div>
          <div className="text-[12px] text-text-mute mt-0.5 num">{sub}</div>
        </div>
      </div>
      <div className={`font-bold text-lg num ${amountClass}`}>{amount} <span className="text-sm font-normal">zł</span></div>
    </li>
  );
}

/* ====================================================== STATS */
function Stats() {
  const items = [
    { label: "Sprzedanych", value: "3 240", sub: "Od stycznia 2024" },
    { label: "Domyślna prowizja", value: "20%", sub: "Lub stała wypłata (Grail Point)" },
    { label: "Najszybsza wypłata", value: "9 dni", sub: "Od dostarczenia rzeczy" },
    { label: "Skuteczność A&QC", value: "99,4%", sub: "Trafność wyceny ±10%" },
  ];
  return (
    <section id="stats" className="border-b border-border-soft py-16 lg:py-20">
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 grid grid-cols-2 lg:grid-cols-4 gap-10">
        {items.map((it) => (
          <div key={it.label}>
            <div className="label">{it.label}</div>
            <div className="font-bold text-5xl lg:text-6xl tracking-[-0.045em] num mt-3">{it.value}</div>
            <div className="mt-2 text-[13px] text-text-mute">{it.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ====================================================== FAQ */
function Faq() {
  const items = [
    {
      q: "Czyją własnością jest rzecz przed sprzedażą?",
      a: "Twoją. Konsygnacja oznacza, że Kickback przechowuje i sprzedaje Twoje rzeczy jako magazyn dostawcy. Własność przechodzi na Kickback dopiero po podpisaniu Umowy Kupna-Sprzedaży lub wystawieniu FV.",
    },
    {
      q: "Jaki jest model rozliczenia?",
      a: "Dla każdej rzeczy wybierasz: (A) Prowizja 20% — Kickback sprzedaje, otrzymujesz 80% z ceny sprzedaży. (B) Stała wypłata — deklarujesz kwotę jaką chcesz otrzymać, sprzedajemy za dowolną cenę powyżej, różnica = nasza marża. Model wybierasz osobno per produkt w panelu.",
    },
    {
      q: "Mogę wycofać rzecz przed sprzedażą?",
      a: "Tak. Wycofanie jest darmowe jeśli rzecz nie spełnia naszych standardów lub okazała się nieoryginalna / uszkodzona. W innych przypadkach — opłata zależy od czasu trzymania rzeczy w magazynie.",
    },
    {
      q: "Co jeśli kupujący chce się targować?",
      a: "Każda oferta trafia do Twojego panelu. Akceptujesz, odrzucasz albo kontrujesz. Możesz też włączyć auto-akceptację dla ofert powyżej ustawionego progu.",
    },
    {
      q: "Konto firmowe czy indywidualne?",
      a: "Oba. Indywidualne — odblokowujesz Funds podpisując Umowę Kupna-Sprzedaży (PESEL / Nr DO). Biznesowe — wystawiasz fakturę sprzedażową (NIP / VAT ID), Funds odblokowują się natychmiast po jej wpłynięciu.",
    },
  ];

  return (
    <section id="faq" className="border-b border-border-soft py-24 lg:py-32">
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 grid grid-cols-12 gap-10 lg:gap-14">

        <div className="col-span-12 lg:col-span-4">
          <div className="label">FAQ</div>
          <h2 className="mt-4 font-bold text-[40px] lg:text-[52px] leading-[1.02] tracking-[-0.04em]">
            Najczęściej<br />
            <span className="text-text-soft">pytane.</span>
          </h2>
          <p className="mt-6 max-w-[36ch] text-[15px] leading-[1.7] text-text-soft">
            Nie znalazłeś odpowiedzi? Napisz na <a href="mailto:hello@kickback.pl" className="text-text underline decoration-text-faint underline-offset-4 hover:decoration-blue">hello@kickback.pl</a>, odpowiadamy do 24h.
          </p>
        </div>

        <div className="col-span-12 lg:col-span-8">
          {items.map((it, i) => (
            <details key={i} className="group border-b border-border-soft py-6 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between gap-6 cursor-pointer list-none">
                <span className="font-semibold text-xl lg:text-2xl tracking-[-0.025em] pr-4">{it.q}</span>
                <span className="text-blue text-2xl group-open:rotate-45 transition-transform flex-shrink-0">+</span>
              </summary>
              <p className="mt-4 max-w-[68ch] text-[15px] leading-[1.7] text-text-soft">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ====================================================== FINAL CTA */
function FinalCta() {
  return (
    <section className="relative overflow-hidden border-b border-border-soft py-24 lg:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[500px] w-[1000px] rounded-full opacity-30 bg-gradient-to-br from-blue via-purple to-pink blur-3xl" />
      </div>
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 relative">
        <div className="label">Czas zacząć</div>
        <h2 className="mt-5 font-bold text-[52px] lg:text-[88px] xl:text-[112px] leading-[0.96] tracking-[-0.045em]">
          Gotowy<br />
          na pierwszą<br />
          <span className="bg-gradient-to-r from-blue via-purple to-pink bg-clip-text text-transparent">sprzedaż?</span>
        </h2>

        <div className="mt-14 grid grid-cols-12 gap-10 items-end">
          <div className="col-span-12 lg:col-span-7 flex flex-wrap items-center gap-5">
            <ButtonLink href="/register" size="lg">
              Załóż konto
              <ArrowRight size={18} />
            </ButtonLink>
            <Link href="#" className="text-[15px] text-text-soft hover:text-text transition-colors">
              Porozmawiaj z konsygnatorem →
            </Link>
          </div>
          <div className="col-span-12 lg:col-span-5">
            <div className="label">Co przygotować</div>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              {[
                "Profil zaufany lub konto Autopay",
                "Dane osobowe (PESEL/Nr DO) lub firmowe (NIP)",
                "Zdjęcia rzeczy do wyceny (po 4–6 na produkt)",
                "Numer konta do wypłat (opcjonalnie, później)",
              ].map((it, i) => (
                <li key={i} className="flex gap-3 text-text-soft">
                  <span className="num text-text-mute">0{i + 1}</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ====================================================== FOOTER */
function Footer() {
  return (
    <footer>
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 py-16 grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-4">
          <div className="font-bold text-2xl tracking-[-0.04em]">Kickback</div>
          <p className="mt-3 max-w-[36ch] text-[14px] leading-[1.7] text-text-soft">
            Kickback sp. z o. o. — komisowa platforma sprzedaży w modelu konsygnacji. Polska, 2024–.
          </p>
        </div>
        <FooterCol title="Konsygnacja" links={[["Jak działa", "#proces"], ["Authentication", "#aqc"], ["Wallet", "#wallet"], ["Polityka zwrotów", "#"]]} />
        <FooterCol title="Pomoc" links={[["FAQ", "#faq"], ["Kontakt", "#"], ["Status systemu", "#"]]} />
        <FooterCol title="Prawne" links={[["Regulamin", "#"], ["Umowa konsygnacji", "#"], ["Umowa K-S (wzór)", "#"], ["Polityka prywatności", "#"]]} />
        <FooterCol title="Kontakt" links={[["hello@kickback.pl", "mailto:hello@kickback.pl"]]} extra="+48 22 000 00 00 · Warszawa, PL" />
      </div>

      <div className="border-t border-border-soft">
        <div className="mx-auto max-w-[1240px] px-6 lg:px-10 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[12px] text-text-mute">
          <span>© 2024–2026 Kickback sp. z o. o. · NIP 000-000-00-00</span>
          <span>Subkonto bankowe Santander · Aut. Profil zaufany / Autopay</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links, extra }: { title: string; links: [string, string][]; extra?: string }) {
  return (
    <div className="col-span-6 lg:col-span-2">
      <div className="label">{title}</div>
      <ul className="mt-4 space-y-2.5 text-[14px]">
        {links.map(([label, href]) => (
          <li key={label}><Link href={href} className="text-text-soft hover:text-text transition-colors">{label}</Link></li>
        ))}
      </ul>
      {extra && <div className="mt-3 text-[13px] text-text-mute">{extra}</div>}
    </div>
  );
}

/* ====================================================== ICONS */
function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function BankIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" />
    </svg>
  );
}
function SignIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
