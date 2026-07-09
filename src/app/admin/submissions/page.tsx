import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmissionStatusPill } from "@/components/panel/StatusPill";
import { formatPLN, formatDate } from "@/lib/format";
import type { Submission, SubmissionStatus } from "@/lib/types";

const FILTERS: Array<{ key: string; label: string; matches: (s: SubmissionStatus) => boolean }> = [
  { key: "all", label: "Wszystkie", matches: () => true },
  { key: "draft", label: "Szkic", matches: (s) => s === "draft" },
  { key: "signed", label: "Podpisane", matches: (s) => s === "signed" },
  { key: "in_transit", label: "W transporcie", matches: (s) => s === "in_transit" },
  { key: "listed", label: "W sprzedaży", matches: (s) => s === "listed" },
  { key: "sold", label: "Sprzedane", matches: (s) => s === "sold" },
  { key: "returned", label: "Zwrot", matches: (s) => s === "returned" },
];

export default async function AdminSubmissionsPage(props: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const { supabase } = await requireAdmin();
  const { filter, q } = await props.searchParams;
  const filterKey = FILTERS.find((f) => f.key === filter)?.key ?? "all";
  const search = q?.trim() || "";

  let query = supabase
    .from("submissions")
    .select(`
      id, status, signed_at, signed_method, commission_rate, created_at,
      profiles:klient_id ( first_name, last_name, account_type )
    `)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.ilike("id", `%${search}%`);
  }

  const { data: submissionsRaw } = await query;

  type Row = Submission & { profiles?: { first_name: string | null; last_name: string | null; account_type: "individual" | "business" | null } | null };
  type RawRow = Submission & {
    profiles?: { first_name: string | null; last_name: string | null; account_type: "individual" | "business" | null }
              | { first_name: string | null; last_name: string | null; account_type: "individual" | "business" | null }[]
              | null;
  };
  const all: Row[] = ((submissionsRaw ?? []) as unknown as RawRow[]).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : (r.profiles ?? null),
  }));
  const activeFilter = FILTERS.find((f) => f.key === filterKey)!;
  const submissions = all.filter((s) => activeFilter.matches(s.status));

  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f.key] = all.filter((s) => f.matches(s.status)).length;
    return acc;
  }, {});

  return (
    <>
      <PageHeader label={`${all.length} łącznie`} title="Submissions" />

      <section className="mt-8">
        <form action="/admin/submissions" method="get" className="flex items-center gap-3 max-w-md mb-6">
          <input
            name="q"
            defaultValue={search}
            placeholder="Szukaj SUB-XXXXX…"
            className="input"
          />
          {filter && <input type="hidden" name="filter" value={filter} />}
          <button type="submit" className="btn-primary h-11 px-5 text-[13px]">Szukaj</button>
        </form>

        {/* Dropdown statusów — natywny <details>, panel frosted glass.
            ponytail: bez light-dismiss (klik obok nie zamyka) — nawigacja
            po kliknięciu statusu i tak resetuje details; JS dodać gdy zacznie
            przeszkadzać. */}
        <details className="relative inline-block group">
          <summary className="list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-medium border border-lime/40 bg-lime/10 text-lime cursor-pointer select-none transition-colors hover:bg-lime/15 active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime/60">
            Status: {FILTERS.find((f) => f.key === filterKey)!.label}
            <span className="num text-lime/70">· {counts[filterKey]}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-180" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          {/* Frosted glass: mocny blur + saturacja, przezroczyste tło, inset-highlight u góry */}
          <div className="absolute left-0 top-full mt-2 z-30 min-w-[280px] rounded-[22px] border border-white/10 bg-surface/35 backdrop-blur-2xl backdrop-saturate-150 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.10),0_28px_70px_-18px_rgba(0,0,0,0.75)] p-2">
            {FILTERS.map((f) => {
              const active = f.key === filterKey;
              const params = new URLSearchParams();
              if (f.key !== "all") params.set("filter", f.key);
              if (search) params.set("q", search);
              const href = params.toString() ? `/admin/submissions?${params}` : "/admin/submissions";
              return (
                <Link
                  key={f.key}
                  href={href}
                  className={`flex items-center justify-between gap-6 px-3.5 h-10 rounded-[11px] text-[13px] font-medium transition-colors ${
                    active ? "bg-lime/12 text-lime" : "text-text-soft hover:text-text hover:bg-white/8"
                  }`}
                >
                  {f.label}
                  <span className={`num ${active ? "text-lime/70" : "text-text-mute"}`}>{counts[f.key]}</span>
                </Link>
              );
            })}
          </div>
        </details>
      </section>

      <section className="mt-6">
        {submissions.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[16px] p-10 text-center text-text-soft">
            Brak Submissions pasujących do filtra.
          </div>
        ) : (
          <div className="card table-scroll">
            <div className="grid grid-cols-12 gap-4 px-6 h-11 items-center label border-b border-border">
              <div className="col-span-2">Submission</div>
              <div className="col-span-3">Klient</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Podpis</div>
              <div className="col-span-2">Data</div>
              <div className="col-span-1 text-right">Prowizja</div>
            </div>
            {submissions.map((s) => {
              const name = [s.profiles?.first_name, s.profiles?.last_name].filter(Boolean).join(" ") || "—";
              return (
                <Link
                  key={s.id}
                  href={`/panel/submissions/${s.id}`}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <div className="col-span-2 num text-[12px] text-text-mute">{s.id}</div>
                  <div className="col-span-3">
                    <div className="text-[14px]">{name}</div>
                    <div className="text-[11px] text-text-mute">{s.profiles?.account_type === "business" ? "Biznesowe" : "Indywidualne"}</div>
                  </div>
                  <div className="col-span-2"><SubmissionStatusPill status={s.status} /></div>
                  <div className="col-span-2 text-[13px] text-text-soft">
                    {s.signed_method === "autopay" ? "Autopay" : s.signed_method === "pz" ? "Profil zaufany" : "—"}
                  </div>
                  <div className="col-span-2 text-[13px] text-text-mute num">{formatDate(s.created_at)}</div>
                  <div className="col-span-1 text-right text-[13px] num">{Math.round(s.commission_rate * 100)}%</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
