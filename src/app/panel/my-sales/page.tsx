import { redirect } from "next/navigation";

/**
 * Legacy EN route — superseded by /panel/sprzedaze (Faza 2 implementation
 * with 11-column spec, status badges, settlement dates).
 */
export default function MySalesRedirect() {
  redirect("/panel/sprzedaze");
}
