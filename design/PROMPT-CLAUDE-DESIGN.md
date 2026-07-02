# Redesign panelu komisowego Kickback — brief dla Claude Design

**Referencja wizualna:** FocusFlow (Behance / Vyre Lab)
https://www.behance.net/gallery/250105067/FocusFlow-Branding-UX-UI-Dashboard-Design

> Prosto do rzeczy: zaprojektuj **komplet ekranów** (desktop 1440 + mobile 390) dla luksusowego panelu komisu piłkarskich koszulek **Kickback**, w wizualnym języku FocusFlow, przełożonym na kontekst premium fashion resale w Polsce. Deliverable = high-fidelity Figma-ready screens, gotowe do 1:1 implementacji w Next.js + Tailwind.

---

## 1. Kontekst produktu (co projektujemy)

**Kickback** to platforma komisu (consignment) do sprzedaży luksusowych/kolekcjonerskich koszulek piłkarskich w Polsce. Klienci (komisanci) oddają koszulki → Kickback autentykuje, wystawia w sklepie, sprzedaje, rozlicza. Panel to strefa klienta i backoffice adminów w jednej aplikacji Next.js + Supabase.

**Kim są użytkownicy paneli:**
- **Klient komisu:** kolekcjoner / okazjonalny sprzedawca, wiek 25–45, oczekuje statusów sprzedaży, portfela, wypłat, sygnałów rynkowych (co się sprzedaje, czego szukamy)
- **Admin Kickback:** operacja back-office — obsługa napływających ofert, A&QC (Authentication & Quality Check), wystawianie na sprzedaż, kontakt z klientami, rozliczenia, integracje księgowe (Fakturownia)

**Ton:** premium, spokojny, precyzyjny. Ma budzić zaufanie („moje pieniądze są tu bezpieczne, wiem co się dzieje z moją koszulką"). Nie fun-tech-startup, nie sport-hype, nie casino. Bliżej Vestiaire Collective niż StockX — ale w mroczniejszej, bardziej editorial estetyce FocusFlow.

**Domena, którą trzeba pokazać:**
- koszulki mają: klub / reprezentację / zawodnika, sezon, rozmiar, retro/nowa, stan, cenę, prowizję komisową
- statusy produktu: `submitted` → `aqc_pending` → `aqc_pass/fail` → `listed` → `reserved` → `sold` → `settled`
- portfel klienta: środki `pending` (sprzedane, czeka na settlement) / `available` (do wypłaty) / `paid_out`
- „Zapotrzebowanie" (WTB): admin publikuje listę „szukamy takich koszulek" — widoczna dla klientów w panelu
- „Co warto dodać" (Picks): admin ręcznie kuratorowany feed + heurystyki („rzeczy z Twojej kolekcji, których teraz brakuje")

---

## 2. Wizualny język FocusFlow — co przenosimy

**Charakter estetyki:**
- Dark-first, atmosferyczne. Powietrze, cisza, precyzja. Duża swobodna białka między elementami.
- Editorial typografia — dużo skali, dużo oddechu, sub-1em tracking dla nagłówków
- Organic/nature imagery jako akcent — miękkie zielone gradienty, subtelne radial glow w tle sekcji hero, delikatna ziarnistość SVG noise
- Karty **z jasnym rytmem hierarchii** (base surface → elevated → floating panel) — nie płaska szarość
- Wszędzie zaokrąglone rogi, ale spójnie: `10px` dla pillsów, `14px` dla inputów, `18–20px` dla kart, `24px` dla dużych paneli
- Kolorowe pigułki statusowe zamiast tekstu (grey NEW → blue IN PROGRESS → green ACCEPTED / DONE)

**Konkretne tokeny do wpisania w design system:**

```
/* Color — dark surface stack */
--bg-base:      #050807   /* near-black z lekkim zielonym cieniem */
--bg-soft:      #0A0D0B   /* delikatnie jaśniejsze tło dla sekcji */
--surface:      #0F1210   /* karta base */
--surface-2:    #16191A   /* karta elevated (hover, aktywna) */
--surface-3:    #1D2120   /* floating panel / modal */

/* Text */
--text:         #F5F5F3   /* primary */
--text-soft:    #BDBFBD   /* secondary */
--text-mute:    #7B7F7B   /* tertiary, metadata */
--text-faint:   #4A4E4B   /* disabled, timestamp mikrotekst */

/* Borders */
--border:       #22282523 /* 14% white — subtle divider */
--border-soft:  #FFFFFF0D /* 5% white — inner divider */

/* Accent — greeny FocusFlow */
--lime:         #66FF33   /* primary accent — bright, high-energy */
--lime-soft:    #6EFF3B44 /* pill background, glow layer */
--mint:         #22DD99   /* success, „sold", „wypłacono" */
--emerald:      #0D9F55   /* gradient stop dark */

/* Accent — status */
--blue:         #4A6BFF   /* in-progress, information */
--yellow:       #FFCC00   /* warning, notification badge */
--coral:        #FF5A47   /* error, „reject", „aqc_fail" */
--amber:        #F5A623   /* pending, retro tag */

/* Gradient primary CTA */
background: linear-gradient(135deg, #6ECC1F 0%, #22DD99 100%);
box-shadow: 0 12px 30px -8px #22DD9955, inset 0 1px 0 #FFFFFF20;
```

**Typografia:**

- Font family: **Lufga** (Fontshare, free) — pełny stack `Lufga, "Neue Haas Grotesk", Inter, system-ui`
- Wagi: `300 (Light)` do wielkoformatowych nagłówków display, `400 (Regular)` body, `500` labels / metadata, `600` przyciski i tabele
- **Line-height: 116%** (bezpośrednio z FocusFlow spec)
- **Letter-spacing: -1%** (-0.01em) dla nagłówków 24px+; dla display 48px+ zejść do `-0.03em`
- Rozmiary bazowe:
  - Display XL 72/1.05, tracking -0.035em, Light — hero landing
  - Display L 56/1.05, -0.03em, Light — dashboard nagłówki
  - H1 40/1.1, -0.025em, Regular
  - H2 28/1.15, -0.02em, Regular
  - H3 20/1.25, -0.015em, Medium
  - Body 15/1.55, -0.01em
  - Label 12/1.3, tracking +0.08em, uppercase, `text-mute`
  - Metadata 11/1.3, monospace-alt: `"IBM Plex Mono", ui-monospace`

