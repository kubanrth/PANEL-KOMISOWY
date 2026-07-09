import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  account_type: "individual" | "business" | null;
  role: "klient" | "admin" | "super_admin";
  city: string | null;
  created_at: string;
  onboarded_at: string | null;
};

export default async function AdminClientsPage(props: { searchParams: Promise<{ q?: string }> }) {
  const { user, profile, supabase } = await requireAdmin();
  const { q } = await props.searchParams;
  const search = q?.trim() || "";

  let query = supabase
    .from("profiles")
    .select("id, first_name, last_name, account_type, role, city, created_at, onboarded_at")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  }

  const { data: profilesRaw } = await query;
  const allProfiles = (profilesRaw ?? []) as ProfileRow[];
  const klienci = allProfiles.filter((p) => p.role === "klient");
  const admins = allProfiles.filter((p) => p.role !== "klient");

  return (
    <>
      <section>
        <div className="label">{klienci.length} klientów · {admins.length} adminów</div>
        <h1 className="mt-4 font-display font-bold uppercase text-[18px] lg:text-[24px] leading-[1.15] tracking-[0.01em]">
          Klienci
        </h1>
      </section>

      <form action="/admin/klienci" method="get" className="mt-10 flex items-center gap-3 max-w-md">
        <input name="q" defaultValue={search} placeholder="Szukaj imię / nazwisko" className="input" />
        <button type="submit" className="btn-primary h-11 px-5 text-[13px]">Szukaj</button>
      </form>

      <section className="mt-8">
        <div className="card table-scroll">
          <div className="grid grid-cols-12 gap-4 px-6 h-11 items-center label border-b border-border">
            <div className="col-span-4">Klient</div>
            <div className="col-span-2">Typ konta</div>
            <div className="col-span-2">Miasto</div>
            <div className="col-span-2">Onboarded</div>
            <div className="col-span-2">Założono</div>
          </div>
          {klienci.length === 0 ? (
            <div className="px-6 py-10 text-center text-text-soft">Brak klientów.</div>
          ) : (
            klienci.map((k) => {
              const name = [k.first_name, k.last_name].filter(Boolean).join(" ") || "—";
              const initials = ((k.first_name?.[0] ?? "") + (k.last_name?.[0] ?? "")).toUpperCase() || "??";
              return (
                <Link
                  key={k.id}
                  href={`/admin/klienci/${k.id}`}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/40 transition-colors"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-purple/15 border border-purple/30 flex items-center justify-center text-lime text-[12px] font-semibold">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] truncate">{name}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-[13px] text-text-soft">
                    {k.account_type === "business" ? "Biznesowe" : k.account_type === "individual" ? "Indywidualne" : "—"}
                  </div>
                  <div className="col-span-2 text-[13px] text-text-soft">{k.city ?? "—"}</div>
                  <div className="col-span-2 text-[12px] text-text-mute num">
                    {k.onboarded_at ? formatDate(k.onboarded_at) : <span className="text-amber">brak</span>}
                  </div>
                  <div className="col-span-2 text-[12px] text-text-mute num">{formatDate(k.created_at)}</div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {admins.length > 0 && (
        <section className="mt-12">
          <div className="label mb-4">Administratorzy</div>
          <div className="space-y-3">
            {admins.map((a) => {
              const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || "—";
              return (
                <div key={a.id} className="card p-4 flex items-center justify-between">
                  <div className="text-[14px]">{name}</div>
                  <span className="pill pill-blue">{a.role === "super_admin" ? "Super-admin" : "Admin"}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
