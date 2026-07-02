# Kickback panel — budowa pozostałych widoków w nowym stylu

Kontynuacja projektu. Design system + dashboard klienta + sidebary są GOTOWE i zatwierdzone.
Ten prompt służy do zbudowania **wszystkich pozostałych widoków** — batch po batchu, w idealnej zgodzie z tym co już powstało.

---

## BLOK A — kontekst do wklejenia na początku KAŻDEJ rozmowy (master context)

Wklej to zawsze, potem doklej jeden batch z sekcji „BLOK B".

```
Projektujesz kolejne widoki panelu komisowego Kickback (luksusowy komis koszulek
piłkarskich, Polska). Istnieje już zatwierdzony Design System, dashboard klienta
i sidebary — załączam je jako HTML/screeny. Twoim zadaniem jest zbudować kolejne
widoki w 100% tym samym języku wizualnym. NIE wymyślaj nowych tokenów, komponentów
ani stylów — wszystko czego potrzebujesz już istnieje w Design Systemie.

== TOKENY (wyciągnięte z gotowego Design Systemu — używaj dokładnie tych) ==

Powierzchnie (dark):
  bg-base #050807 · bg-soft #0A0D0B · surface #0F1210 · surface-2 #16191A · surface-3 #1D2120

Tekst:
  primary #F5F5F3 · soft #BDBFBD · mute #7B7F7B · faint #4A4E4B

Akcenty:
  lime #66FF33 (primary accent, active nav, focus)
  mint #22DD99 (success, sprzedane, wypłacone)
  gradient CTA: linear-gradient(135deg, #6ECC1F 0%, #22DD99 100%)
  blue #4A6BFF (w toku, informacja) · yellow #FFCC00 (uwaga, oczekuje)
  coral #FF5A47 (błąd, odrzucone) · amber #F5A623 (retro tag)
  ciemne tinty pod pigułki: #05140B (mint bg), #1D2A3A (blue bg), #3A1D24 (coral bg)

Typografia:
  Lufga, 'Plus Jakarta Sans', system-ui — nagłówki Light/Regular, line-height 116%,
  letter-spacing -0.01em (body), -0.02em (H1/H2). H1 kończy się kropką („Portfel.").
  Liczby/SKU/daty w tabelach: IBM Plex Mono. Uppercase labels: 11-12px,
  tracking +0.08em do +0.16em, kolor mute.

Radiusy:
  pills 999px · small chips 9px · inputy + małe karty 14px · karty 20px · nav items 11-12px

Ikony: Phosphor Regular (web font, klasa ph ph-*) — nigdy solid, nigdy inny zestaw.

Motion (zdefiniowane keyframes — używaj tych samych nazw):
  kb-in (fade+slide 8px) · kb-drawer (slide z prawej 34px) · kb-modal (scale .96)
  kb-fade · kb-pulse (skeleton) · kb-shim (shimmer) — tylko transform i opacity.

== GOTOWE KOMPONENTY (z Design Systemu — komponuj z nich) ==

- Buttony: primary gradient pill / secondary surface-2 / ghost / danger coral / icon-only
- Pigułki statusowe (vocab): mint=sprzedane,wypłacone · blue=w obiegu,A&QC · lime=aktywne
  · yellow=oczekuje,do decyzji · coral=odrzucone,failed · mute=draft,archiwum
  Format: kropka 6px + UPPERCASE 10-11px + tinted bg + border w kolorze /25
- Inputy: surface-2, radius 14, focus lime ring; label uppercase nad polem
- KPI card: label uppercase mute → duża liczba (mono lub Lufga) → sparkline lime + delta pill
- Karta aktywności (timeline row): kwadratowy avatar-badge 40px z literą/herbem →
  tytuł + timestamp mono → pigułka statusu po prawej; wyróżniona pozycja = gradient
  lime→mint tło z ciemnym tekstem
- Tabela: header uppercase 11px mute, rzędy h-56+ z border-soft, hover surface-2/40,
  kolumny num w IBM Plex Mono, akcje po prawej (ghost ikony)
- Empty state: dashed border, ikona w ramce, nagłówek, 1 zdanie, primary CTA
- Drawer prawy 480px (kb-drawer) · Modal centered (kb-modal) · Toast z lewym paskiem
- Sidebar: gotowy w załączniku „Sidebary klient + admin" — na każdym widoku pokazuj
  właściwy sidebar z poprawnie podświetloną aktywną pozycją
- Top bar: breadcrumb (Panel / Nazwa) · search pill centralny „Szukaj koszulki, klubu,
  klienta…" ⌘K · po prawej: gradient CTA „+ Nowa oferta" (tylko klient), bell, theme
  toggle, avatar MK z chevronem

== ZASADY ==

1. Każdy widok = pełny screen desktop 1440, dark, z sidebar + top bar + content.
2. Placeholdery danych: kluby piłkarskie (Real Madryt, AC Milan, FC Barcelona, Legia
   Warszawa, Juventus, Polska), sezony (2011/12, 2006/07, EURO 2016), ceny w zł
   z separatorem tysięcznym, SKU format KCB-26-XXXXXX (mono).
3. Język: 100% polski. Krótkie, bezpośrednie microcopy.
4. H1 strony zawsze z kropką na końcu + mały uppercase label NAD H1.
5. Pokazuj REALNE stany: przynajmniej jeden widok w batchu ma dodatkowo empty state
   albo wyróżniony wiersz/alert — nie tylko happy path.
6. Nie dodawaj sekcji, których nie ma w spececyfikacji widoku. Nie „ulepszaj" layoutu
   dashboardu — kompozycja gęstości jak w zatwierdzonym B1.
7. Jeden plik HTML per widok (self-contained, te same fonty i Phosphor z CDN).
```

