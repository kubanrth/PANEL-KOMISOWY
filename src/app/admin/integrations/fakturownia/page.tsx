import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import type {
  Profile, FakturowniaEvent, FakturowniaWarehouseMap, FakturowniaPushQueueItem,
} from "@/lib/types";
import { AddMappingForm, RemoveMappingButton, ReplayQueueButton, ReplayEventButton } from "./ClientActions";

const STATUS_VARIANT: Record<FakturowniaEvent["status"], "mint" | "amber" | "mute" | "pink"> = {
  processed: "mint",
  replayed: "mint",
  skipped: "mute",
  failed: "pink",
};

export default async function AdminFakturowniaPage() {
  const { user, profile, supabase } = await requireAdmin();

  // Env status
  const envWebhookSecret = Boolean(process.env.FAKTUROWNIA_WEBHOOK_SECRET);
  const envApiKey = Boolean(process.env.FAKTUROWNIA_API_KEY);
  const envBaseUrl = process.env.FAKTUROWNIA_BASE_URL ?? "";
  const envServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const webhookUrl = siteUrl ? `${siteUrl.replace(/\/$/, "")}/api/webhooks/fakturownia` : null;

  // Fetch dane (admin-only via RLS)
  const [mappings, events, queue, klienciRes] = await Promise.all([
    supabase
      .from("fakturownia_warehouse_map")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("fakturownia_events")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(50),
    supabase
      .from("fakturownia_push_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, company_name")
      .eq("role", "klient")
      .order("created_at", { ascending: false }),
  ]);

  const wmList = (mappings.data ?? []) as FakturowniaWarehouseMap[];
  const eventsList = (events.data ?? []) as FakturowniaEvent[];
  const queueList = (queue.data ?? []) as FakturowniaPushQueueItem[];
  const klienci = (klienciRes.data ?? []) as Array<Pick<Profile, "id" | "first_name" | "last_name" | "company_name">>;

  // Pull klient names for mapping rows
  const klientById = new Map(klienci.map((k) => [k.id, k]));

  return (
    <>
      <section>
        <div className="label">Integracja księgowa</div>
        <h1 className="mt-3 font-display font-bold uppercase text-[18px] lg:text-[24px] leading-[1.15] tracking-[0.01em]">
          Fakturownia.
        </h1>
        <p className="mt-3 text-[15px] text-text-soft max-w-[64ch]">
          Dwukierunkowy sync. Push: po A&amp;QC pass Kickback tworzy produkt w magazynie komisanta.
          Webhook: dokument MM z magazynu komisanta → status produktu = sprzedany.
        </p>
      </section>

      {/* Env status */}
      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <EnvCard label="Webhook secret" ok={envWebhookSecret} envVar="FAKTUROWNIA_WEBHOOK_SECRET" />
        <EnvCard label="API key" ok={envApiKey} envVar="FAKTUROWNIA_API_KEY" />
        <EnvCard label="Base URL" ok={envBaseUrl.startsWith("http")} envVar="FAKTUROWNIA_BASE_URL" value={envBaseUrl} />
        <EnvCard label="Service role (Supabase)" ok={envServiceKey} envVar="SUPABASE_SERVICE_ROLE_KEY" />
      </section>

      {/* Webhook URL */}
      <section className="mt-6 card-elev p-5">
        <div className="label">Webhook URL do skonfigurowania w Fakturowni</div>
        <div className="mt-2 font-mono text-[13px] bg-surface px-3 py-2 rounded-[8px] break-all">
          {webhookUrl ?? <span className="text-text-faint">Ustaw NEXT_PUBLIC_SITE_URL w env</span>}
        </div>
        <p className="mt-3 text-[12px] text-text-mute leading-[1.6]">
          W Fakturowni: <span className="text-text">Ustawienia → Ustawienia konta → Integracja → sekcja Webhooki</span>.
          Wklej powyższy URL, a do pola Secret — wartość z env <span className="num">FAKTUROWNIA_WEBHOOK_SECRET</span>{" "}
          (Fakturownia wyśle ją jako <span className="num">Authorization: Bearer</span>).
          Zaznacz event <strong className="text-text">invoice:create</strong> — paragon/faktura wystawiana przy
          sprzedaży (np. przez SellAsist) oznaczy produkt jako sprzedany po SKU pozycji.
          Fakturownia nie emituje webhooków dla dokumentów MM.
        </p>
      </section>

      {/* Warehouse mappings */}
      <section className="mt-10">
        <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">
          Mapowania magazynów ({wmList.length})
        </h2>
        <AddMappingForm klienci={klienci} />

        {wmList.length > 0 && (
          <div className="mt-5 card table-scroll">
            <div className="hidden md:grid grid-cols-[minmax(220px,2fr)_140px_minmax(180px,2fr)_120px_120px] gap-3 px-4 h-11 items-center label border-b border-border">
              <div>Klient</div>
              <div>Warehouse ID</div>
              <div>Nazwa magazynu</div>
              <div>Zaktualizowane</div>
              <div className="text-right">Akcja</div>
            </div>
            {wmList.map((m) => {
              const k = klientById.get(m.klient_id);
              const name = k
                ? [k.first_name, k.last_name].filter(Boolean).join(" ") || k.company_name || m.klient_id
                : m.klient_id;
              return (
                <div
                  key={m.klient_id}
                  className="grid grid-cols-[minmax(220px,2fr)_140px_minmax(180px,2fr)_120px_120px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
                >
                  <div className="text-[13px] truncate">{name}</div>
                  <div className="text-[13px] num font-medium">{m.fakturownia_warehouse_id}</div>
                  <div className="text-[12px] text-text-soft truncate">{m.warehouse_name ?? "—"}</div>
                  <div className="text-[11px] num text-text-mute">{formatDate(m.updated_at)}</div>
                  <div className="text-right">
                    <RemoveMappingButton klientId={m.klient_id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Push queue */}
      {queueList.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">
            Push queue ({queueList.length})
          </h2>
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[minmax(220px,2fr)_70px_minmax(180px,2fr)_120px_120px_120px] gap-3 px-4 h-11 items-center label border-b border-border">
              <div>Product ID</div>
              <div>Próby</div>
              <div>Last error</div>
              <div>Status</div>
              <div>Data</div>
              <div className="text-right">Akcja</div>
            </div>
            {queueList.map((q) => (
              <div
                key={q.id}
                className="grid grid-cols-[minmax(220px,2fr)_70px_minmax(180px,2fr)_120px_120px_120px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
              >
                <div className="text-[11px] num text-text-mute truncate">{q.product_id}</div>
                <div className="text-[12px] num">{q.attempts}</div>
                <div className="text-[11px] text-text-soft truncate">{q.last_error ?? "—"}</div>
                <div>
                  <span className={`pill ${q.status === "done" ? "pill-mint" : q.status === "failed" ? "pill-coral" : "pill-amber"}`}>
                    {q.status}
                  </span>
                </div>
                <div className="text-[11px] num text-text-mute">{formatDate(q.created_at)}</div>
                <div>
                  {q.status !== "done" && <ReplayQueueButton itemId={q.id} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Events log */}
      <section className="mt-10">
        <h2 className="font-semibold text-xl tracking-[-0.025em] mb-4">
          Ostatnie eventy ({eventsList.length})
        </h2>
        {eventsList.length === 0 ? (
          <div className="card-bare bg-bg-soft/40 border border-dashed border-border rounded-[20px] p-8 text-center text-[13px] text-text-soft">
            Brak eventów. Po skonfigurowaniu webhooka w Fakturowni i pierwszym MM doc'u — pojawi się tutaj.
          </div>
        ) : (
          <div className="card table-scroll">
            <div className="hidden md:grid grid-cols-[minmax(180px,2fr)_140px_80px_120px_minmax(180px,2fr)_120px] gap-3 px-4 h-11 items-center label border-b border-border">
              <div>Event ID</div>
              <div>Kind</div>
              <div>HMAC</div>
              <div>Status</div>
              <div>Error</div>
              <div className="text-right">Akcja</div>
            </div>
            {eventsList.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-[minmax(180px,2fr)_140px_80px_120px_minmax(180px,2fr)_120px] gap-3 px-4 py-3 items-center border-b border-border-soft last:border-0"
              >
                <div className="text-[11px] num text-text-soft truncate" title={e.fakturownia_event_id}>
                  {e.fakturownia_event_id}
                </div>
                <div className="text-[12px] truncate">{e.event_kind}</div>
                <div className="text-[11px]">
                  <span className={`pill ${e.signature_valid ? "pill-mint" : "pill-coral"}`}>
                    {e.signature_valid ? "OK" : "BAD"}
                  </span>
                </div>
                <div>
                  <span className={`pill pill-${STATUS_VARIANT[e.status]}`}>{e.status}</span>
                </div>
                <div className="text-[11px] text-text-soft truncate" title={e.error_message ?? ""}>
                  {e.error_message ?? "—"}
                </div>
                <div>
                  {(e.status === "failed" || e.status === "skipped") && (
                    <ReplayEventButton eventId={e.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function EnvCard({ label, ok, envVar, value }: { label: string; ok: boolean; envVar: string; value?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="label">{label}</div>
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-mint" : "bg-coral"}`} />
      </div>
      <div className={`mt-2 font-semibold text-[14px] ${ok ? "text-text" : "text-coral"}`}>
        {ok ? "Skonfigurowane" : "BRAK"}
      </div>
      <div className="mt-1 text-[10px] num text-text-mute truncate" title={envVar}>
        {value && ok ? value : envVar}
      </div>
    </div>
  );
}
