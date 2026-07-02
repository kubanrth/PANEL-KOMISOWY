# Sidebar redesign — panel klienta + panel admina (FocusFlow style)

Do wygenerowania: **2 kompletne sidebary** (klient + admin), oba w tym samym języku wizualnym FocusFlow (patrz [PROMPT-CLAUDE-DESIGN.md](./PROMPT-CLAUDE-DESIGN.md) sekcja 4.5 + refs w [refs-focusflow/](./refs-focusflow/)).

**Kontekst:** obecny sidebar klienta pokazany na screenie ma dobry wzorzec (chevron expandable, colored dots, numeric badges), ale mieści tylko 6 pozycji — reszta 25+ tras klienta zwisa poza nawigacją. Sidebar admina jest jeszcze w starym designie (fioletowy accent, flat lista). **Cel: obie nawigacje w jednym wzorcu FocusFlow, ze wszystkimi trasami zmapowanymi do sensownych sekcji z podsekcjami tam gdzie się to opłaca.**

---

## 1. Wzorzec bazowy (dla obu paneli)

**Kontener sidebar:**
- Szerokość desktop `260px`, sticky top-0, `bg-bg-base` z 1px prawą krawędzią `border-border`
- Padding: `p-4`, gap między sekcjami `mb-6`
- Bottom sticky group (avatar + ustawienia + logout) przybity do dołu z `mt-auto`

**Header sidebara:**
- Logo Kickback 32×32 rounded-[10px] w kolorze marki + label „Kickback" (light 15px)
- Prawy górny: collapse chevron button 32×32 rounded-[10px] `bg-surface-2`
- Pod loga: minitekst 11px `text-text-mute` — u klienta „Panel komisanta", u admina „Admin operacyjny" z małą czerwoną kropką 6×6 przed tekstem

**Section header (uppercase label):**
```
OPERACJE                          ← 11px, tracking +0.08em, text-text-mute
─────────
```
Bez tła, bez chevron — tylko label + subtle divider `border-border-soft` pod nią (opcjonalnie). Wysokość ~24px, margin-bottom 8px.

**Item bazowy (top-level, bez subitems):**
```
[ icon ][ label                        ][ badge ]
```
- Height `44px`, rounded-`[12px]`, padding-x `16px`
- Icon: 20×20 line-icon w kwadratowej ramce `40×40 rounded-[10px] bg-surface-2` PO LEWEJ jeśli item ważny (Przegląd, Magazyn, Portfel — bo tak jest w screenie 3), LUB bez ramki tylko 20×20 icon dla mniej ważnych (Zapotrzebowanie, Co warto dodać). Zdecyduj konsystentnie: **ikona z ramką dla top-4 items, bez ramki dla reszty**.
- Label: 14px `font-medium`, `text-text` idle, `text-lime` aktywny
- Badge: prawa strona — okrągła pill 22×22 `bg-surface-2 rounded-full text-11 text-text-mute` z liczbą, LUB colored dot 8×8 dla „coś jest nowe" (mint=nowa aktywność, yellow=warning, coral=alert)

**Item ze subsections (chevron expandable):**
```
[ ^ ][ icon ][ label                   ][ count badge ]
        │
        ├─ ● subitem 1                  [count]
        ├─ ● subitem 2                  [count]
        └─ ● subitem 3                  [count]
```
- Chevron 20×20 rounded-`[10px]` `bg-surface-2` PO LEWEJ (przed ikoną) — jak w screenie 3
- Rotacja chevron 90° gdy expanded
- Container expanded: `bg-surface/60 rounded-[14px] p-2` obejmujący header + subitems
- Subitem: `pl-8 h-9 text-13 text-text-soft` z 8×8 colored dot po lewej
  - Dot color = semantyka statusu (mint dla sprzedanych/wypłaconych, blue dla w obiegu, lime dla nowych/aktywnych, yellow dla oczekujących, coral dla problemów)

**Stan aktywny:**
- Item: `bg-surface-2` + 3px lime lewa krawędź (rounded na 12px) + tekst `text-lime` + ikona `text-lime`
- Subitem: label bold + tekst `text-text` + dot 100% opacity (idle 60%)
- Bardzo delikatny lime glow pod aktywnym (opcjonalnie): `box-shadow: inset 2px 0 12px #66FF3315`