**Załączniki do każdej rozmowy:** `Kickback Design System.dc.html` + `Kickback · B1 Dashboard klienta.dc.html` + `Kickback · Sidebary klient + admin.dc.html` (albo screeny z nich, jeśli platforma nie przyjmuje HTML).

**Decyzja przed startem:** w B1 są 2 warianty dashboardu (1a ops-first gęsty / 1b portfolio-first z hero portfela). Napisz w pierwszej wiadomości który obowiązuje — reszta widoków ma trzymać jego gęstość i rytm.

---

## BLOK B — batche widoków (wklejaj po jednym na rozmowę)

Kolejność ułożona tak, żeby najpierw powstały widoki najczęściej używane i o największej liczbie wspólnych komponentów. Po każdym batchu: przejrzyj, zgłoś poprawki, dopiero potem następny.

---

### BATCH 1 — Klient: Magazyn + karta produktu + sprzedaże (fundament tabel)

```
Zbuduj 3 widoki klienta:

1. /panel/magazyn — „Magazyn." (34 produkty w komisie)
   - Filter bar nad tabelą: chip-filters (Wszystkie / W sprzedaży / Zarezerwowane /
     Wstrzymane), select Klub, select Sezon, range ceny, toggle Retro, toggle
     widoku Tabela ↔ Karty
   - Tabela: SKU (mono) · miniatura 40×40 · Klub · sezon · rozmiar · Stan (A/B/C
     jako mała pigułka) · Cena (mono) · Prowizja % · Status (pigułka vocab) ·
     Dni w sprzedaży · akcje (oko → drawer, tag → zmiana ceny)
   - Widok kart (pokaż jako drugi frame): grid 4 kolumny, zdjęcie 1:1 dark studio,
     spec, cena, status
   - Drawer podglądu produktu (trzeci frame): otwarte na jednym produkcie — galeria
     thumbnails, spec lista, historia cen mini-sparkline, akcje Zmień cenę /
     Wycofaj z komisu (danger ghost)
   - Jeden wiersz tabeli z yellow pigułką „WSTRZYMANE" (odróżnienie stanów)

2. /panel/products/[id] — karta produktu pełna strona
   - Breadcrumb Panel / Magazyn / KCB-26-A9F421
   - Layout 60/40: lewo galeria 6 zdjęć z thumbnails; prawo: H1 z nazwą („Real
     Madryt 2011/12."), pigułka statusu, spec-lista (klub/sezon/rozmiar/stan/retro),
     duża cena z historią zmian (expandable), timeline statusów pionowy
     (Przyjęta → A&QC pass → Wystawiona → …), CTA: Zmień cenę (secondary) +
     Wycofaj z komisu (danger ghost)

3. /panel/sprzedaze — „Sprzedaże."
   - KPI row: Sprzedane łącznie · W tym miesiącu · Suma prowizji · Śr. cena
   - Tabela grupowana nagłówkami miesięcy („Czerwiec 2026 — 3 szt · 8 400 zł"),
     kolumny: SKU · produkt · cena finalna · prowizja · data (mono) · status
     wypłaty (pigułka: W ROZLICZENIU yellow / DO WYPŁATY mint / WYPŁACONE mute)
   - Ostatni frame: empty state „Jeszcze nic nie sprzedałeś. Wystaw pierwszą koszulkę."
```