**Ikonografia:**
- Line icons 1.5px stroke, zaokrąglone endy (Phosphor Icons „regular" albo Lucide — konsystentnie jeden zestaw)
- Nigdy solid + line mieszane w jednej sekcji
- Rozmiar bazowy 16px w tekście, 20px w nawigacji, 24px w kartach

**Ambient / nastrój (nie przesadzać):**
- Radial gradient glow w prawym-górnym rogu sekcji hero: `radial-gradient(circle at 80% 0%, #22DD9911 0%, transparent 60%)`
- Cienki grain SVG noise `opacity:.04` na `--bg-base`
- Zielona linia świetlna 1px pod aktywnym elementem sidebara (nie border, gradient `linear-gradient(90deg, #66FF33 0%, transparent 100%)`)

**Czego NIE kopiować z FocusFlow:**
- Ikony rakiet / kosmos — to jest ich narracja produktowa, my mamy koszulki piłkarskie
- Zdjęć lasów i mchu w keyvisualach — nasz keyvisual to detal koszulki / crest klubu, w tym samym oświetleniu (chiaroscuro, ciemny background, jedno źródło światła)
- 3D grafik biosferek — my używamy 2D fotografii produktowej + herby klubów

---

## 3. Adaptacja Kickback (mostki między FocusFlow a domeną)

FocusFlow to productivity/collab tool. My robimy komis luksusowych koszulek. Co się zmienia:

| FocusFlow pattern | Kickback adaptacja |
|---|---|
| „Tasks / Active tasks / Closed tasks" w sidebarze z badge'ami | „Oferty / W obiegu / Sprzedane / Wypłacone" — te same wzorce chevron+badge |
| Task card z avatar → text → status pill (NEW→IN PROGRESS→ACCEPTED) | Product card: crest klubu → tytuł koszulki → status pill (`AQC` `Listed` `Sold` `Settled`) |
| Task drawer z formularzem „create branch" | Drawer edycji koszulki: pola, sizes-toggle, notatki admin, akcje |
| „Document branches" list z docs+descriptors counts | „Oferta klienta" — pozycje: brand + sezon + rozmiar + retro flag + zdjęcia count |
| Lime green „Accepted / Done" | Mint green `#22DD99` „Sprzedane / Wypłacono" — konsystentnie |
| Blue „In progress" | Blue `#4A6BFF` „W A&QC / Do wystawienia" |
| Grey „New" | Grey neutralna pill dla `submitted / draft` |
| Yellow badge z liczbą powiadomień | Yellow `#FFCC00` — retro tag + „Nowa oferta czeka" |

Herby klubów (`crest_url`) stają się naszym _avatarem_ tam gdzie FocusFlow ma zdjęcia twarzy. Muszą być traktowane jak twarze: 40×40 rounded-full na bg-surface-2, biały ring 1px `border-white/8`.

Zdjęcia produktowe — mockowane placeholderami z `https://placehold.co/`, ALE styl produktowy: kwadrat 1:1, ciemne studio background, koszulka centered, subtelny cień. Nigdy fotoproducki „biały cyklorama e-commerce" — to burzy dark-mood.

---

## 4. Design system — komponenty do rozrysowania

Zanim narysujesz podstrony, zaprojektuj **kompletny component sheet** z tymi elementami (jedna strona Figma z labeled variants):

### 4.1 Buttony
- **Primary** — gradient lime→mint pill, `h-11 px-6`, weight 600, box-shadow z zielonym glow. Ikona po prawej opcjonalnie.
- **Secondary** — `bg-surface-2 border border-border`, tekst `text-text`, `h-11 px-6`, hover: `bg-surface-3`
- **Ghost** — bez tła, `text-text-soft hover:text-text`
- **Danger** — `bg-coral/10 text-coral border-coral/30`
- **Icon-only** — square 40×40, rounded-14
- Rozmiary: `sm` (h-8, text-12), `md` (h-11, text-14), `lg` (h-13, text-15)
- **Loading state** — spinner lime po lewej, tekst „Zapisuję…"
- **Disabled** — opacity 40%, brak hover

### 4.2 Inputy & Forms
- Input base: `bg-surface-2 border border-border rounded-[14px] h-11 px-4 text-15`
- Focus: `border-lime ring-2 ring-lime/20 outline-none`
- Label: 12px uppercase tracking +0.08em `text-text-mute` powyżej inputu, spacing 8px
- Error state: `border-coral` + `text-coral text-12` message poniżej
- Textarea: min-h-24, rounded-[14px], resize-y
- Select: custom (nie native), chevron ikonka po prawej, dropdown z tym samym `bg-surface-3`
- **Toggle pills (sizes)** — layout FocusFlow: pigułki `h-8 px-3 rounded-[10px]` w dwóch stanach (active: `bg-lime text-bg-base`, idle: `bg-surface-2 text-text-soft`)
- Checkbox: 18×18 rounded-[6px], zaznaczone — lime tło + biała ptaszka
- Radio: 18×18 rounded-full, kropka lime środku

### 4.3 Karty (surface stack)
- **Card base** — `bg-surface border border-border/60 rounded-[20px] p-6`. Cień: `0 1px 2px rgba(0,0,0,.4)`.
- **Card elevated** — `bg-surface-2 rounded-[20px] p-6`, `0 8px 30px -12px rgba(0,0,0,.5)`
- **Card floating (modal, drawer)** — `bg-surface-3 rounded-[24px] p-8`, `0 20px 60px -20px rgba(0,0,0,.7)` + backdrop blur
- Card z ikoną w rogu — 40×40 rounded-[10px] `bg-lime/10` z ikonką lime
- Card z crest'em (klub) — 48×48 rounded-[12px] `bg-surface-2` overflow-hidden

### 4.4 Pigułki statusowe (najważniejszy vocab)
Wszystkie: `h-6 px-2.5 rounded-full text-11 font-semibold uppercase tracking-wider`

- `pill-lime` — `bg-lime/15 text-lime border border-lime/25` — statusy pozytywne „Aktywne / W sprzedaży"
- `pill-mint` — `bg-mint/15 text-mint border border-mint/30` — „Sprzedane / Wypłacone / OK"
- `pill-blue` — `bg-blue/15 text-blue border border-blue/30` — „W obiegu / A&QC"
- `pill-yellow` — `bg-yellow/15 text-yellow border border-yellow/30` — „Retro / Uwaga"
- `pill-coral` — `bg-coral/15 text-coral border border-coral/30` — „Odrzucone / Wycofane"
- `pill-mute` — `bg-surface-2 text-text-mute` — „Draft / Archiwum"

### 4.5 Sidebar navigation (klient & admin)
Wzorzec 1:1 z FocusFlow:
- Szerokość 260px na desktopie, sticky
- Sekcje z chevron uppercase label + expand/collapse
- Item: `h-11 rounded-[12px] pl-4 flex items-center gap-3` z ikoną + label + numeric badge po prawej (jeśli count > 0)
- Active state: `bg-surface-2` + 3px lime lewa krawędź + lekki lime glow pod tekstem
- Pod-item (zagnieżdżony): `pl-11 h-9 text-14 text-text-soft`
- Team-color dot (klient panel): 8px koło po lewej dla pod-itemów, np. „Klub Real Madryt" ma czerwoną kropkę — u nas kolory statusów: sprzedaże (mint), portfel (yellow), zwroty (coral), plany (lime)
- Bottom sticky group: settings ikona + help ikona + user avatar/menu

### 4.6 Top bar
- Wysokość 64px, `bg-bg-base/80 backdrop-blur border-b border-border`
- Lewa: breadcrumb (Home / Sprzedaże / #KCB-26-A9F421) — separator „/" w `text-text-faint`
- Środek: search bar — 480px, `bg-surface-2 rounded-full h-10 px-4` z ikoną szkła, placeholder „Szukaj koszulki, klubu, klienta…"
- Prawa: bell z yellow dot badge → tema toggle → avatar z chevronem (dropdown menu)

### 4.7 Data tables
- Header row: `h-11 border-b border-border`, uppercase 11px `text-text-mute`, sortable columns z chevronem lime
- Body row: `h-16 border-b border-border-soft`, hover `bg-surface-2/40`, active `bg-surface-2`
- Ostatnia komórka „Actions" — ikony ghost + drawer opener
- Empty state: dashed border 1px `border-border`, centrowana ilustracja + tekst + primary CTA
- Row expand (accordion) — chevron w pierwszej kolumnie, expanded row `bg-surface/40` z detalami
- Pagination: „← Poprzednie · 1 / 8 · Następne →" na dole karty
- Filter bar nad tabelą: chip filters (rounded-full pill toggles) + select + range slider dla ceny

### 4.8 Wykresy
Chart lib nie tak ważny (Recharts / Nivo), ważny styl:
- Line chart: grid `#FFFFFF08` cienkie linie, aktywna linia gradient lime → mint, area fill `lime/8`, dots on hover
- Bar chart: bary rounded-top 6px, primary lime + secondary blue
- Donut: 3-4 segmenty, gap 4°, center label duży (32px number) + małe label pod (12px)
- Sparkline w KPI card: 40px height, jedna linia lime, delta pill obok („+12%" mint / „-3%" coral)
- Tooltip: `bg-surface-3 rounded-[10px] p-3` z listą wartości

### 4.9 Empty states
Zawsze centrowane w karcie, w tej samej gramatyce:
- Ikona 48×48 w kwadratowej ramce `bg-surface-2 rounded-[16px]`
- Nagłówek H3 (20px)
- 1-2 zdania body `text-text-soft` max-width 44ch
- Primary CTA
- Opcjonalnie subtle link „Dowiedz się więcej"

### 4.10 Notyfikacje (toast + inline banner)
- Toast: `bg-surface-3 rounded-[16px] p-4` z lewym paskiem 3px kolor (mint/yellow/coral wg severity), auto-dismiss 4s, akcje po prawej ghost buttony
- Inline banner: full-width `rounded-[14px] p-4` z border/left-stripe koloru, ikona + tekst + close X

### 4.11 Drawer & Modal
- Drawer prawy: 480px szeroki, slide-in from right, `bg-surface-3`, header sticky z close X, body scrollable, footer sticky z akcjami
- Modal centered: max-w-[560px] rounded-[24px], backdrop `bg-black/70 backdrop-blur-md`
- Full-screen mobile — sheet from bottom, drag handle na górze

### 4.12 Mobile navigation
- Bottom tab bar 68px, 5 slotów (Home / Oferty / Sprzedaże / Portfel / Więcej), `bg-bg-base/95 backdrop-blur border-t border-border`
- Active: ikonka lime + label lime
- FAB (floating action button) — 56×56 rounded-full gradient lime→mint, prawy-dolny róg z shadow, akcja „Nowa oferta"
- Drawer nav z hamburgera (dla „Więcej"): pełnoekranowy sheet z pełną listą sekcji

---

## 5. Layout wzorce (screen shell)

**Desktop klient (`/panel/*`):**
```
[ Sidebar 260 ][ TopBar 64 ]
[              ][ Breadcrumb / PageHeader        ]
[   Sidebar    ][ Content max-w-[1200px] px-8   ]
[              ][ Footer minimal                ]
```

**Desktop admin (`/admin/*`):**
Ta sama struktura, ale sidebar ma czerwoną kropkę w logo (visual differentiator: „jesteś w back-office") oraz label „ADMIN" 10px w topbarze obok logo.

**Mobile:**
```
[ TopBar 56 (logo + hamburger + avatar) ]
[ Content full-width px-4              ]
[ Bottom tab bar 68                    ]
```

**PageHeader wzorzec** (używany na każdej podstronie):
- Mały label uppercase 11px `text-text-mute` — np. „Sprzedaże · widok wszystkich"
- H1 40px Light `-0.025em` — nazwa strony, kończy się kropką (jak w FocusFlow: „Dashboard.", „Contacts.", „Zapotrzebowanie.")
- Sub-line 15px `text-text-soft` max-w-[60ch]
- Prawy górny róg: primary CTA (np. „Nowa oferta")

---

## 6. Podstrony do zaprojektowania (58 ekranów)

Każdą zaprojektuj w wersji **Desktop 1440** i **Mobile 390**. Kolejność sekcji poniżej = kolejność w Figmie. Dla każdej strony zaznaczono: `Cel`, `Kluczowe komponenty`, `Data pokazywane`, `Uwagi mobile`.

### GRUPA A — Publiczne / autoryzacja (8 stron)

**A1. `/` (root) + `/landing` — Landing produktowy**
- Cel: przedstawić Kickback, „Rozpocznij ofertę" jako CTA
- Layout: hero z zdjęciem editorial koszulki (dark, chiaroscuro) + duży display 72px „Sprzedaj koszulkę. My robimy resztę.", 3-cardowa sekcja „Jak to działa" (Odbierzemy → A&QC → Wystawimy → Wypłata), sekcja „Portfolio ostatnich sprzedaży" (grid 4×2 kart z ceną i pill sprzedaneym), footer minimal
- Data: 8 przykładowych sprzedaży (klub, sezon, cena finalna, prowizja %)
- Mobile: hero display 44px, karty full-width stack

**A2. `/login`**
- Cel: email + hasło
- Layout: centered 480px karta na tle blur-radial-lime, logo Kickback nad, formularz, „Zapomniałem hasła" ghost link pod, magic-link toggle
- Empty state: brak

**A3. `/register`**
- Cel: rejestracja klienta
- Layout: podobnie do login, ale 2 kroki (email/hasło → nazwa+numer). Progress dots na górze karty.

**A4. `/onboarding`**
- Cel: wypełnienie brakujących pól po pierwszym loginie (imię, nazwisko, adres, telefon, konto bankowe, wybór B2C/B2B)
- Layout: 4-stepowy wizard, sticky footer z „Wstecz / Dalej", progress bar top 4px gradient lime→mint
- Kompaktowa forma per krok, jedna kategoria pól per step

**A5. `/start` — Guest submission (nowa oferta bez konta)**
- Cel: guest może wysłać ofertę bez rejestracji (opcjonalne w MVP, ale route istnieje)
- Layout: pełen formularz submissji na jednej stronie z sekcjami collapsible: „Koszulka" (kraj/klub/sezon/rozmiar/stan), „Zdjęcia" (dropzone 6 fotek), „Kontakt" (email/telefon), „Adres odbioru"
- CTA: „Wyślij ofertę" gradient primary

**A6. `/q/[slug]` — Formularz submissji z linku (public)**
- Cel: konkretny link „prześlij nam koszulkę" np. z Instagrama
- Layout: identyczny jak `/start` ale z pre-populated fieldem „Skąd nas znasz" i logotypem partnera na górze
- Bonus: sidebar prawy „Co się dzieje po wysłaniu?" — 4 kroki (1. odbieramy → 2. autentykujemy → 3. wystawiamy → 4. wypłacamy)

**A7. `/q/[slug]/sent` — Potwierdzenie**
- Cel: confirmation po wysłaniu
- Layout: centered, duży zielony checkmark w kółku lime→mint gradient, H1 „Odebrane. Będziemy w kontakcie.", numer zgłoszenia w monospace `KCB-26-A9F421`, sub „Odezwiemy się w ciągu 24h. Sprawdź maila", ghost CTA „Wróć do strony głównej"

**A8. `/panel/notifications`** (fallback — może być modal, ale route istnieje)
- Cel: lista wszystkich powiadomień klienta
- Layout: pełna lista chronologiczna, każdy item = ikonka + tekst + timestamp + akcja opcjonalna. Filter chips na górze („Wszystkie / Nieprzeczytane / Sprzedaże / Wypłaty / System"). Empty state z ikoną dzwonka i tekstem „Cicho jak na Old Trafford po 3:0. Wróć za chwilę."

### GRUPA B — Panel klienta: Home & feeds (5)

**B1. `/panel` — Dashboard klienta**
- Cel: pierwsze co widać po zalogowaniu — status konta w skrócie
- Layout: 
  - Header „Cześć, Marcin. Twój wieczór wygląda tak."
  - Rząd 4 KPI cardów: `Aktywnie w sprzedaży (12)` `Sprzedane w tym mies. (3)` `Do wypłaty (2 340 zł)` `Nowe zapotrzebowanie (5)`. Każda ma sparkline lime + delta pill.
  - Sekcja „Twoje ostatnie ruchy" — timeline 8 pozycji (koszulka → status → data), styl FocusFlow „updates" (avatar+tekst+timestamp+status transition pill)
  - Sekcja „Co warto dodać" — 3 kart poziomo, każda z crest'em klubu + tekstem + CTA „Dodaj do oferty"
  - Sekcja „Zapotrzebowanie" — 3 karty (max 3, „Zobacz wszystkie →" link)
- Mobile: KPI 2×2 grid, timeline stack full-width

**B2. `/panel/plany` — Co warto dodać do komisu**
- Cel: kuratorowany + heurystyczny feed „polecamy dodać takie koszulki"
- Layout:
  - Toggle na górze: `Wszystkie ↔ Kuratorowane ↔ Sugestie AI`
  - Grid 3-kolumnowy kart. Karta ma: obrazek 4:3 crop + crest+nazwa klubu + sezon + tag „Retro" opcjonalnie + priority pill (`Wysoki / Średni / Niski`) + CTA ghost „Dodaj do najbliższej oferty" + timestamp „Wygasa za 12 dni"
  - Empty state: „Wszystko już masz. Wróć po nowe idee jutro."

**B3. `/panel/zapotrzebowanie` — WTB list**
- Cel: aktywne ogłoszenia „szukamy takich koszulek"
- Layout: 
  - PageHeader + filter chips (Rodzaj: Wszystkie/Kluby/Reprezentacje/Nazwiska + Retro toggle)
  - Grid 3-kolumnowy kart. Karta: crest 48×48 + nazwa + typ (Klub/Repr./Nazwisko) + sezon + retro flag + row rozmiarów jako pigułki blue (`XS S M L XL`) + separator + „Możliwa cena: 2 500 zł" (num mint, prawy) + „Opublikowano: 12 czerwca" mikrotekst
  - CTA bottom: „Masz pasujące? → Nowa oferta"
- Mobile: 1 kolumna

**B4. `/panel/promocje`**
- Cel: aktywne akcje marketingowe („obniż prowizję do 10% w tym tygodniu")
- Layout: banner hero na górze (dużo powietrza, ikona iskry lime) + poniżej lista 4-5 mniejszych bannerów wg. typu (Prowizja / Wypłata / Bonus akcja)
- Kompaktowa karta „Twoje aktywne bonusy" po prawej

**B5. `/panel/notifications`** — patrz A8

### GRUPA C — Panel klienta: Oferty & Magazyn (10)

**C1. `/panel/submissions` — Oferty (submissions)**
- Cel: lista wszystkich ofert klienta (wszystko co wysłał)
- Layout:
  - Tabs na górze: `Wszystkie / Draft / W obiegu / Odrzucone`
  - Tabela: `Numer` (KCB-26-…) `Data` `Pozycje (5)` `Status` (pill) `Wartość szac.` `Akcje` (chevron → drawer szczegółów)
  - Primary CTA prawy górny: „Nowa oferta"
  - Empty state: „Brak ofert. Wyślij pierwszą" z crest'em jako dekoracja

**C2. `/panel/submissions/[id]` — Szczegół oferty**
- Cel: 1 oferta, jej wszystkie pozycje + status per pozycja
- Layout:
  - PageHeader z numerem oferty + status pill + timeline oś (Wysłano → Odebrane → A&QC → Wystawione)
  - Lista pozycji (accordion): każda pozycja jako expandable row z 6 zdjęciami thumbnails + specyfikacja + osobny status
  - Prawy panel: „Kontakt z Kickback" (chat placeholder) + „Umowa" download link + „Notatki" textarea

**C3. `/panel/offers/[productId]` — Kontr-oferta**
- Cel: Kickback proponuje inną cenę niż zaproponował klient, klient akceptuje/odrzuca
- Layout: split screen — po lewej „Twoja propozycja" (3 500 zł, wykreślona), po prawej „Nasza kontr-oferta" (3 100 zł, gradient lime→mint background przypadek) + reasoning textarea admin czyta klient, poniżej 2 CTA `Zaakceptuj (primary gradient)` `Zaproponuj inną cenę (ghost)`

**C4. `/panel/magazyn` — Produkty w komisie**
- Cel: to co teraz jest fizycznie u Kickback, w sklepie
- Layout:
  - Filter bar: kraj, klub, sezon, status (Listed/Reserved/On Hold), price range slider, retro toggle
  - Widok toggle: Table ↔ Cards
  - Table view: `SKU` `Zdjęcie 40×40` `Klub · sezon · rozmiar` `Stan` `Cena` `Prowizja` `Status pill` `Wystawione od (14 dni)` `Actions`
  - Card view (mobile default): quilt 2-kolumn karty z dużym zdjęciem 1:1 + specyfikacja + cena + status
- Empty state: „Twój magazyn jest pusty. Wyślij pierwszą koszulkę."

**C5. `/panel/inventory`** — alias / eksport (może być redirect albo minimalny widok z „Pobierz CSV/XLSX" + link do `/panel/magazyn`). Zaprojektuj jako minimal cards z ikonami eksportu.

**C6. `/panel/sprzedaze` — Sprzedane koszulki**
- Cel: historia sprzedaży
- Layout: tabela + monthly grouped headers `Czerwiec 2026`, każdy miesiąc ma suma sprzedaży + suma prowizji. Rzędy: `SKU` `Klub · sezon` `Cena finalna` `Prowizja` `Kupujący (anon)` `Data` `Status wypłaty` (pill: `sale_pending / available / paid_out`)

**C7. `/panel/my-sales`** — alias / widok agregujący. Zaprojektuj jako **Dashboard sprzedażowy** z 3 wykresami (sales over time line, top klub bar, avg price donut) + tabela pod.

**C8. `/panel/products/[id]` — Karta produktu (klient view)**
- Cel: klient klika w koszulkę z magazynu → widzi wszystko o niej
- Layout: 2-kolumn (60/40)
  - Lewy: galeria 6 zdjęć (carousel z thumbnailami)
  - Prawy: specyfikacja lista `Klub` `Sezon` `Rozmiar` `Stan (A/B/C)` `Retro` `Historia cenowa` (mini sparkline) + duży dropdown „Cena aktualna 2 400 zł" z chevronem → historia zmian + CTA `Wycofaj z komisu` (danger ghost) `Zmień cenę` (secondary)

**C9. `/panel/products/[id]/withdraw` — Wycofanie z komisu**
- Cel: klient zmienia zdanie, chce odebrać koszulkę
- Layout: karta ostrzeżenia (yellow banner) „Wycofanie kosztuje 50 zł kosztów magazynowania. Odbiór w ciągu 14 dni." + formularz („Adres odbioru", „Wybierz datę", „Notatka") + primary CTA `Potwierdź wycofanie`

**C10. `/panel/komis-wyciagniety` — Wycofane produkty**
- Cel: archiwum wycofanych
- Layout: tabela wycofanych z datą wycofania i statusem odbioru (`Zamówiono odbiór / W drodze / Odebrane`)

### GRUPA D — Panel klienta: Finanse & umowa (7)

**D1. `/panel/wallet` — Portfel**
- Cel: kluczowy widok finansowy — środki, historia, wypłaty
- Layout:
  - Duży hero KPI card gradient dark-mint: „Dostępne do wypłaty" 8 240 zł num display 56px + CTA `Wypłać teraz` gradient primary
  - 2 mniejsze KPI cardy obok: `W trakcie rozliczenia (2 340 zł)` `Wypłacone łącznie (14 800 zł)` z sparkline
  - Tabela transakcji `Data` `Typ` (pill: sale_pending / settled / payout / adjustment) `Koszulka` `Kwota` `Bilans po`
  - Prawy panel: „Metoda wypłaty" (numer konta ukryty + edit) + „Faktura na wypłatę" (VAT/nie-VAT switch)

**D2. `/panel/faktury` — Faktury**
- Cel: lista faktur (od klienta do Kickback za prowizję, albo od Kickback do klienta za wypłatę B2B)
- Layout: tabela + filter po miesiącu + eksport PDF button per row + big „Pobierz zbiorczo PDF za rok" primary CTA na górze

**D3. `/panel/wyplaty` — Historia wypłat**
- Cel: wszystkie wypłaty, status realizacji
- Layout: kompaktowa lista `Data zlecenia` `Kwota` `Metoda` `Status` (pill: `Zlecona / W realizacji / Zrealizowana / Odrzucona`) + `Powód odrzucenia` tooltip. Sticky KPI top „Łącznie w tym roku: 14 800 zł"

**D4. `/panel/umowa` — Umowa komisowa**
- Cel: klient widzi swoją umowę, może pobrać PDF, akceptować nową wersję jeśli była aktualizacja
- Layout: karta z dokumentem preview (embed PDF), sticky footer „Pobierz PDF" + „Podpisz aneks" jeśli status `amendment_pending`

**D5. `/panel/warunki` — Warunki współpracy / regulamin**
- Cel: publiczny regulamin z anchor menu
- Layout: 2-kolumn — sticky sidebar spis treści, right content article-style typograficzny (H2/H3/paragraphs), max-width 720px, monospace numery paragrafów lewy margines

**D6. `/panel/dane` — Dane osobowe / firmowe**
- Cel: edycja danych
- Layout: 2 sekcje `Dane osobowe` + `Dane firmowe (dla B2B)` — każda z inputami. B2B toggle top. Bottom sticky save bar pojawia się przy zmianie.

**D7. `/panel/ustawienia` — Ustawienia**
- Cel: preferencje aplikacji
- Layout: sekcje `Powiadomienia` (email/push/sms toggles per event), `Bezpieczeństwo` (zmiana hasła + 2FA), `Prywatność` (widoczność w komisie), `Motyw` (Dark/Light/System — light mode też zaprojektowany!)

### GRUPA E — Panel klienta: Operacje & analityka (7)

**E1. `/panel/przyjecia` — Odbiory paczek**
- Cel: klient widzi kiedy Kickback odebrał jego paczkę
- Layout: lista chronologiczna „Twoja oferta #… → Kurier odebrał 12.06 → W drodze do magazynu → Odebrana 15.06 → A&QC w toku". Każdy event = ikona + tekst + timestamp. Timeline vertical z lime dot dla done, hollow dot dla pending.

**E2. `/panel/wydania` — Wydania (wysyłki wychodzące)**
- Cel: co jest wysyłane do kupujących z Twoich koszulek (klient widzi kiedy jego towar zostawia magazyn)
- Layout: tabela `SKU` `Klub` `Kupujący` `Kurier` `Status` (`Przygotowano / Wysłano / Doręczono / Zwrot`) `Tracking`

**E3. `/panel/fulfillment` — Workflow wysyłki**
- Cel: koszulka sprzedana → co się dalej dzieje. Klient patrzy real-time.
- Layout: hero z 4-step tracker (`Pakowanie → Wysyłka → Tranzyt → Dostawa`), każdy step z timestampem + ikoną. Aktywny step w gradient lime. Poniżej detale kuriera + tracking iframe placeholder.

**E4. `/panel/zwroty` — Zwroty**
- Cel: kupujący zwrócił koszulkę → co dalej
- Layout: tabela zwrotów z powodem + statusem obsługi. Empty state: „Nic. Twoje koszulki nie wracają."

**E5. `/panel/zmiany-ceny` — Historia zmian cen**
- Cel: log kto/kiedy zmienił cenę której koszulki (klient sam sobie, admin?, promocja auto?)
- Layout: chronologiczna lista z avatar (klient/admin/system) + „Zmniejszono z 2 400 na 2 100 zł" + powód. Filter po produkcie.

**E6. `/panel/uks` — UKS / Program lojalnościowy**
- Cel: TBD — może „Ulubione Klienta Score" — punkty za sprzedaże/wysyłki/aktywność
- Layout: hero gamification card z avatar, level (`Level 4 · Kolekcjoner Retro`), progress bar do następnego levelu, lista wyzwań („Sprzedaj 3 koszulki Realu → +200 punktów"), leaderboard opcjonalnie w tle blur (grywalizacja subtelna, nie casino)

**E7. `/panel/analityka` + `/panel/stats` — Analityka klienta**
Zaprojektuj dwa różne widoki:
- `/panel/analityka` — deep dive charts: sales over time (12 miesięcy line), average sale price trend (per typ klubu), commission earned per klub (bar sorted desc), size distribution donut, top performing pieces list top-10
- `/panel/stats` — bardziej dashboard skrót — 6 KPI cards + 1 duży wykres + 1 lista

### GRUPA F — Admin: Operacje (11)

**F1. `/admin` — Dashboard admina**
- Cel: overview back-office
- Layout: 
  - Header „Poranek. 12 nowych ofert w kolejce."
  - KPI cards: `A&QC do zrobienia (14)` `Sprzedaże dziś (5)` `Do wypłaty klientom (8)` `Alerty (2)` — każdy z lime ring jeśli > 0, czerwony jeśli krytyczny
  - „Kolejka A&QC" lista 5 najstarszych + CTA „Idź do kolejki"
  - „Ostatnie ruchy" timeline (jak klient B1 ale z admin akcjami)
  - „Aktywni klienci" mini leaderboard top 5

**F2. `/admin/inbox` — Inbox**
- Cel: wszystkie komunikaty od klientów (chat / ticket)
- Layout: 3-kolumn (jak email client) — lewa lista wątków z avatar+preview+timestamp+unread badge, środek konwersacja (bubbles klient szary lewy / admin lime prawy), prawa panel klienta (info, aktywne oferty)

**F3. `/admin/submissions` — Oferty przychodzące**
- Cel: kolejka nowych ofert klientów do przetworzenia
- Layout: tabela + toolbar bulk actions („Zaakceptuj wszystkie z klub X"). Rzędy: `Klient` `Oferta` `Wartość szac.` `Wiek zgłoszenia` (chip red jeśli > 24h) `Status` `Actions` (Podgląd, Do A&QC, Odrzuć).

**F4. `/admin/offers` + `/admin/offers/[id]` — Kontr-oferty**
- Cel: admin proponuje cenę per pozycja
- Layout listy: `Klient` `Pozycja` `Oferta klienta` `Nasza kontr` `Status` (`Waiting/Accepted/Rejected/Countered back`) `Wysłano temu`
- Layout `[id]`: split screen — lewa panel klienta + jego oferta, prawa formularz nowej kontr-oferty z historią zmian propozycji

**F5. `/admin/aqc` — Kolejka A&QC**
- Cel: koszulki fizycznie przybyły, admin robi Authentication & Quality Check
- Layout: 
  - Filter chips (Nowe / W trakcie / Passed / Failed / Pending review)
  - Grid 3-kolumn karty koszulek: duże zdjęcie + klient + wiek w kolejce (pill red > 3 dni) + CTA `Rozpocznij A&QC`
  - Empty state: „Kolejka pusta. Kawa?"

**F6. `/admin/aqc/[id]` — Widok A&QC pojedynczej koszulki**
- Cel: pełen inspection tool
- Layout:
  - Górna sekcja: 4-column grid zdjęć referencyjnych (klient wysłał)
  - Sekcja checklisty A&QC — lista z toggle switch: `Legit crest ✓` `Legit patch ✓` `Legit stitching ✓` `Legit tag ✓` `Rozmiar zgodny ✓` `Stan (A/B/C)` `Retro ✓` — każdy toggle z tooltipem instrukcji
  - Panel oceny stanu: slider 1-10 + textarea „Uwagi audytora"
  - Verdict box: 3 duże przyciski `Pass` (mint gradient) `Fail` (coral) `Counter-offer` (blue) — konfirmacja modal przed submitem

**F7. `/admin/qr` + `/admin/qr/[id]` — Etykiety QR**
- Cel: printable etykiety z QR + SKU na magazyn
- Layout listy: tabela produktów z status „Wymaga etykiety / Wydrukowano", batch print CTA
- Layout `[id]`: printable A4 sheet preview z 10 etykiet 60×30mm (jak Kickback Etykiety), duży CTA „Wydrukuj PDF"

**F8. `/admin/returns` — Zwroty admin**
- Cel: obsługa zwrotów od kupujących
- Layout: tabela `Zwrot#` `Koszulka` `Klient (komisant)` `Kupujący` `Powód` `Status obsługi` `Akcja`. Kolumna „Akcja" = dropdown „Przyjmij zwrot / Odrzuć / Wystaw ponownie"

### GRUPA G — Admin: Klienci & CRM (4)

**G1. `/admin/klienci` — Lista klientów**
- Cel: wszyscy komisanci
- Layout: tabela z kolumnami `Klient` (avatar + name) `Typ` (B2C/B2B pill) `Aktywne` (5) `Sprzedane` (12) `LTV` (34 500 zł) `Ostatnia aktywność` `Actions`. Search + filter po typie + range LTV.

**G2. `/admin/klienci/[id]` — Profil klienta**
- Cel: 360° widok jednego klienta
- Layout: hero z avatar + name + kontakty + pill B2B/B2C + KPI row (aktywne/sprzedane/LTV/średnia cena), tabs `Oferty / Sprzedaże / Wypłaty / Komunikacja / Notatki`, tab content jako tabela lub timeline

**G3. `/admin/crm` — CRM lista**
- Cel: aktywności sales/relacje z klientami (leady spoza produktu)
- Layout: kanban 4 kolumny (`Nowy → W kontakcie → Ofertowanie → Aktywny klient → Nieaktywny`) — karty draggable z klient info + ostatnią akcją + timeline count

**G4. `/admin/crm/[klient_id]` — Detal CRM**
- Cel: cała historia relacji
- Layout: split — lewa lista aktywności (touchpoints: call/email/spotkanie/oferta), prawa notatki + tasks + tagi kategorii + duży „Dodaj aktywność" primary CTA

### GRUPA H — Admin: CMS & Ustawienia (6)

**H1. `/admin/co-warto-dodac` — CMS: Co warto dodać**
- Cel: admin publikuje karty featurowane na `/panel/plany`
- Layout: 
  - Kompaktowy formularz na górze („Nowa karta") z polami: tytuł, opis, kategoria, priority (radio: high/medium/low), image_url, cta_label, cta_href, active toggle, expires_at datepicker
  - Poniżej tabela istniejących cardów z toggle active/inactive + edit drawer + delete
  - Preview panel prawy — live preview jak karta wygląda w kliencie

**H2. `/admin/zapotrzebowanie` — CMS: Zapotrzebowanie**
- Cel: publikacja WTB ogłoszeń, edycja, bulk import CSV
- Layout:
  - Formularz „Nowe ogłoszenie" z rodzajem (radio pills: Klub/Reprezentacja/Nazwisko), typeaheadem katalogu, sezonem, retro toggle, `sizes` jako toggle-pill grid, target_price, notes (public + admin)
  - `Bulk import z CSV` accordion collapsible z formatem + textarea + parser preview + import CTA
  - Sekcja `Aktywne ogłoszenia` (X) — tabela z inline `Edytuj / Wyłącz`
  - Sekcja `Archiwum` (Y) — muted opacity 60%, `Aktywuj` CTA per row

**H3. `/admin/zmiany-ceny` — Log zmian cen (admin)**
- Cel: audit trail wszystkich zmian cen w całym systemie
- Layout: tabela z filter po produkcie, klientcie, dacie. Kolumny: `Timestamp` `Kto` (klient/admin/system avatar+name) `Produkt` `Z → Na` (`2 400 zł → 2 100 zł` z red/green arrow) `Powód` (tekst wolny) `Kanał` (`Manual/Promo/Sale`).

**H4. `/admin/payouts` — Wypłaty admin**
- Cel: kolejka wypłat do zrealizowania + potwierdzenia realizacji
- Layout: 
  - Toolbar: filter `Do zrealizowania (X) / Zaplanowane / Zrealizowane / Odrzucone`
  - Tabela z checkbox bulk select: `Klient` `Kwota` `Metoda` `Termin` `Akcja` (per row: `Zrealizuj / Odrzuć / Zaplanuj`)
  - Sticky bulk action bar dolny gdy zaznaczone: `Zbiorczo zrealizuj X szt. na łączną kwotę Y zł` primary CTA

**H5. `/admin/integrations/fakturownia` — Integracja Fakturownia**
- Cel: konfiguracja webhooka + monitor eventów
- Layout:
  - Sekcja `Status` — 3 karty: `API Key ustawiony ✓/✗`, `Webhook secret ustawiony ✓/✗`, `Endpoint dostępny (200) ✓/✗`. Karta z copy-to-clipboard webhook URL.
  - Sekcja `Warehouse mappings` — tabela `Klient → Fakturownia warehouse ID` z formularzem add/remove
  - Sekcja `Recent events` — tabela ostatnich 50 webhooków z status pillem (`processed / failed / skipped / replayed`) + expand row → payload JSON viewer + `Replay` CTA per failed
  - Sekcja `Push queue` — kolejka pushy do Fakturowni po A&QC pass, każdy row z `Retry` CTA

**H6. `/admin/audit` — Audit log**
- Cel: pełen event log systemu (dla compliance/debug)
- Layout: chronologiczna lista event boxów z ikoną kategorii (auth/product/payout/webhook) + JSON payload collapsible + filter po actor, kind, timerange. Poszukiwarka full-text.

**H7. `/admin/stats` — Statystyki adminowe**
- Cel: KPI całego biznesu
- Layout: 8 KPI cards top row (revenue/GMV/orders/avg price/active clients/AQC pass rate/return rate/payout latency) + duży wykres revenue over time + drill-down tabs (`Wg. klubu / Wg. sezonu / Wg. klienta / Wg. rozmiaru`)

---

## 7. Cross-cutting decisions (spójność)

**Loading states** — nie spinners generyczne. Każda karta w loading = skeleton `bg-surface-2` z pulse subtle. Wykresy w loading = ghost linia lime opacity 20%. Duże strony w loading = fullscreen z Kickback logo z lime glow (już mamy — trzymamy).

**Error states** — coral banner top strony z ikoną + krótkim tekstem + CTA `Spróbuj ponownie`. Nigdy raw stack trace w UI (poza `/admin/audit`).

**Search patterns** — CMD+K global search palette (modal) na desktop + top search bar mobile. Search grupuje wyniki po `Klienci / Produkty / Oferty / Sprzedaże`. Ikonka + label + skrót klawiszowy widoczny.

**Copy tone (polski)** — krótkie, bezpośrednie, minimalna aluzja piłkarska tam gdzie pasuje („Ofsajd na tej pozycji" jako error kod dla wycofanej koszulki jest OK, ale nie przesadzać). Nigdy angielski w mikrotekstach.

**Data formatting** — kwoty PLN z separatorem tysięcznym i bez groszy przy > 100 zł (`2 400 zł`), z groszami przy < 100 zł (`89,50 zł`). Daty krótko (`12 cze`, `12 cze 2025`), długie w tooltipach. Numer produktu SKU zawsze monospace (`IBM Plex Mono`).

**Accessibility** — WCAG 2.2 AA. Contrast text vs bg minimum 4.5:1 (sprawdź `text-mute #7B7F7B` na `bg-base` — ~4.6, ok). Focus rings zawsze lime `outline: 2px solid #66FF33; outline-offset: 2px`. Target sizes min 44×44. Nawigacja klawiaturą pełna.

**Motion (spójne dla wszystkich)**
- Zmiana strony fade+slide 6px, 200ms cubic-bezier(.4,0,.2,1)
- Hover na karcie: `translateY(-2px)` + shadow grow, 180ms
- Pigułka po kliknięciu: mikroscale 0.98 dla 80ms
- Drawer/modal slide-in 240ms cubic-bezier(.32,.72,0,1)
- Tylko `transform` i `opacity` (nigdy `transition-all`)

**Light mode** — projektujemy TAKŻE light mode (jest toggle w `/panel/ustawienia`). Zasada: light mode nie jest inverted dark. Light mode = `bg-base #F7F8F5` (kremowy off-white), text `#0F1210`, akcent lime pozostaje `#66FF33` ale mint staje się bardziej `#0D9F55` (ciemniejszy dla kontrastu). Sekcja design system musi mieć dark i light side-by-side.

---

## 8. Deliverable — co ma wyjść z Figmy

1. **Design system page** — pełen component sheet z tokenami, wszystkie warianty, dark + light side by side
2. **58 ekranów desktop 1440** — pogrupowane wg. grup A-H, każda strona nazwana `[grupa][numer] · nazwa` (np. `C4 · Panel · Magazyn`)
3. **58 ekranów mobile 390** — te same strony, mobile-first responsive layouty
4. **Kluczowe stany per strona** — dla najważniejszych ekranów (dashboard, magazyn, submission detail, aqc detail) dodatkowo: loading state, empty state, error state jako osobne frames
5. **Motion spec** — 1 strona z tabelą motion tokens (duration/easing/property) + 3 mini prototypes (page transition, drawer open, toast)
6. **Handoff notes** — 1 strona z uwagami dla developera (Next.js/Tailwind — nazwy klas do users, mapowanie tokenów CSS variables)

---

## 9. Ograniczenia i decyzje

- **Nie kopiuj** rakiet, lasów, biosfer z FocusFlow. Nasze keyvisuals to koszulki + herby.
- **Nie wprowadzaj** żadnego dodatkowego brand koloru poza tokenami z sekcji 2 (yellow/blue/coral to jedyne uzupełnienie greenów).
- **Nie używaj** default Tailwind palette (indigo, sky, teal, emerald) — mamy własne heksy.
- **Nie miksuj** ikon solid i outline w jednym kontekście. Zdecyduj: cały panel Phosphor regular albo cały Lucide.
- **Nie stosuj** `shadow-md` z Tailwind — cienie muszą być kolorowe (lime/mint tinted) i wielowarstwowe.
- **Jedna kropka** na końcu H1 (jak FocusFlow: „Dashboard.", „Contacts.", „Zapotrzebowanie.") — to nasz podpis typograficzny.

---

## 10. Pytania kontrolne przed startem (odpowiedz sobie sama zanim zaczniesz)

1. Czy dark mode i light mode dają ten sam feeling „premium, spokojny, precyzyjny" — czy light nie skończył się jako „generic e-commerce"?
2. Czy każda strona ma jasny primary CTA? (jeden — nie dwa równoległe)
3. Czy statusy pigułkowe są konsystentne w całym panelu (ten sam kolor = ten sam concept)?
4. Czy typografia trzyma się skali (Display XL → Display L → H1 → H2 → H3 → Body → Label → Meta) — bez losowych rozmiarów pomiędzy?
5. Czy mobile 390 nie jest tylko „desktop pomniejszony" — ma dedykowany bottom-tab + FAB + full-screen sheets?
6. Czy każda tabela ma zdefiniowany empty/loading/error state?
7. Czy klient vs admin są wizualnie odróżnialne (mała czerwona kropka w logo admina, label „ADMIN" w topbarze)?

---

**Referencje wizualne (folder z screenami FocusFlow do wglądu):**
`/Users/kubanrth/Documents/CLAUDE_CODE/JARVIS-WEB/temporary screenshots/focusflow/`

Zawartość:
- `df1452…png` — brand keyvisual (rakieta / logo w ramce)
- `31beaa…png` — pełen dashboard preview (sidebar + document branches list + create-branch drawer)
- `fe5092…png` — sekcja „About product" z komponentami wyciętymi (task card, tasks sidebar, primary CTA gradient)
- `f8f152…png` — spec typografii (nazwa fontu Lufga, line-height 116%, letter-spacing -1%)
- `e85876…png` — paleta kolorów (yellow / lime / mint / emerald gradient / whites / darks)
- `c7d58a…png` — keyvisual atmosferyczny (light rays w lesie — dla mood boardu)
- Pozostałe `*.png` — dodatkowe moduły ze strony Behance

Zapytaj admina projektu (mnie) jeśli chcesz zobaczyć konkretną istniejącą stronę Kickback w obecnym designie — screenshoty pokazuję na życzenie.
