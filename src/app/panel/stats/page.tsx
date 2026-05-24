import { redirect } from "next/navigation";

/**
 * Legacy EN route — superseded by /panel/analityka (Faza 5 implementation
 * with 6 widgets: sales, rotation, simulator, recommendations, prices,
 * inventory snapshot chart).
 */
export default function StatsRedirect() {
  redirect("/panel/analityka");
}