### BATCH 2 — Klient: Finanse (Portfel + wypłaty + faktury)

```
Zbuduj 3 widoki klienta (sidebar: sekcja FINANSE aktywna):

1. /panel/wallet — „Portfel."
   - Hero card z gradientem ciemny mint (jak wariant 1b dashboardu): „DOSTĘPNE DO
     WYPŁATY" 8 240 zł (display, mono lub Lufga Light 56px) + CTA gradient „Wypłać
     teraz" + ghost „Historia"
   - Obok 2 KPI: W rozliczeniu 2 340 zł (yellow dot) · Wypłacone łącznie 14 800 zł
   - Tabela transakcji: data (mono) · typ (pigułka: SPRZEDAŻ mint / WYPŁATA blue /
     KOREKTA amber) · produkt · kwota (mono, +zielona / –coral) · saldo po (mono)
   - Prawy panel: metoda wypłaty (IBAN maskowany •••• 4921 + Edytuj), przełącznik
     faktura VAT/bez VAT
   - Drugi frame: modal „Wypłać środki" (kb-modal) — kwota, metoda, podsumowanie,
     CTA gradient

2. /panel/wyplaty — „Wypłaty."
   - Sticky KPI top „Łącznie w tym roku: 14 800 zł"
   - Lista/tabela: data zlecenia · kwota (mono) · metoda · status pigułka
     (ZLECONA blue / W REALIZACJI yellow / ZREALIZOWANA mint / ODRZUCONA coral)
   - Jeden wiersz odrzucony z tooltipem powodu

3. /panel/faktury — „Faktury."
   - Filter po roku/miesiącu (chips), tabela: numer (mono) · okres · typ
     (prowizja/wypłata) · kwota · pobierz PDF (ghost icon)
   - Górny prawy: secondary CTA „Pobierz zbiorczo za rok"
```

### BATCH 3 — Klient: Oferty (submissions) + kontr-oferta

```
Zbuduj 3 widoki klienta (sidebar: Oferty aktywne):

1. /panel/submissions — „Oferty."
   - Taby: Wszystkie (21) / Draft (2) / W obiegu (9) / Sprzedane (12) / Odrzucone
   - Tabela: numer KCB (mono) · data · liczba pozycji · wartość szacowana ·
     status pigułka · chevron → detail
   - Prawy górny: gradient CTA „+ Nowa oferta"
   - Drugi frame: empty state dla taba Draft

2. /panel/submissions/[id] — szczegół oferty
   - H1 „Oferta KCB-26-C1D8." + pigułka statusu + pozioma oś kroków (Wysłana →
     Odebrana → A&QC → Wystawiona) z lime kropkami done / hollow pending
   - Lista pozycji jako accordion: każda pozycja = miniatura + nazwa + rozmiar +
     status pigułka per pozycja; jedna rozwinięta z 6 thumbnailami zdjęć + spec
   - Prawy panel: kontakt z Kickback (mini-thread), umowa PDF (ghost download),
     notatki

3. /panel/offers/[productId] — kontr-oferta (kluczowy ekran decyzji)
   - Split 50/50: lewa karta „Twoja propozycja" 3 500 zł (przekreślona, mute);
     prawa karta z gradientem lime→mint „Nasza kontr-oferta" 3 100 zł (ciemny
     tekst na gradiencie) + uzasadnienie od Kickback (2 zdania)
   - Pod spodem: countdown „Oferta ważna jeszcze 6 dni" (mono) + 2 CTA:
     „Akceptuję 3 100 zł" (gradient primary) / „Proponuję inną cenę" (secondary)
   - Drugi frame: stan po akceptacji — mint toast + pigułka ZAAKCEPTOWANA
```

