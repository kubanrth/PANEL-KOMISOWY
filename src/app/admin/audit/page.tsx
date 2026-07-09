import { requireAdmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";

type LogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null; role: string } | null;
};

export default async function AdminAuditLogPage() {
  const { supabase } = await requireAdmin();

  const { data: logsRaw } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, target_type, target_id, payload, created_at, profiles!actor_id ( first_name, last_name, role )")
    .order("created_at", { ascending: false })
    .limit(200);

  type RawLog = Omit<LogRow, "profiles"> & { profiles?: LogRow["profiles"] | LogRow["profiles"][] | null };
  const logs: LogRow[] = ((logsRaw ?? []) as unknown as RawLog[]).map((l) => ({
    ...l,
    profiles: Array.isArray(l.profiles) ? l.profiles[0] ?? null : (l.profiles ?? null),
  }));

  return (
    <>
      <section>
        <div className="label">{logs.length} eventów (ostatnie 200)</div>
        <h1 className="mt-4 font-display font-bold uppercase text-[18px] lg:text-[24px] leading-[1.15] tracking-[0.01em]">
          Audit log
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[60ch]">
          Każda akcja administratora — A&QC, redukcja ceny, autoryzacja wypłaty, decyzja zwrotu — jest tu rejestrowana z timestampem i payloadem.
        </p>
      </section>

      <section className="mt-12">
        {logs.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Brak akcji w logu.
          </div>
        ) : (
          <div className="card table-scroll">
            {logs.map((l, i) => {
              const actorName = [l.profiles?.first_name, l.profiles?.last_name].filter(Boolean).join(" ") || "system";
              return (
                <div
                  key={l.id}
                  className={`grid grid-cols-12 gap-4 px-5 py-3 items-center text-[12px] ${
                    i < logs.length - 1 ? "border-b border-border-soft" : ""
                  }`}
                >
                  <div className="col-span-2 text-text-mute num">{formatDateTime(l.created_at)}</div>
                  <div className="col-span-2">
                    <div className="text-[13px]">{actorName}</div>
                    <div className="text-[10px] text-text-mute">{l.profiles?.role ?? "—"}</div>
                  </div>
                  <div className="col-span-2 font-mono text-lime">{l.action}</div>
                  <div className="col-span-2 text-text-soft">
                    {l.target_type ?? "—"}
                  </div>
                  <div className="col-span-2 font-mono text-text-mute truncate">{l.target_id ?? "—"}</div>
                  <div className="col-span-2 text-text-mute font-mono text-[11px] truncate">
                    {Object.keys(l.payload).length > 0 ? JSON.stringify(l.payload) : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
