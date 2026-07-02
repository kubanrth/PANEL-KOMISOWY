import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { RETURN_REASON_LABEL, type Product } from "@/lib/types";
import { WithdrawForm } from "./WithdrawForm";

export default async function ProductWithdrawPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: product } = await supabase
    .from("products")
    .select("*, submissions ( klient_id, created_at )")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  type P = Product & { submissions?: { klient_id: string; created_at: string } };
  const p = product as P;
  if (p.submissions?.klient_id !== user.id) redirect("/panel");

  const ageDays = p.submissions ? Math.floor((Date.now() - new Date(p.submissions.created_at).getTime()) / 86_400_000) : 0;

  // Reasons available to klient (can't pick admin-only ones)
  const availableReasons: Array<keyof typeof RETURN_REASON_LABEL> = ["client_rejection"];
  if (ageDays < 90) availableReasons.push("withdraw_short_term");
  else availableReasons.push("withdraw_long_term");

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="my-sales"
      breadcrumb={[
        { label: "Sprzedaże", href: "/panel/sprzedaze" },
        { label: `${p.brand} · ${p.model}`, href: `/panel/products/${id}` },
        { label: "Wycofaj" },
      ]}
    >
      <PageHeader
        label="Wycofanie z komisu"
        title="Wycofaj produkt"
        sub="Zdejmiemy pozycję z listingu i przygotujemy ją do odbioru z magazynu. Sprawdź warunki i opłatę zanim potwierdzisz."
      />

      {/* Żółty baner ostrzegawczy o opłacie */}
      <div className="mt-6 rounded-[14px] bg-yellow/8 border border-yellow/25 p-4 flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow mt-0.5 flex-shrink-0" aria-hidden>
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
        <div className="text-[12px]">
          <div className="font-medium text-yellow">Wycofanie może wiązać się z opłatą</div>
          <p className="mt-1 text-text-soft">
            Wysokość opłaty zależy od powodu i czasu magazynowania. Dokładna kwota jest widoczna
            przy wyborze powodu poniżej — zanim cokolwiek potwierdzisz.
          </p>
        </div>
      </div>

      <section className="mt-6 grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12 lg:col-span-7">
          <div className="card p-5 flex items-center gap-4">
            <ProductThumb photos={p.photos} brand={p.brand} size="lg" />
            <div className="min-w-0">
              <div className="text-[15px] font-medium truncate">{p.brand} {p.model}</div>
              {p.sku && <div className="mt-0.5 text-[11px] num text-text-mute">{p.sku}</div>}
              <div className="mt-0.5 text-[12px] num text-text-mute">W magazynie {ageDays} dni</div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="card p-5">
            <div className="label">Co się stanie po wycofaniu?</div>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-[1.55] text-text-soft">
              <Bullet>Produkt zostanie zdjęty z listingu</Bullet>
              <Bullet>Środki ze sprzedaży nie zostaną już naliczone</Bullet>
              <Bullet>Można odebrać z magazynu (płatne) lub poddać utylizacji</Bullet>
              <Bullet>Decyzja jest odwracalna do momentu finalizacji</Bullet>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <WithdrawForm
          productId={id}
          availableReasons={availableReasons}
          allReasons={RETURN_REASON_LABEL}
        />
      </section>
    </PanelShell>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-[6px] h-[7px] w-[7px] rounded-full bg-lime/60" aria-hidden />
      {children}
    </li>
  );
}