### BATCH 4 — Klient: Insights (zapotrzebowanie, co warto dodać, promocje, notyfikacje)

```
Zbuduj 4 widoki klienta:

1. /panel/zapotrzebowanie — „Zapotrzebowanie."
   - Filter chips: Wszystkie / Kluby / Reprezentacje / Nazwiska + toggle Tylko retro
   - Grid 3 kolumny kart (wzór z prawej kolumny dashboardu B1): avatar-badge z
     literą klubu · nazwa · typ · sezon · pigułki rozmiarów (S M L — blue) ·
     „do 2 500 zł" (mint, mono) · data publikacji (faint) · amber tag RETRO
     gdzie trzeba
   - CTA-karta na dole: „Masz pasującą koszulkę? → Nowa oferta"

2. /panel/plany — „Co warto dodać."
   - Toggle: Wszystkie / Kuratorowane / Sugestie
   - Grid 3 kolumny: karta z obrazkiem 4:3 (dark placeholder koszulki), pigułka
     priorytetu (WYSOKI lime / ŚREDNI blue / NISKI mute), tytuł, 1 zdanie,
     ghost CTA „Dodaj do oferty", mikrotekst „Wygasa za 12 dni"
   - Drugi frame: empty state „Wszystko już masz."

3. /panel/promocje — „Promocje."
   - Hero banner gradient z dużym tekstem promocji (np. „Prowizja 10% do niedzieli")
   - Lista 3-4 mniejszych bannerów z ikoną + okresem ważności + pigułką AKTYWNA
   - Prawy panel „Twoje aktywne bonusy"

4. /panel/notifications — „Powiadomienia."
   - Filter chips: Wszystkie / Nieprzeczytane / Sprzedaże / Wypłaty / System
   - Lista chronologiczna: ikona w ramce · treść · timestamp mono · nieprzeczytane
     mają lime dot i bg-surface delikatnie jaśniejszy
   - Drugi frame: empty state
```

### BATCH 5 — Klient: Operacje (przyjęcia, wydania, fulfillment, zwroty, zmiany cen, wycofania)

```
Zbuduj 6 widoków klienta (mogą być kompaktowe — to widoki pomocnicze):

1. /panel/przyjecia — „Przyjęcia." — pionowy timeline per oferta: Kurier odebrał →
   W drodze → Przyjęta do magazynu → A&QC; lime dot done, hollow pending,
   timestampy mono
2. /panel/wydania — „Wydania." — tabela: SKU · produkt · kurier · tracking (mono,
   kopiowalne) · status pigułka (PRZYGOTOWANE mute / WYSŁANE blue / DORĘCZONE mint
   / ZWROT coral)
3. /panel/fulfillment — „Fulfillment." — hero tracker 4 kroków (Pakowanie → Wysyłka
   → Tranzyt → Dostawa) z aktywnym krokiem na gradiencie; poniżej karta kuriera +
   szczegóły przesyłki
4. /panel/zwroty — „Zwroty." — tabela zwrotów z powodem i statusem; główny frame
   to EMPTY STATE („Nic. Twoje koszulki nie wracają.") bo to najczęstszy stan
5. /panel/zmiany-ceny — „Zmiany cen." — timeline: avatar-badge kto (TY / KICKBACK /
   PROMOCJA) · „2 400 zł → 2 100 zł" (strzałka coral przy obniżce, mint przy
   podwyżce, mono) · powód · data
6. /panel/products/[id]/withdraw + /panel/komis-wyciagniety — jeden frame z formularzem
   wycofania (yellow banner ostrzegawczy o koszcie 50 zł + adres + data + CTA)
   i drugi frame z tabelą archiwum wycofanych
```

### BATCH 6 — Klient: Analityka + lojalność + ustawienia

