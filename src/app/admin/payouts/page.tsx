import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { formatPLN, formatDate, formatDateTime } from "@/lib/format";
import { authorizePayout, rejectPayout } from "./actions";

type Row = {
  id: string;
  amount_cents: number;
  status: string;
  requested_at: string;
  authorized_at: string | null;
  executed_at: string | null;
  bank_ref: string | null;
  klient_id: string;
  bank_account_id: string | null;
  profiles: { first_name: string | null; last_name: string | null; account_type: string | null } | null;
  bank_accounts: { bank_name: string; iban: string } | null;
};

export default async function AdminPayoutsPage() {
  const { user, profile, supabase } = await requireAdmin();

  const { data: payoutsRaw } = await supabase
    .from("payouts")
    .select(`
      id, amount_cents, status, requested_at, authorized_at, executed_at, bank_ref, klient_id, bank_account_id,
      profiles ( first_name, last_name, account_type ),
      bank_accounts ( bank_name, iban )
    `)
    .order("requested_at", { ascending: false });

  type RawRow = Omit<Row, "profiles" | "bank_accounts"> & {
    profiles?: Row["profiles"] | Row["profiles"][] | null;
    bank_accounts?: Row["bank_accounts"] | Row["bank_accounts"][] | null;
  };
  const payouts: Row[] = ((payoutsRaw ?? []) as unknown as RawRow[]).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : (r.profiles ?? null),
    bank_accounts: Array.isArray(r.bank_accounts) ? r.bank_accounts[0] ?? null : (r.bank_accounts ?? null),
  }));
  const pending = payouts.filter((p) => p.status === "requested" || p.status === "authorized" || p.status === "executing");
  const done = payouts.filter((p) => p.status === "done" || p.status === "failed" || p.status === "cancelled");

  return (
    <AdminShell user={user} profile={profile} active="payouts" breadcrumb={[{ label: "Wypłaty" }]}>
      <section>
        <div className="label">{pending.length} oczekuje · {done.length} zakończonych</div>
        <h1 className="mt-4 font-bold text-[40px] lg:text-[56px] leading-[1.02] tracking-[-0.04em]">
          Wypłaty <span className="text-text-soft">/ autoryzacja.</span>
        </h1>
      </section>

      <section className="mt-12">
        <div className="label mb-5">Wymaga akcji</div>
        {pending.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Brak wypłat oczekujących na autoryzację.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => {
              const name = [p.profiles?.first_name, p.profiles?.last_name].filter(Boolean).join(" ") || "—";
              return (
                <div key={p.id} className="card p-5 grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-12 md:col-span-3">
                    <div className="font-semibold text-[15px]">{name}</div>
                    <div className="text-[11px] text-text-mute">{p.profiles?.account_type === "business" ? "Biznesowe" : "Indywidualne"}</div>
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <div className="text-[13px]">{p.bank_accounts?.bank_name ?? "—"}</div>
                    <div className="font-mono text-[11px] text-text-mute">
                      {p.bank_accounts ? `${p.bank_accounts.iban.slice(0, 6)}…${p.bank_accounts.iban.slice(-4)}` : "—"}
                    </div>
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <div className="text-[11px] text-text-mute">Status</div>
                    <span className={`pill ${p.status === "requested" ? "pill-amber" : p.status === "authorized" ? "pill-blue" : "pill-mute"}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="col-span-12 md:col-span-2 text-right">
                    <div className="text-[11px] text-text-mute">Kwota</div>
                    <div className="font-bold text-xl tracking-[-0.025em] num">{formatPLN(p.amount_cents, { decimals: false })}</div>
                  </div>
                  <div className="col-span-12 md:col-span-2 text-right space-y-1.5">
                    <form action={authorizePayout}>
                      <input type="hidden" name="payout_id" value={p.id} />
                      <button className="w-full text-[12px] px-3 py-2 rounded-[8px] bg-mint/15 text-mint hover:bg-mint/25 transition-colors font-semibold">
                        {p.status === "requested" ? "Autoryzuj" : "Wykonaj"}
                      </button>
                    </form>
                    <form action={rejectPayout}>
                      <input type="hidden" name="payout_id" value={p.id} />
                      <button className="w-full text-[12px] px-3 py-2 rounded-[8px] bg-coral/10 text-coral hover:bg-coral/20 transition-colors">
                        Odrzuć
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="label mb-5">Historia · {done.length}</div>
        {done.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-6 text-center text-text-soft">
            Brak historycznych wypłat.
          </div>
        ) : (
          <div className="card overflow-hidden">
            {done.slice(0, 20).map((p, i) => {
              const name = [p.profiles?.first_name, p.profiles?.last_name].filter(Boolean).join(" ") || "—";
              return (
                <div key={p.id} className={`grid grid-cols-12 gap-4 px-6 py-4 items-center ${i < done.length - 1 ? "border-b border-border-soft" : ""}`}>
                  <div className="col-span-3 text-[13px]">{name}</div>
                  <div className="col-span-3">
                    <span className={`pill ${p.status === "done" ? "pill-mint" : "pill-mute"}`}>{p.status}</span>
                  </div>
                  <div className="col-span-3 text-[12px] text-text-mute num">{formatDateTime(p.executed_at ?? p.authorized_at ?? p.requested_at)}</div>
                  <div className="col-span-3 text-right font-semibold text-[14px] num">{formatPLN(p.amount_cents, { decimals: false })}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