**Hover:**
- Item idle → `bg-surface-2/60`, transition 180ms
- Subitem → `text-text` + dot 100% opacity

**Collapsed state (desktop):**
- Sidebar 72px szeroki, tylko ikony centered, tooltip na hover z labelem + badge

**Mobile:**
- Sidebar zamknięty — hamburger w topbarze otwiera full-screen sheet-from-left z tą samą strukturą. Cała treść scrollable, sticky header + bottom group.

---

## 2. PANEL KLIENTA — pełna struktura sidebara

Header: `Kickback` + subtitle „Panel komisanta"

### Bez sekcji — item singular top
- **Przegląd** — icon: grid, badge: —, route: `/panel`
  - _Aktywny w screenie 3 (zielona ramka ikony) — trzymamy._

### SEKCJA: SPRZEDAŻ
- **Oferty** — icon: inbox, badge count all: `21`, expandable, route: `/panel/submissions`
  - ● **W obiegu** (blue dot) — count `9` — route: `/panel/submissions?status=in_progress`
  - ● **Draft** (mute dot) — count `2` — route: `/panel/submissions?status=draft`
  - ● **Sprzedane** (mint dot) — count `12` — route: `/panel/sprzedaze` (albo tab wewnątrz Oferty)
  - ● **Wypłacone** (mint dot) — route: `/panel/sprzedaze?paid=1`
  - ● **Odrzucone** (coral dot, ukryj jeśli 0) — route: `/panel/submissions?status=rejected`
- **Magazyn** — icon: box, badge: `34`, expandable, route: `/panel/magazyn`
  - ● **W sprzedaży** (lime dot) — route: `/panel/magazyn?status=listed`
  - ● **Zarezerwowane** (blue dot) — route: `/panel/magazyn?status=reserved`
  - ● **Wycofane z komisu** (mute dot) — route: `/panel/komis-wyciagniety`
  - _Sub-item „Eksport" jako link ghost pod (Pobierz CSV/XLSX)_ — route: `/panel/inventory`
- **Zwroty** — icon: rotate-ccw, badge: dot mute jeśli >0, route: `/panel/zwroty`
- **Zmiany cen** — icon: chart-line-down, route: `/panel/zmiany-ceny`

### SEKCJA: FINANSE
- **Portfel** — icon: wallet, badge: żółta kropka (są środki do wypłaty), expandable, route: `/panel/wallet`
  - ● **Dostępne do wypłaty** (mint dot) — tekst live „8 240 zł" w subitem (nie badge)
  - ● **W rozliczeniu** (yellow dot) — count `3`
  - ● **Historia wypłat** — route: `/panel/wyplaty`
  - ● **Faktury** — route: `/panel/faktury`
- **Program lojalnościowy** — icon: star, route: `/panel/uks`
  - _(Jeśli włączony flagą — jeśli nie, ukryj cały item)_

### SEKCJA: OPERACJE
- **Przyjęcia** — icon: package-arrow-in, badge count aktywnych, route: `/panel/przyjecia`
- **Wydania** — icon: package-arrow-out, route: `/panel/wydania`
- **Fulfillment** — icon: truck, route: `/panel/fulfillment`
  - _(Fulfillment może być scalony z Wydania — decyzja: zostaw osobno bo pokazuje tracker per przesyłka, Wydania to lista.)_

### SEKCJA: INSIGHTS
- **Zapotrzebowanie** — icon: target, badge: `5`, route: `/panel/zapotrzebowanie`
- **Co warto dodać** — icon: sparkles, badge: lime dot jeśli nowe od ostatniej wizyty, route: `/panel/plany`
- **Promocje** — icon: percent, route: `/panel/promocje`
- **Analityka** — icon: chart-line, expandable, route: `/panel/analityka`
  - ● **Dashboard** — route: `/panel/stats`
  - ● **Deep dive** — route: `/panel/analityka`
  - ● **My sales** — route: `/panel/my-sales`