```
Zbuduj 5 widoków klienta:

1. /panel/analityka — „Analityka." — pełny widok wykresów w stylu sekcji „Dane,
   spokojnie" z Design Systemu: line chart sprzedaży 12 mies (lime, area fill),
   bar chart prowizji per klub, donut rozkładu rozmiarów z center label,
   lista top-10 najlepszych sztuk
2. /panel/stats — „Statystyki." — 6 KPI cards + 1 duży wykres + 1 lista (skrót)
3. /panel/uks — „Program lojalnościowy." — hero gamification: level LEVEL 4 ·
   KOLEKCJONER RETRO (uppercase mono), progress bar gradient do następnego levelu,
   3 karty wyzwań z progresem, subtelnie — bez casyna
4. /panel/dane — „Twoje dane." — 2 sekcje formularzy (osobowe / firmowe B2B z
   toggle), sticky save bar na dole pojawiający się przy zmianie
5. /panel/ustawienia + umowa + warunki — jeden widok ustawień z sekcjami:
   Powiadomienia (toggle per kanał), Bezpieczeństwo (zmiana hasła), Motyw
   (Dark/Light/System segmented control); do tego drugi frame: /panel/umowa
   (preview dokumentu + Pobierz PDF + banner „Czeka aneks do podpisu")
```

### BATCH 7 — Admin: Queue + Submissions + A&QC (serce back-office)

```
Zbuduj 4 widoki ADMINA (sidebar admin z coral „ADMIN” pill, wg załącznika):

1. /admin — „Queue."
   - Nagłówek operacyjny „Poranek. 12 nowych ofert w kolejce."
   - KPI row: A&QC do zrobienia (14, coral ring bo >10) · Sprzedaże dziś (5) ·
     Wypłaty do realizacji (8) · Alerty (2, coral)
   - Kolejka A&QC: 5 najstarszych kart z wiekiem w kolejce + CTA „Idź do kolejki"
   - Timeline ostatnich ruchów systemu + mini leaderboard top 5 klientów

2. /admin/submissions — „Submissions."
   - Filter taby: Nowe / W obiegu / Zaakceptowane / Odrzucone
   - Tabela z checkbox bulk: klient (avatar+nazwa) · numer · pozycje · wartość ·
     wiek zgłoszenia (chip coral gdy >24h) · status · akcje
   - Sticky bulk bar na dole przy zaznaczeniu („3 zaznaczone — Zaakceptuj / Odrzuć")

3. /admin/aqc — „A&QC." — kolejka
   - Filter chips: Nowe / W trakcie / Passed / Failed / Do rewizji
   - Grid 3 kolumny kart: zdjęcie koszulki, klient, wiek w kolejce (pigułka coral
     >3 dni), CTA „Rozpocznij A&QC"
   - Drugi frame: empty state „Kolejka pusta. Kawa?"

4. /admin/aqc/[id] — widok inspekcji (najbardziej gęsty ekran admina)
   - Górna sekcja: grid 4 zdjęć referencyjnych od klienta
   - Checklista z toggle switches: crest / patch / stitching / tag / rozmiar /
     stan — każdy z ikoną check lime po zaznaczeniu
   - Ocena stanu: segmented A/B/C + slider 1-10 + textarea uwag audytora
   - Verdict box na dole: 3 duże przyciski PASS (gradient mint) / FAIL (coral) /
     KONTR-OFERTA (blue) — z modalem potwierdzenia (drugi frame z otwartym modalem)
```

### BATCH 8 — Admin: Offers + Returns + QR + Inbox

```
Zbuduj 4 widoki ADMINA:

1. /admin/offers + /admin/offers/[id] — „Offers (Zerr)." — tabela ofert (klient ·
   pozycja · propozycja klienta · nasza kontra · status · wiek) + drugi frame:
   detail split z historią negocjacji (thread propozycji cen jak chat) i
   formularzem nowej kontr-oferty
2. /admin/returns — „Returns." — tabela zwrotów: numer · koszulka · komisant ·
   kupujący · powód · status obsługi · akcja dropdown (Przyjmij / Odrzuć /
   Wystaw ponownie)
3. /admin/qr — „Generator QR." — tabela produktów bez etykiety z checkbox bulk +
   CTA „Drukuj zaznaczone"; drugi frame: podgląd arkusza A4 z 10 etykietami
   60×30mm (SKU mono + QR + klub/sezon/rozmiar)
4. /admin/inbox — „Inbox." — 3-kolumnowy layout email-client: lista wątków
   (avatar, preview, unread lime dot) · konwersacja (bąbelki: klient surface-2
   lewo, admin gradient ciemny mint prawo) · panel klienta (dane + aktywne oferty)
```

