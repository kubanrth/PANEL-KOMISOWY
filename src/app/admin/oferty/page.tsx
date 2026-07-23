import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { OfferDecision } from "./OfferDecision";
import { formatPLN, formatDate, plural } from "@/lib/format";
import type { Photo } from "@/lib/types";

/* Oferty produktowe (segment 1) — nowe oferty towarowo-cenowe od komisantów.
   Decyzja per produkt: akceptacja ceny oczekiwanej / kontroferta / odrzucenie.
   „Do decyzji" = produkt z intake bez ustalonej ceny listingowej. */

type Row = {
  id: string;
  brand: string;
  model: string;
  size: string | null;
  sku: string;
  condition: number | null;
  expected_price_cents: number | null;
  photos: Photo[] | null;
  created_at: string;
  submission_id: string;
  submissions:
    | { id: string; klient_id: string; commission_rate: number; profiles?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null }
    | { id: string; klient_id: string; commission_rate: number; profiles?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null }[]
    | null;
};

export default async function AdminOfertyPage() {
  const { supabase } = await requireAdmin();

  const { data: rowsRaw } = await supabase
    .from("products")
    .select("id, brand, model, size, sku, condition, expected_price_cents, photos, created_at, submission_id, submissions!inner ( id, klient_id, commission_rate, profiles:klient_id ( first_name, last_name ) )")
    .is("listing_price_cents", null)
    .in("status", ["draft", "aqc"])
    .order("created_at", { ascending: true });

  const rows = (rowsRaw ?? []) as unknown as Row[];

  // Grupowanie po submission — decyzje podejmuje się per paczka.
  const groups = new Map<string, { klient: string; commission: number; items: Row[] }>();
  for (const r of rows) {
    const sub = Array.isArray(r.submissions) ? r.submissions[0] : r.submissions;
    if (!sub) continue;
    const prof = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
    const g = groups.get(r.submission_id) ?? {
      klient: [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "—",
      commission: sub.commission_rate,
      items: [],
    };
    g.items.push(r);
    groups.set(r.submission_id, g);
  }

  return (
    <>
      <PageHeader
        label={`${rows.length} ${plural(rows.length, ["pozycja", "pozycje", "pozycji"])} do decyzji`}
        title="Oferty produktowe"
        sub="Nowe oferty towarowe od komisantów. Zaakceptuj cenę oczekiwaną, złóż kontrofertę albo odrzuć pozycję — klient dostaje powiadomienie od razu."
      />

      <section className="mt-8 space-y-8">
        {groups.size === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-10 text-center text-text-soft">
            Brak ofert do decyzji — wszystkie pozycje mają ustaloną cenę.
          </div>
        ) : (
          Array.from(groups.entries()).map(([subId, g]) => (
            <div key={subId}>
              <div className="flex items-baseline justify-between mb-3 gap-4 flex-wrap">
                <div className="text-[13px] text-text-soft">
                  <Link href={`/admin/submissions/${subId}`} className="num text-text hover:text-lime transition-colors">{subId}</Link>
                  {" · "}{g.klient}{" · prowizja "}{Math.round(g.commission * 100)}%
                </div>
                <div className="text-[12px] text-text-mute">{g.items.length} {plural(g.items.length, ["pozycja", "pozycje", "pozycji"])}</div>
              </div>
              <div className="space-y-3 kb-stagger">
                {g.items.map((p) => (
                  <div key={p.id} className="card p-5 flex flex-wrap items-center gap-4">
                    <ProductThumb photos={p.photos as never} brand={p.brand} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[15px] truncate">{p.brand} · {p.model}</div>
                      <div className="mt-1 text-[12px] text-text-mute num">
                        {p.sku}{p.size ? ` · ${p.size}` : ""}{p.condition ? ` · stan ${p.condition}/10` : ""} · {formatDate(p.created_at)}
                      </div>
                    </div>
                    <div className="text-right mr-2">
                      <div className="text-[11px] text-text-mute">Oczekiwana</div>
                      <div className="font-semibold text-[16px] num">{formatPLN(p.expected_price_cents ?? 0, { decimals: false })}</div>
                    </div>
                    <OfferDecision productId={p.id} />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