### BOTTOM STICKY GROUP (przybite do dołu)
- **Notyfikacje** — icon: bell, badge: yellow dot jeśli unread, route: `/panel/notifications`
- **Ustawienia** — icon: cog, expandable
  - ● **Dane** — route: `/panel/dane`
  - ● **Preferencje** — route: `/panel/ustawienia`
  - ● **Umowa** — route: `/panel/umowa`
  - ● **Warunki** — route: `/panel/warunki`
- **Avatar dropdown** — 32×32 avatar + email truncated + chevron → mini menu (Wyloguj, Pomoc, Kontakt z opiekunem)

---

## 3. PANEL ADMINA — pełna struktura sidebara

Header: `Kickback` + subtitle „Admin operacyjny" z czerwoną kropką 6×6 (visual differentiator vs. klient)

**Ważne:** pozycje z pilnymi zadaniami mają czerwoną liczbę zamiast szarej pill (`bg-coral/15 text-coral`) — np. „A&QC 14" jeśli > 10 w kolejce.

### Bez sekcji
- **Queue** — icon: dashboard, route: `/admin`
  - _(To główny dashboard adminowski — zostaje sam na górze.)_

### SEKCJA: OPERACJE
- **Inbox** — icon: mail, badge: unread count (czerwony jeśli >5), route: `/admin/inbox`
- **Submissions** — icon: inbox, badge count all, expandable, route: `/admin/submissions`
  - ● **Nowe** (blue dot) — count nowych 24h — route: `/admin/submissions?status=new`
  - ● **W obiegu** (yellow dot) — count starszych >24h — route: `/admin/submissions?status=in_progress`
  - ● **Zaakceptowane** (mint dot) — route: `/admin/submissions?status=accepted`
  - ● **Odrzucone** (coral dot) — route: `/admin/submissions?status=rejected`
- **A&QC** — icon: shield-check, badge (czerwony jeśli >10), expandable, route: `/admin/aqc`
  - ● **Kolejka** (blue dot) — count oczekujących
  - ● **Passed** (mint dot)
  - ● **Failed** (coral dot)
  - ● **Do rewizji** (yellow dot)
- **Offers (Zerr)** — icon: handshake, badge, expandable, route: `/admin/offers`
  - ● **Wysłane** (blue dot) — czekają na akceptację klienta
  - ● **Zaakceptowane** (mint dot)
  - ● **Odrzucone** (coral dot)
  - ● **Kontr-oferty klienta** (yellow dot) — klient odpisał inną ceną
- **Returns** — icon: rotate-ccw, badge active, route: `/admin/returns`
- **Generator QR** — icon: qr-code, badge lime dot jeśli są produkty bez etykiety, route: `/admin/qr`

### SEKCJA: RELACJE
- **Klienci** — icon: users, badge: total count, expandable, route: `/admin/klienci`
  - ● **Aktywni** (mint dot)
  - ● **B2B** (blue dot) — filter
  - ● **B2C** (mute dot) — filter
  - ● **Nieaktywni 90d** (yellow dot)
- **CRM** — icon: kanban, expandable, route: `/admin/crm`
  - ● **Leady** (blue dot)
  - ● **W kontakcie** (lime dot)
  - ● **Ofertowanie** (yellow dot)
  - ● **Nieaktywni** (mute dot)

### SEKCJA: WORKFLOW / CMS
- **Zapotrzebowanie** — icon: target, badge: aktywne count, route: `/admin/zapotrzebowanie`
- **Co warto dodać** — icon: sparkles, badge: aktywne count, route: `/admin/co-warto-dodac`
- **Zmiany cen** — icon: chart-line-down, route: `/admin/zmiany-ceny`
- **Promocje admin** — icon: percent, route: `/admin/promocje` _(jeśli nie istnieje — dopisz do backloga, ale slot rezerwuję)_

### SEKCJA: FINANSE
- **Wypłaty** — icon: banknote, badge count do realizacji (czerwony jeśli >20), expandable, route: `/admin/payouts`
  - ● **Do zrealizowania** (yellow dot)
  - ● **Zaplanowane** (blue dot)
  - ● **Zrealizowane** (mint dot)
  - ● **Odrzucone** (coral dot)