### BATCH 9 — Admin: Klienci + CRM

```
Zbuduj 4 widoki ADMINA:

1. /admin/klienci — „Klienci." — tabela: avatar+nazwa · typ (B2B blue / B2C mute
   pill) · aktywne szt. · sprzedane szt. · LTV (mono) · ostatnia aktywność ·
   akcje; search + filter typ + sortowanie po LTV
2. /admin/klienci/[id] — profil 360°: hero z avatarem, kontaktami, pigułką typu +
   KPI row (aktywne/sprzedane/LTV/śr. cena) + taby (Oferty / Sprzedaże / Wypłaty /
   Komunikacja / Notatki) z zawartością pierwszego taba
3. /admin/crm — „CRM." — kanban 5 kolumn (Nowy → W kontakcie → Ofertowanie →
   Aktywny → Nieaktywny), karty z nazwą, ostatnią akcją, liczbą touchpointów;
   nagłówki kolumn z countem
4. /admin/crm/[klient_id] — detal relacji: lewa kolumna timeline touchpointów
   (call/email/spotkanie z ikonami Phosphor) · prawa: notatki, tagi, zadania,
   CTA „Dodaj aktywność"
```

### BATCH 10 — Admin: CMS + Wypłaty

```
Zbuduj 4 widoki ADMINA:

1. /admin/zapotrzebowanie — „Zapotrzebowanie." (CMS)
   - Formularz „Nowe ogłoszenie": radio-pills rodzaju (Klub/Reprezentacja/Nazwisko),
     typeahead z katalogu, sezon, retro toggle, rozmiary jako toggle-pills grid,
     cena docelowa, notatki (publiczne + wewnętrzne w 2 kolumnach)
   - Accordion „Bulk import z CSV" (zwinięty, widać nagłówek)
   - Tabela Aktywne (z inline akcjami Edytuj / Wyłącz) + sekcja Archiwum (opacity
     60%, akcja Aktywuj)
   - Drugi frame: otwarty drawer edycji wpisu
2. /admin/co-warto-dodac — „Co warto dodać." (CMS) — formularz karty (tytuł, opis,
   kategoria, priorytet radio, obrazek URL, CTA label+href, aktywna toggle,
   wygasa datepicker) + tabela istniejących + prawy panel LIVE PREVIEW karty
   tak jak zobaczy ją klient
3. /admin/payouts — „Wypłaty." — filter taby (Do zrealizowania / Zaplanowane /
   Zrealizowane / Odrzucone), tabela z checkbox bulk, sticky bulk bar
   „Zrealizuj 4 wypłaty · 9 820 zł" (gradient CTA)
4. /admin/zmiany-ceny — „Zmiany cen." — globalny audit: tabela timestamp (mono) ·
   kto (avatar-badge KLIENT/ADMIN/SYSTEM) · produkt · 2 400 → 2 100 zł (strzałka
   kolorowa) · powód · kanał
```

### BATCH 11 — Admin: Integracje + Audit + Stats

```
Zbuduj 3 widoki ADMINA:

1. /admin/integrations/fakturownia — „Fakturownia."
   - Status row: 3 karty (API key ✓ mint / Webhook secret ✓ mint / Endpoint 200 ✓)
     + karta z webhook URL (mono, przycisk kopiuj)
   - Sekcja Warehouse mappings: tabela klient → warehouse ID + formularz add
   - Sekcja Recent events: tabela 50 webhooków — status pigułka (PROCESSED mint /
     FAILED coral / SKIPPED mute / REPLAYED blue), expandable JSON payload
     (mono, surface-3), CTA Replay przy failed
   - Sekcja Push queue z Retry per item
   - Jeden event FAILED rozwinięty z JSON — pokazać jak wygląda
2. /admin/audit — „Audit log." — chronologiczna lista event boxów: ikona kategorii
   (auth/product/payout/webhook) · opis · actor · timestamp mono · collapsible
   payload; górny filter bar (actor, typ, zakres dat) + search
3. /admin/stats — „Statystyki." — 8 KPI top (revenue/GMV/liczba/śr. cena/aktywni/
   AQC pass rate/return rate/payout latency) + duży wykres revenue (lime area) +
   taby drill-down (Wg klubu / sezonu / klienta / rozmiaru) z bar chartem
```

