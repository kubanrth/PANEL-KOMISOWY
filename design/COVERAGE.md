# Pokrycie designów vs trasy aplikacji (stan 2026-07-02)

Źródło designów: `design/Kickback panel redesign (1)/` — 53 widoki + Design System + Sidebary + fonty Lufga (OTF).

## Pokryte (52 trasy)

| Design | Trasa | Design | Trasa |
|---|---|---|---|
| A2 Login | /login | E7b Statystyki | /panel/stats |
| A3 Rejestracja | /register | F1 Queue | /admin |
| A4 Onboarding | /onboarding | F2 Inbox | /admin/inbox |
| A5 Start | /start | F3 Submissions | /admin/submissions |
| A6 Formularz partnera | /q/[slug] | F4 Offers | /admin/offers + [id] |
| A7 Potwierdzenie | /q/[slug]/sent | F5 AQC kolejka | /admin/aqc |
| B1 Dashboard | /panel | F6 AQC inspekcja | /admin/aqc/[id] |
| B2 Co warto dodać | /panel/plany | F7 Generator QR | /admin/qr + [id] |
| B3 Zapotrzebowanie | /panel/zapotrzebowanie | F8 Returns | /admin/returns |
| B4 Promocje | /panel/promocje | G1 Klienci | /admin/klienci |
| B5 Powiadomienia | /panel/notifications | G2 Profil klienta | /admin/klienci/[id] |
| C1 Oferty | /panel/submissions | G3 CRM | /admin/crm |
| C2 Szczegół oferty | /panel/submissions/[id] | G4 CRM detal | /admin/crm/[klient_id] |
| C3 Kontr-oferta | /panel/offers/[productId] | H1 Co warto dodać CMS | /admin/co-warto-dodac |
| C4 Magazyn | /panel/magazyn | H2 Zapotrzebowanie CMS | /admin/zapotrzebowanie |
| C6 Sprzedaże | /panel/sprzedaze | H3 Zmiany cen admin | /admin/zmiany-ceny |
| C8 Karta produktu | /panel/products/[id] | H4 Payouts | /admin/payouts |
| C9 Wycofanie | /panel/products/[id]/withdraw (+archiwum → /panel/komis-wyciagniety) | H5 Fakturownia | /admin/integrations/fakturownia |
| D1 Portfel | /panel/wallet | H6 Audit log | /admin/audit |
| D2 Faktury | /panel/faktury | H7 Statystyki admin | /admin/stats |
| D3 Wypłaty | /panel/wyplaty | L1 Light Dashboard | motyw light |
| D4 Umowa | /panel/umowa | L2 Light Magazyn | motyw light |
| D6 Dane | /panel/dane | M1-M6 Mobile | 6 kluczowych widoków 390px |
| D7 Ustawienia | /panel/ustawienia | Sidebary | PanelShell + AdminShell |
| E1 Przyjęcia | /panel/przyjecia | Design System | tokeny + komponenty |
| E2 Wydania | /panel/wydania | | |
| E3 Fulfillment | /panel/fulfillment | | |
| E4 Zwroty | /panel/zwroty | | |
| E5 Zmiany cen | /panel/zmiany-ceny | | |
| E6 Lojalność | /panel/uks | | |
| E7a Analityka | /panel/analityka | | |

## Braki (4 trasy — pochodne, do zrobienia z Design Systemu)

1. **/landing** (A1) — appka i tak przekierowuje `/` na login/panel; landing dostaje styl z A2 + hero. Niski priorytet, ostatnia kolejność.
2. **/panel/inventory** (C5) — minimalny widok eksportu CSV/XLSX; layout = karta z 2 CTA wg Design Systemu.
3. **/panel/my-sales** (C7) — agregat sprzedażowy; komponuję z E7a (wykresy) + C6 (tabela).
4. **/panel/warunki** (D5) — artykuł typograficzny; layout = D4 Umowa bez panelu podpisu.

## Decyzja do potwierdzenia

B1 ma 2 warianty layoutu — **przyjmuję 1a (ops-first)** jako obowiązujący (rekomendacja z planu). Jeśli wolisz 1b (portfolio-first z hero portfela) — powiedz, zanim skończy się Faza 4.