### SEKCJA: INTEGRACJE & SYSTEM
- **Fakturownia** — icon: file-text, badge: dot health (mint = OK, yellow = warnings, coral = failed events), route: `/admin/integrations/fakturownia`
- **Audit log** — icon: file-lines, route: `/admin/audit`
- **Statystyki** — icon: chart-bar, route: `/admin/stats`

### BOTTOM STICKY GROUP
- **Notyfikacje admin** — icon: bell, badge: unread
- **← Panel klienta** — icon: user-switch (arrow-left), tekst „Panel klienta" — powrót do widoku klienta (jeśli admin ma też konto klienta), route: `/panel`
- **Avatar dropdown** — 32×32 avatar admina + email + chevron → (Wyloguj, Konto, Preferencje, Pomoc)

---

## 4. Zasady projektowania (decyzje architektoniczne)

**A. Kiedy expandable, kiedy nie?**
Sekcja jest expandable **tylko jeśli** ma minimum 3 sensowne subpodziały (statusy, filtry, wewnętrzne widoki). Poniżej 3 — spłaszcz do top-level. Nie robimy expandable dla samej estetyki.

**B. Kolory dot subitemów = spójna semantyka w całej apce**
- **mint (`#22DD99`)** — pozytywne, zakończone, wypłacone, sprzedane, aktywne
- **lime (`#66FF33`)** — nowe, świeże, akcja rekomendowana
- **blue (`#4A6BFF`)** — w toku, oczekujące na następny krok, information
- **yellow (`#FFCC00`)** — uwaga, oczekuje twojego działania, retro/warning
- **coral (`#FF5A47`)** — problem, odrzucone, failed
- **mute (`#7B7F7B`)** — nieaktywne, archiwum, historia

Klient i admin używają identycznego mapowania kolorów — subitem „Sprzedane" u klienta ma mint dot i „Zaakceptowane" u admina ma mint dot. Konsystencja.

**C. Badge counts — kiedy pokazywać liczbę, kiedy dot, kiedy nic**
- **Liczba w pill** — gdy count > 0 I użytkownik ma coś do zrobienia z tą liczbą (14 A&QC do przetworzenia). Format: `bg-surface-2 text-text-mute` normalnie, `bg-coral/15 text-coral` gdy krytyczne (>threshold — do zdefiniowania per sekcja).
- **Colored dot 8×8** — gdy jest sygnał „coś się dzieje" ale liczba nieważna (nowa notyfikacja, są środki do wypłaty).
- **Nic** — dla stron które są zawsze dostępne bez konkretnego stanu (Analityka, Ustawienia, Regulamin).

**D. Zwijanie sekcji (memory)**
Stan expanded/collapsed każdego expandable itemu **zapisz w localStorage per user**. Ktoś rozwinął „Oferty" — trzyma się rozwinięte po przeładowaniu. „Wypłaty" zwinął — pozostaje zwinięte. Default state: pierwsza sekcja (Sprzedaż u klienta, Operacje u admina) rozwinięta, reszta collapsed.

**E. Nawigacja klawiaturą (a11y)**
- Tab moves fokus item-by-item w sidebarze
- Enter/Space toggluje expand
- Arrow up/down move fokus (jak w listbox pattern)
- `/` fokusuje search w topbarze
- Escape zamyka expanded item (albo zamyka mobile sheet)

**F. Search w sidebarze (nowy element)**
Nad sekcją „Przegląd" (klient) / „Queue" (admin) — cienki input `h-9 bg-surface-2 rounded-[10px] px-3` z ikoną szkła + placeholder „Szukaj…" + skrót klawiszowy `⌘K` po prawej. Klik → global CMD+K palette (wyszukuje strony sidebara, klientów, produkty, oferty). Nie duplikuje topbar search — jeśli topbar ma search, ten w sidebarze jest opcjonalny; jeśli sidebar ma, topbar zostaje minimalny (tylko breadcrumb + bell + avatar).

