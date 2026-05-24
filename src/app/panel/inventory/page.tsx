import { redirect } from "next/navigation";

/**
 * Legacy EN route — superseded by /panel/magazyn (Faza 2 implementation).
 * Kept as a 308 redirect so old links / bookmarks still work.
 */
export default function InventoryRedirect() {
  redirect("/panel/magazyn");
}
