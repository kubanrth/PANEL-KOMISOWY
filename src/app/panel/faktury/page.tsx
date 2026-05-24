import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { formatPLN, formatDate } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { UploadForm } from "./UploadForm";

const TYPE_LABEL: Record<Invoice["type"], string> = {
  faktura_vat: "Faktura VAT",
  uks: "UKS",
  inne: "Inne",
};

const STATUS_VARIANT: Record<Invoice["status"], "mint" | "amber" | "mute"> = {
  verified: "mint",
  uploaded: "amber",
  rejected: "mute",
};

const STATUS_LABEL: Record<Invoice["status"], string> = {
  verified: "Zweryfikowana",
  uploaded: "Oczekuje weryfikacji",
  rejected: "Odrzucona",
};

export default async function FakturyPage() {
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

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="faktury"
      breadcrumb={[{ label: "Faktury i rozliczenia" }]}
    >
      <section>
        <div className="label">{invoices.length} dokumentów rozliczeniowych</div>
        <h1 className="mt-3 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
          Faktury i rozliczenia.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Wgraj fakturę VAT albo skan UKS — administrator zweryfikuje i odblokuje środki w Wallet.
        </p>
      </section>

      <section className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi label="Łącznie dokumentów" value={invoices.length.toString()} />
        <Kpi label="Oczekuje weryfikacji" value={pendingCount.toString()} accent="text-amber" />
        <Kpi label="Wartość zweryfikowana" value={formatPLN(verifiedValue, { decimals: false })} accent="text-mint" />
      </section>

      <section className="mt-8">
        <UploadForm />
      </section>

      <section className="mt-10">
        <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">Historia</h2>
        {invoices.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-8 text-center text-[14px] text-text-soft">
            Brak wgranych dokumentów. Po pierwszej weryfikowanej fakturze odblokujesz Funds w Wallet.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="hidden md:grid grid-cols-[140px_140px_180px_140px_140px_120px] gap-3 px-4 py-3 label border-b border-border-soft">
              <div>Typ</div>
              <div>Numer</div>
              <div>Kwota</div>
              <div>Wgrano</div>
              <div>Status</div>
              <div className="text-right">Plik</div>
            </div>
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="grid grid-cols-[140px_140px_180px_140px_140px_120px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
              >
                <div className="text-[13px] text-text-soft">{TYPE_LABEL[inv.type]}</div>
                <div className="text-[12px] num text-text-soft">{inv.invoice_number ?? "—"}</div>
                <div className="text-[13px] font-semibold num">
                  {inv.amount_cents ? formatPLN(inv.amount_cents, { decimals: false }) : "—"}
                </div>
                <div className="text-[12px] num text-text-soft">{formatDate(inv.uploaded_at)}</div>
                <div>
                  <span className={`pill pill-${STATUS_VARIANT[inv.status]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_VARIANT[inv.status] === "mint" ? "bg-mint" : STATUS_VARIANT[inv.status] === "amber" ? "bg-amber" : "bg-text-mute"}`} />
                    {STATUS_LABEL[inv.status]}
                  </span>
                </div>
                <div className="text-right">
                  <a href={inv.file_url} target="_blank" rel="noreferrer" className="text-[12px] text-blue hover:underline">
                    Otwórz →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PanelShell>
  );
}

function Kpi({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mt-2 font-bold text-2xl tracking-[-0.035em] num ${accent}`}>{value}</div>
    </div>
  );
}