**G. Wersja admin — visual differentiator**
Nie wystarczy sam label „ADMIN". Dodaj:
- Czerwoną kropkę 6×6 obok „Admin operacyjny" pod logo
- Napis „ADMIN" jako pill `bg-coral/10 text-coral border-coral/25 h-5 px-2 rounded-full text-10 uppercase tracking-wider` obok logo Kickback
- Cały header sidebara (górne ~80px) delikatny coral tint w tle: `bg-gradient-to-b from-coral/[.03] to-transparent`

**H. Bottom sticky group — separator**
Wyraźny 1px `border-border` divider nad bottom group + `pt-3 mt-3`. Klient i admin bottom group różnią się: klient ma „Ustawienia (Dane/Preferencje/Umowa/Warunki)", admin ma „← Panel klienta" jako pierwszą pozycję (switch context).

---

## 5. Warianty do narysowania (checklist Figma)

Zaprojektuj każdy sidebar w **4 stanach** side-by-side:

1. **Default expanded desktop 260px** — jedna sekcja rozwinięta z aktywnym itemem
2. **Collapsed desktop 72px** — tylko ikony centered, tooltip na hover
3. **Mobile sheet 100vw** — full-screen z sticky header + scrollable body + sticky bottom
4. **Aktywny item w każdej sekcji** — pokazać jak wygląda aktywny stan we wszystkich sekcjach (klient i admin) — nie robić jednego frame'a per aktywny, wystarczą 2-3 kluczowe przykłady

Dodatkowo pokazać:
- **Hover state** na sekcji zwiniętej (chevron rotuje, background lift)
- **Expanded z aktywnym subitem** (widać oba stany naraz — parent nie jest aktywny, subitem tak)
- **Alert state** (`A&QC` z coral badge, `Wypłaty` >20 z coral badge)
- **Dot indicators** (żółta kropka na Portfel, lime kropka na Co warto dodać)

---

## 6. Deliverable

- 2 sidebary (klient + admin) × 4 warianty = **8 frame'ów Figma**
- Component sheet: **Sidebar Item**, **Sidebar Item Expandable**, **Sidebar Subitem**, **Sidebar Section Header**, **Sidebar Header (branding)**, **Sidebar Bottom Group** — jako reusable components z propsami/variants (state: idle/hover/active, count: number/dot/none, dot-color: 6 kolorów, expandable: bool)
- **Nazwy klas Tailwind** obok każdego elementu jako dev handoff nota

---

## 7. Czego NIE robić

- Nie zostawiaj fioletowego akcentu ze starego admin sidebara — cały sidebar admina to ten sam lime green accent co u klienta, jedynie header ma coral differentiator (patrz G)
- Nie duplikuj wszystkich linków top-level bez subitems — jeśli sekcja ma tylko 1 item, wyrzuć sekcję i zostaw item jako standalone
- Nie mieszaj ikon solid + line — cały stack Phosphor Regular albo Lucide, konsystentnie
- Nie robisz „Wyloguj" jako top-level itemu — Logout jest tylko w avatar dropdown menu (jak w screenie 3 wzorzec bottom group)
- Nie rozwijaj domyślnie więcej niż jednej sekcji — pierwsze wejście = jedna otwarta, reszta collapsed

---

## 8. Screeny referencyjne do wysłania z tym promptem

Załącz razem z tym plikiem:
- Screen 1 (obecny admin sidebar — pełny) — jako _„do zastąpienia"_
- Screen 2 (obecny admin sidebar — dolna część) — dopełnienie
- Screen 3 (nowy klient sidebar) — jako _„styl bazowy do rozszerzenia"_
- `refs-focusflow/02-dashboard-full-desktop.png` — FocusFlow sidebar wzorzec 1:1
- `refs-focusflow/03-komponenty-taskcard-cta-sidebar.png` — komponenty wycięte

Powiedz Claude Design: „**trzymaj się kolorystyki i mikroelementów ze screenu 3 (klient) — chevron w kwadratowej ramce, ikona z lime glow w kwadratowej ramce, colored dots przy subitemach — i rozszerz strukturę o wszystkie pozycje z sekcji 2 i 3 tego briefu**".
