/* Cennik wysyłek fulfillment (grosze) — widoczny dla komisanta przy
   zleceniu, zapisywany w shipping_cost_cents i potrącany z wypłaty.
   ponytail: stałe stawki w kodzie — przenieść do ustawień admina,
   gdy będą negocjowane stawki per kurier. */

export const FULFILLMENT_COSTS = {
  /** Własna etykieta komisanta — pakujemy i nadajemy bez opłaty. */
  label_provided: 0,
  /** Kurier DPD/InPost na adres. */
  courier: 19_99,
  /** Paczkomat InPost. */
  paczkomat: 13_99,
} as const;

export type DeliveryMethod = "courier" | "paczkomat";
