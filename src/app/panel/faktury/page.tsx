import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill, type PillVariant } from "@/components/panel/StatusPill";
import { Button } from "@/components/ui/Button";
import { formatPLN, formatDate } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { UploadForm } from "./UploadForm";

/* Faktury — redesign: chip-filtry roku/miesiąca (prezentacyjne, filtrują
   już pobraną listę), tabela numer·okres·typ·kwota·status·pobierz. */

type Filters = { year?: string; month?: string };

const TYPE_LABEL: Record<Invoice["type"], string> = {
  faktura_vat: "Faktura VAT",
  uks: "UKS",
  inne: "Inne",
};

/* Vocab: mint=zweryfikowana, yellow=oczekuje, coral=odrzucona. */
const STATUS_VARIANT: Record<Invoice["status"], PillVariant> = {
  verified: "mint",
  uploaded: "yellow",
  rejected: "coral",
};

const STATUS_LABEL: Record<Invoice["status"], string> = {
  verified: "Zweryfikowana",
  uploaded: "Oczekuje weryfikacji",
  rejected: "Odrzucona",
};

const MONTHS_PL = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];
const MONTHS_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function periodOf(inv: Invoice): Date {
  return new Date(inv.issued_at ?? inv.uploaded_at);
}

export default async function FakturyPage(props: { searchParams: Promise<Filters> }) {
  const sp = await props.searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: invoicesRaw } = await supabase
    .from("invoices")
    .select("*")
    .eq("klient_id", user.id)
    .order("uploaded_at", { ascending: false });
  const invoices = (invoicesRaw ?? []) as Invoice[];

  const verifiedValue = invoices
    .filter((i) => i.status === "verified")
    .reduce((a, i) => a + (i.amount_cents ?? 0), 0);
  const pendingCount = invoices.filter((i) => i.status === "uploaded").length;

  // Chip-filtry roku/miesiąca — filtrują już pobraną listę (bez zmian w query).
  const years = Array.from(new Set(invoices.map((i) => periodOf(i).getFullYear()))).sort((a, b) => b - a);
  let visible = invoices;
  if (sp.year) visible = visible.filter((i) => periodOf(i).getFullYear() === Number(sp.year));
  const monthsPresent = Array.from(new Set(visible.map((i) => periodOf(i).getMonth()))).sort((a, b) => a - b);
  if (sp.month) visible = visible.filter((i) => periodOf(i).getMonth() === Number(sp.month) - 1);

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="faktury"
      breadcrumb={[{ label: "Faktury i rozliczenia" }]}
    >
      <PageHeader
        label={`${invoices.length} dokumentów rozliczeniowych`}
        title="Faktury i rozliczenia"
        sub="Wgraj fakturę VAT albo skan UKS — administrator zweryfikuje dokument i odblokuje środki w portfelu."
        action={
          /* ponytail: brak endpointu zbiorczego eksportu — CTA nieaktywne do
             czasu backendu (aktywować, gdy powstanie akcja generująca ZIP/rok). */
          <Button variant="ghost" size="md" disabled title="Wkrótce — zbiorczy eksport w przygotowaniu" className="disabled:opacity-45 disabled:pointer-events-none">
            Pobierz zbiorczo za rok
          </Button>
        }
      />

      <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Łącznie dokumentów" value={invoices.length} />
        <KpiCard
          label="Oczekuje weryfikacji"
          value={pendingCount > 0 ? <span className="text-yellow">{pendingCount}</span> : pendingCount}
        />
        <KpiCard
          label="Wartość zweryfikowana"
          value={<span className="text-mint">{formatPLN(verifiedValue, { decimals: false })}</span>}
          mono
        />
      </section>

      <section className="mt-8">
        <UploadForm />
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="label">Dokumenty</div>
            <h2 className="mt-2 font-light text-[22px] tracking-[-0.02em]">Historia</h2>
          </div>
        </div>

        {invoices.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <YearChip label="Wszystkie" active={!sp.year} href={buildHref({})} />
            {years.map((y) => (
              <YearChip key={y} label={String(y)} active={sp.year === String(y)} href={buildHref({ year: String(y) })} />
            ))}
            {monthsPresent.length > 0 && (
              <>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <MonthChip label="Cały rok" active={!sp.month} href={buildHref({ year: sp.year })} />
                {monthsPresent.map((m) => (
                  <MonthChip
                    key={m}
                    label={MONTHS_SHORT[m]}
                    active={sp.month === String(m + 1)}
                    href={buildHref({ year: sp.year, month: String(m + 1) })}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {invoices.length === 0 ? (
          <EmptyState
            title="Brak wgranych dokumentów"
            sub="Po pierwszej zweryfikowanej fakturze odblokujesz środki w portfelu."
          />
        ) : (
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[150px_140px_120px_130px_180px_80px] gap-3 px-4 h-11 label border-b border-border items-center">
              <div>Numer</div>
              <div>Okres</div>
              <div>Typ</div>
              <div>Kwota</div>
              <div>Status</div>
              <div className="text-right">Pobierz</div>
            </div>
            {visible.map((inv) => {
              const period = periodOf(inv);
              const periodLabel = `${MONTHS_PL[period.getMonth()]} ${period.getFullYear()}`;
              return (
                <div
                  key={inv.id}
                  className="grid grid-cols-1 md:grid-cols-[150px_140px_120px_130px_180px_80px] gap-2 md:gap-3 px-4 py-3.5 md:items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] num truncate">{inv.invoice_number ?? "—"}</div>
                    <div className="md:hidden mt-0.5 text-[11px] text-text-mute truncate">
                      {TYPE_LABEL[inv.type]} · {periodLabel} ·{" "}
                      <span className="num">{inv.amount_cents ? formatPLN(inv.amount_cents, { decimals: false }) : "—"}</span>
                    </div>
                  </div>
                  <div className="hidden md:block text-[12px] text-text-soft">{periodLabel}</div>
                  <div className="hidden md:block text-[12px] text-text-soft">{TYPE_LABEL[inv.type]}</div>
                  <div className="hidden md:block text-[13px] num">
                    {inv.amount_cents ? formatPLN(inv.amount_cents, { decimals: false }) : "—"}
                  </div>
                  <div className="flex md:block items-center gap-2">
                    <Pill variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Pill>
                    <span className="md:hidden text-[11px] num text-text-mute">{formatDate(inv.uploaded_at)}</span>
                  </div>
                  <div className="md:text-right">
                    <a
                      href={inv.file_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Pobierz ${inv.invoice_number ?? "dokument"}`}
                      className="btn-ghost inline-flex h-9 w-9 items-center justify-center"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                    </a>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="px-6 py-12 text-center text-[13px] text-text-soft">
                Brak dokumentów w tym okresie.
              </div>
            )}
          </div>
        )}
      </section>
    </PanelShell>
  );
}

function buildHref(f: Filters): string {
  const q = new URLSearchParams();
  if (f.year) q.set("year", f.year);
  if (f.month) q.set("month", f.month);
  const s = q.toString();
  return `/panel/faktury${s ? "?" + s : ""}`;
}

function YearChip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center h-9 px-3.5 rounded-full text-[13px] font-medium border transition-colors ${
        active
          ? "border-lime/40 bg-lime/10 text-lime"
          : "border-border bg-surface text-text-soft hover:text-text hover:bg-surface-2"
      }`}
    >
      {label}
    </Link>
  );
}

function MonthChip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`h-8 px-3 inline-flex items-center rounded-[9px] text-[12px] transition-colors ${
        active
          ? "bg-surface-3 text-text font-medium"
          : "bg-surface text-text-soft hover:bg-surface-2 hover:text-text"
      }`}
    >
      {label}
    </Link>
  );
}
