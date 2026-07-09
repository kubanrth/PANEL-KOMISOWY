import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { SubmissionStatusPill } from "@/components/panel/StatusPill";
import { formatPLN, formatDate, formatDateTime } from "@/lib/format";
import type { Profile, Submission } from "@/lib/types";

export default async function AdminClientProfilePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { user, profile: meProfile, supabase } = await requireAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle<Profile>();
  if (!target) notFound();

  const { data: submissionsRaw } = await supabase
    .from("submissions")
    .select("id, status, signed_at, signed_method, commission_rate, created_at")
    .eq("klient_id", id)
    .order("created_at", { ascending: false });
  const submissions = (submissionsRaw ?? []) as Submission[];

  const { data: walletSummary } = await supabase.rpc("wallet_summary", { klient: id });
  const balance = (walletSummary?.[0]?.balance_cents as number | undefined) ?? 0;
  const available = (walletSummary?.[0]?.available_cents as number | undefined) ?? 0;
  const pending = (walletSummary?.[0]?.pending_cents as number | undefined) ?? 0;

  const fullName = [target.first_name, target.last_name].filter(Boolean).join(" ") || "—";

  return (
    <>
      <section className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-12 lg:col-span-7">
          <div className="flex items-center gap-3 mb-3">
            <span className="pill pill-mute">{target.account_type === "business" ? "Biznesowe" : "Indywidualne"}</span>
            <span className="pill pill-blue">{target.role === "klient" ? "Klient" : target.role}</span>
          </div>
          <h1 className="font-display font-bold uppercase text-[18px] lg:text-[24px] leading-[1.15] tracking-[0.01em]">{fullName}</h1>
          <p className="mt-3 text-text-mute text-[14px] num">
            ID: {target.id.slice(0, 8)}… · konto od {formatDate(target.created_at)}
          </p>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="card-gradient-blue p-6 rounded-[20px] text-white">
            <div className="text-white/70 text-[12px] font-semibold uppercase tracking-wider">Wallet</div>
            <div className="mt-2 font-light text-3xl tracking-[-0.02em] num">{formatPLN(balance, { decimals: false })}</div>
            <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-white/15 text-[12px]">
              <div>
                <div className="text-white/70">Dostępne</div>
                <div className="font-semibold mt-0.5 num">{formatPLN(available, { decimals: false })}</div>
              </div>
              <div>
                <div className="text-white/70">Pending</div>
                <div className="font-semibold mt-0.5 num">{formatPLN(pending, { decimals: false })}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Profile details */}
      <section className="mt-12 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6">
          <div className="label mb-3">Dane osobowe</div>
          <div className="card p-6 space-y-3">
            <Detail label="Imię" value={target.first_name} />
            <Detail label="Nazwisko" value={target.last_name} />
            {target.account_type === "individual" && (
              <Detail label="PESEL / Nr Dowodu" value={target.pesel_or_id ? maskPesel(target.pesel_or_id) : null} />
            )}
            {target.account_type === "business" && (
              <>
                <Detail label="Nazwa firmy" value={target.company_name} />
                <Detail label="NIP" value={target.nip} />
                <Detail label="VAT ID" value={target.vat_id} />
              </>
            )}
            <Detail label="Telefon" value={target.phone} />
          </div>
        </div>
        <div className="col-span-12 lg:col-span-6">
          <div className="label mb-3">Adres</div>
          <div className="card p-6 space-y-3">
            <Detail label="Ulica" value={target.address_line} />
            <Detail label="Kod pocztowy" value={target.postal_code} />
            <Detail label="Miasto" value={target.city} />
            <Detail label="Kraj" value={target.country} />
            <Detail label="Onboarded" value={target.onboarded_at ? formatDateTime(target.onboarded_at) : null} />
          </div>
        </div>
      </section>

      {/* Submissions */}
      <section className="mt-12">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="label">Submissions</div>
            <h2 className="mt-2 font-light text-[22px] tracking-[-0.02em]">{submissions.length} łącznie</h2>
          </div>
        </div>
        {submissions.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Klient nie ma jeszcze żadnej Submission.
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <Link key={s.id} href={`/panel/submissions/${s.id}`} className="card p-5 flex items-center justify-between hover:border-lime/30 transition-colors">
                <div>
                  <div className="num text-[14px]">{s.id}</div>
                  <div className="text-[12px] text-text-mute mt-1">{formatDate(s.created_at)} · {s.signed_method ?? "—"}</div>
                </div>
                <SubmissionStatusPill status={s.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12px] text-text-mute">{label}</span>
      <span className="text-[14px] font-medium text-right">{value || <span className="text-text-faint italic">brak</span>}</span>
    </div>
  );
}

function maskPesel(pesel: string): string {
  if (pesel.length < 4) return "***";
  return pesel.slice(0, 2) + "****" + pesel.slice(-2);
}