### BATCH 12 — Publiczne + auth

```
Zbuduj 6 widoków publicznych (BEZ sidebara — standalone, wycentrowane na bg-base
z radial lime glow w tle):

1. /login — karta 480px: logo, email, hasło, CTA gradient „Zaloguj", ghost
   „Nie pamiętam hasła", przełącznik na magic link
2. /register — 2 kroki z progress dots (email+hasło → imię+telefon)
3. /onboarding — wizard 4 kroki z progress bar gradient na górze: dane osobowe →
   adres → konto bankowe → typ konta (B2C/B2B karty do wyboru); sticky footer
   Wstecz/Dalej — pokaż krok 3
4. /start — formularz oferty guest: sekcje Koszulka (selecty) / Zdjęcia (dropzone
   z 6 slotami, 2 wypełnione thumbnailami) / Kontakt / Adres odbioru + CTA
5. /q/[slug] — to samo co /start ale z nagłówkiem partnera i prawym sidebar
   „Co się dzieje po wysłaniu?" (4 kroki z ikonami)
6. /q/[slug]/sent — potwierdzenie: check w kole gradient, „Odebrane.", numer
   KCB-26-C1D8 (mono, kopiowalny), „Odezwiemy się w 24h", ghost CTA
```

### BATCH 13 — Mobile 390 (kluczowe widoki) + light mode (próbka)

```
1. Mobile 390 dla 6 najważniejszych widoków: dashboard klienta, magazyn (widok
   kart), portfel, kontr-oferta, A&QC inspekcja (admin), queue (admin).
   Wzorzec mobile: top bar 56px (logo+hamburger+avatar), bottom tab bar 68px
   (Przegląd / Oferty / [FAB + Nowa oferta gradient 56px] / Portfel / Więcej),
   drawer→bottom sheet z drag handle. Sidebar mobile już zaprojektowany —
   spójność z nim.
2. Light mode — 2 widoki próbne (dashboard + magazyn): bg #F7F8F5, tekst #0F1210,
   lime zostaje #66FF33 tylko na ciemnych elementach, mint ciemnieje do #0D9F55,
   karty białe z subtelnym borderem. NIE odwrócony dark — zaprojektowany na nowo
   z tych samych tokenów. Jeśli light wygląda „generic e-commerce" — iteruj.
```

---

## BLOK C — kontrola jakości po każdym batchu

Po otrzymaniu widoków sprawdź (i odeślij poprawki zanim przejdziesz dalej):

1. Sidebar ma podświetloną WŁAŚCIWĄ pozycję dla danego widoku?
2. Pigułki statusów używają dokładnie vocabu z Design Systemu (ten sam kolor = to samo znaczenie wszędzie)?
3. Wszystkie liczby, SKU, daty, kwoty w IBM Plex Mono?
4. H1 z kropką + uppercase label nad nim?
5. Każda tabela ma pokazany hover/wyróżniony wiersz i (gdzie zlecono) empty state?
6. Zero nowych kolorów spoza tokenów? Zero ikon spoza Phosphor Regular?
7. Gęstość zgodna z zatwierdzonym wariantem dashboardu (nie luźniej, nie ciaśniej)?

Typowe wady do wyłapania: wymyślone gradienty na kartach zwykłych (gradient jest TYLKO na primary CTA, hero portfela i wyróżnionej pozycji timeline), losowe radiusy, angielskie microcopy, mieszanie wag fontu w tabelach.

---

## Status projektu (stan na 2026-07-02)

GOTOWE ✓
- Design System (pełny: tokeny, buttony, pigułki, inputy, karty, sidebar/topbar/taby, tabele, wykresy, empty states)
- B1 Dashboard klienta (2 warianty: 1a ops-first, 1b portfolio-first) — desktop dark
- Sidebary klient + admin (default / collapsed / mobile / expanded + dev handoff)

DO ZROBIENIA → batche 1-13 powyżej (~50 widoków desktop + 6 mobile + 2 light)
