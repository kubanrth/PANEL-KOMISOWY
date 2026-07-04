import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/format";
import type { AppNotification } from "@/lib/types";
import Link from "next/link";

export default async function AdminInboxPage(props: { searchParams: Promise<{ filter?: string }> }) {
  const { user, profile, supabase } = await requireAdmin();
  const { filter } = await props.searchParams;

  // Admin sees ALL notifications (RLS bypass via admin policy)
  let q = supabase
    .from("notifications")
    .select(`
      id, type, title, body, ref_id, read_at, payload, created_at, user_id,
      profiles:user_id ( first_name, last_name )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter) q = q.eq("type", filter);

  const { data: rawList } = await q;

  type Row = AppNotification & { profiles?: { first_name: string | null; last_name: string | null } | null };
  type RawRow = AppNotification & { profiles?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null };
  const list: Row[] = ((rawList ?? []) as unknown as RawRow[]).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : (r.profiles ?? null),
  }));

  const byType = list.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

  const TYPE_FILTERS = [
    { key: "", label: "Wszystkie" },
    { key: "sale", label: "Sprzedaże" },
    { key: "offer_received", label: "Oferty" },
    { key: "payout_pending", label: "Wypłaty pending" },
    { key: "payout_done", label: "Wypłaty done" },
    { key: "valuation_ready", label: "Wyceny" },
    { key: "return_decision", label: "Zwroty" },
  ];

  return (
    <>
      <PageHeader label={`${list.length} powiadomień (max 100)`} title="Inbox" sub="Powiadomienia wszystkich klientów — sprzedaże, oferty, wypłaty, wyceny, zwroty." />

      <section className="mt-8">
        <div className="flex items-center gap-2 flex-wrap text-[13px]">
          {TYPE_FILTERS.map((f) => {
            const active = (filter ?? "") === f.key;
            const count = f.key ? byType[f.key] || 0 : list.length;
            return (
              <Link
                key={f.key}
                href={f.key ? `/admin/inbox?filter=${f.key}` : "/admin/inbox"}
                className={`inline-flex items-center h-9 px-3.5 rounded-full text-[13px] font-medium border transition-colors active:scale-[.98] ${
                  active ? "border-lime/40 bg-lime/10 text-lime" : "border-border bg-surface text-text-soft hover:text-text hover:bg-surface-2"
                }`}
              >
                {f.label} <span className={`num ml-1 ${active ? "text-lime/70" : "text-text-mute"}`}>· {count}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-6 space-y-2">
        {list.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-8 text-center text-text-soft">
            Brak powiadomień pasujących do filtra.
          </div>
        ) : (
          list.map((n) => {
            const recipient = [n.profiles?.first_name, n.profiles?.last_name].filter(Boolean).join(" ") || "—";
            return (
              <div key={n.id} className="card p-4 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-2 text-[12px] text-text-mute">
                  <div className="num text-[11px]">{n.type}</div>
                  <div className="num">{formatDateTime(n.created_at)}</div>
                </div>
                <div className="col-span-3 text-[13px]">{recipient}</div>
                <div className="col-span-7">
                  <div className="text-[14px] font-medium">{n.title}</div>
                  {n.body && <div className="text-[12px] text-text-soft mt-0.5">{n.body}</div>}
                  {n.ref_id && <div className="text-[11px] text-text-mute mt-1 num">{n.ref_id}</div>}
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
