import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { SubmissionStatusPill, ProductStatusPill } from "@/components/panel/StatusPill";
import { formatPLN, formatDate } from "@/lib/format";
import type {
  Profile, Submission, Product, WalletTransaction, AppDocument, AppNotification,
} from "@/lib/types";

type Tab = "submissions" | "magazyn" | "sprzedaze" | "wallet" | "dokumenty" | "audit";

export default async function AdminCrmDetailPage(props: {
  params: Promise<{ klient_id: string }>;
  searchParams: Promise<{ tab?: Tab }>;
}) {
  const { klient_id } = await props.params;
  const { tab = "submissions" } = await props.searchParams;
  const { user, profile, supabase } = await requireAdmin();

  const { data: klient } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", klient_id)
    .maybeSingle();
  if (!klient) notFound();
  const k = klient as Profile;

  const [subs, prods, wallet, docs, notifs] = await Promise.all([
    supabase.from("submissions").select("*").eq("klient_id", klient_id).order("created_at", { ascending: false }),
    supabase.from("products").select("*"),
    supabase.from("wallet_transactions").select("*").eq("klient_id", klient_id).order("created_at", { ascending: false }).limit(50),
    supabase.from("documents").select("*").eq("klient_id", klient_id).order("created_at", { ascending: false }).limit(50),
    supabase.from("notifications").select("*").eq("user_id", klient_id).order("created_at", { ascending: false }).limit(50),
  ]);

  const submissions = (subs.data ?? []) as Submission[];
  const subIds = new Set(submissions.map((s) => s.id));
  const klientProducts = ((prods.data ?? []) as Product[]).filter((p) => subIds.has(p.submission_id));

  const stock = klientProducts.filter((p) => ["aqc", "listed", "offer"].includes(p.status));
  const sold = klientProducts.filter((p) => p.status === "sold");
  const stockValue = stock.reduce((a, p) => a + (p.listing_price_cents ?? p.expected_price_cents ?? 0), 0);
  const gmv = sold.reduce((a, p) => a + (p.listing_price_cents ?? 0), 0);

  const transactions = (wallet.data ?? []) as WalletTransaction[];
  const balance = transactions.reduce((a, t) => a + t.amount_cents, 0);

  const documents = (docs.data ?? []) as AppDocument[];
  const notifications = (notifs.data ?? []) as AppNotification[];

  const fullName = [k.first_name, k.last_name].filter(Boolean).join(" ") || k.company_name || klient_id;

  const TABS: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "submissions", label: "Submissions", count: submissions.length },
    { key: "magazyn",     label: "Magazyn",     count: stock.length },
    { key: "sprzedaze",   label: "Sprzedaże",   count: sold.length },
    { key: "wallet",      label: "Wallet",      count: transactions.length },
    { key: "dokumenty",   label: "Dokumenty",   count: documents.length },
    { key: "audit",       label: "Powiadom.",   count: notifications.length },
  ];

  return (
    <AdminShell
      user={user}
      profile={profile}
      active="crm"
      breadcrumb={[
        { label: "CRM", href: "/admin/crm" },
        { label: fullName },
      ]}
    >
      <section>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="label">
              {k.account_type === "individual" ? "Indywidualne" : k.account_type === "business" ? "Biznesowe" : "—"}
              {k.master_agreement_signed_at && " · umowa podpisana"}
            </div>
            <h1 className="mt-2 font-bold text-[28px] lg:text-[36px] leading-[1.05] tracking-[-0.03em]">
              {fullName}
            </h1>
            <p className="mt-1 text-[13px] text-text-mute num">{k.id}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-right">
            <Stat label="GMV" value={formatPLN(gmv, { decimals: false })} accent="text-mint" />
            <Stat label="Stock" value={formatPLN(stockValue, { decimals: false })} />
            <Stat label="Wallet" value={formatPLN(balance, { decimals: false })} accent={balance > 0 ? "text-mint" : ""} />
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="mt-8 flex items-center gap-2 border-b border-border-soft pb-px overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={`/admin/crm/${klient_id}?tab=${t.key}`}
              className={`px-4 py-2.5 text-[13px] -mb-px border-b-2 transition-colors ${
                active
                  ? "border-purple text-purple font-semibold"
                  : "border-transparent text-text-soft hover:text-text"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className={`ml-1.5 text-[11px] num ${active ? "text-purple" : "text-text-mute"}`}>
                  · {t.count}
                </span>
              )}
            </Link>
          );
        })}
      </section>

      <section className="mt-6">
        {tab === "submissions" && <SubmissionsTab submissions={submissions} />}
        {tab === "magazyn" && <ProductsTab products={stock} title="Magazyn — pozycje aktywne" />}
        {tab === "sprzedaze" && <ProductsTab products={sold} title="Sprzedaże" showSold />}
        {tab === "wallet" && <WalletTab transactions={transactions} />}
        {tab === "dokumenty" && <DocsTab documents={documents} />}
        {tab === "audit" && <NotifsTab notifs={notifications} />}
      </section>
    </AdminShell>
  );
}

function Stat({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold tracking-wider text-text-mute">{label}</div>
      <div className={`mt-1 font-bold text-xl tracking-[-0.025em] num ${accent}`}>{value}</div>
    </div>
  );
}

function SubmissionsTab({ submissions }: { submissions: Submission[] }) {
  if (!submissions.length) return <Empty msg="Brak submission'ów." />;
  return (
    <div className="card table-scroll">
      <div className="hidden md:grid grid-cols-[160px_140px_120px_120px] gap-3 px-4 py-3 label border-b border-border-soft">
        <div>SUB-Numer</div>
        <div>Data</div>
        <div>Podpisana</div>
        <div>Status</div>
      </div>
      {submissions.map((s) => (
        <Link
          key={s.id}
          href={`/admin/submissions`}
          className="grid grid-cols-[160px_140px_120px_120px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0 hover:bg-surface-2/30"
        >
          <div className="text-[13px] num font-medium">{s.id}</div>
          <div className="text-[12px] num text-text-soft">{formatDate(s.created_at)}</div>
          <div className="text-[12px] num text-text-soft">{formatDate(s.signed_at)}</div>
          <div><SubmissionStatusPill status={s.status} /></div>
        </Link>
      ))}
    </div>
  );
}

function ProductsTab({ products, title, showSold = false }: { products: Product[]; title: string; showSold?: boolean }) {
  if (!products.length) return <Empty msg={`Brak pozycji w "${title}".`} />;
  return (
    <div className="card table-scroll">
      <div className="hidden md:grid grid-cols-[minmax(220px,3fr)_120px_120px_120px_120px] gap-3 px-4 py-3 label border-b border-border-soft">
        <div>Produkt</div>
        <div>Cena</div>
        <div>Status</div>
        <div>{showSold ? "Sprzedano" : "Publikacja"}</div>
        <div>{showSold ? "Rozliczenie" : "Dni"}</div>
      </div>
      {products.map((p) => {
        const since = p.published_at ?? p.created_at;
        const days = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000));
        return (
          <div
            key={p.id}
            className="grid grid-cols-[minmax(220px,3fr)_120px_120px_120px_120px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
          >
            <Link href={`/panel/products/${p.id}`} className="flex items-center gap-3 min-w-0 hover:text-blue">
              <ProductThumb photos={p.photos} brand={p.brand} size="sm" />
              <div className="text-[13px] truncate">{p.brand} · {p.model}</div>
            </Link>
            <div className="text-[13px] num font-semibold">
              {formatPLN(p.listing_price_cents ?? p.expected_price_cents ?? 0, { decimals: false })}
            </div>
            <div><ProductStatusPill status={p.status} /></div>
            <div className="text-[12px] num text-text-soft">
              {showSold ? formatDate(p.sold_at) : formatDate(p.published_at)}
            </div>
            <div className="text-[12px] num text-text-soft">
              {showSold ? formatDate(p.settlement_at) : `${days} d`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WalletTab({ transactions }: { transactions: WalletTransaction[] }) {
  if (!transactions.length) return <Empty msg="Brak transakcji w Wallet." />;
  return (
    <div className="card table-scroll">
      <div className="hidden md:grid grid-cols-[140px_180px_minmax(180px,2fr)_140px] gap-3 px-4 py-3 label border-b border-border-soft">
        <div>Data</div>
        <div>Typ</div>
        <div>Opis</div>
        <div className="text-right">Kwota</div>
      </div>
      {transactions.map((t) => (
        <div
          key={t.id}
          className="grid grid-cols-[140px_180px_minmax(180px,2fr)_140px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
        >
          <div className="text-[12px] num text-text-soft">{formatDate(t.created_at)}</div>
          <div className="text-[12px] text-text-soft">{t.type}</div>
          <div className="text-[12px] text-text-soft truncate">{t.description ?? t.reference_id ?? "—"}</div>
          <div className={`text-right text-[13px] num font-semibold ${t.amount_cents > 0 ? "text-mint" : "text-text-mute"}`}>
            {t.amount_cents > 0 ? "+" : ""}{formatPLN(t.amount_cents, { decimals: false })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocsTab({ documents }: { documents: AppDocument[] }) {
  if (!documents.length) return <Empty msg="Brak dokumentów." />;
  return (
    <div className="card table-scroll">
      {documents.map((d) => (
        <div key={d.id} className="px-4 py-3 border-b border-border-soft last:border-0 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[13px] font-medium">{d.type}</div>
            <div className="text-[11px] text-text-mute num">{formatDate(d.created_at)} · {d.id.slice(0, 8)}</div>
          </div>
          {d.file_url && (
            <a href={d.file_url} target="_blank" rel="noreferrer" className="text-[12px] text-blue hover:underline">
              Pobierz →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function NotifsTab({ notifs }: { notifs: AppNotification[] }) {
  if (!notifs.length) return <Empty msg="Brak zdarzeń." />;
  return (
    <div className="card table-scroll">
      {notifs.map((n) => (
        <div key={n.id} className="px-4 py-3 border-b border-border-soft last:border-0">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium">{n.title}</div>
            <div className="text-[11px] text-text-mute num">{formatDate(n.created_at)}</div>
          </div>
          {n.body && <div className="mt-1 text-[12px] text-text-soft">{n.body}</div>}
        </div>
      ))}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-10 text-center text-[14px] text-text-soft">
      {msg}
    </div>
  );
}
