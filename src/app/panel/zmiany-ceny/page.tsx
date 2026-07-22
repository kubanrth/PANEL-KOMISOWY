import { redirect } from "next/navigation";

/* Zakładka scalona z Magazynem (2026-07-13) — sugestie cen są pod tabelą. */
export default function ZmianyCenyRedirect() {
  redirect("/panel/magazyn");
}
