import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { ProductThumb } from "@/components/panel/ProductThumb";
import { formatPLN } from "@/lib/format";
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
      <section className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-7 flex items-center gap-5">
          <ProductThumb photos={p.photos} brand={p.brand} size="lg" />
          <div>
            <h1 className="font-bold text-[26px] tracking-[-0.03em]">Wycofaj produkt</h1>
            <p className="text-[16px] text-text-soft mt-1">{p.brand} · {p.model}</p>
            <p className="text-[12px] text-text-mute mt-1 num">W magazynie {ageDays} dni</p>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="card p-5">
            <div className="label">Co się stanie po wycofaniu?</div>
            <ul className="mt-3 space-y-2 text-[13px] text-text-soft">
              <li className="flex gap-2"><span className="text-blue-soft">·</span> Produkt zostanie zdjęty z listingu</li>
              <li className="flex gap-2"><span className="text-blue-soft">·</span> Środki ze sprzedaży nie zostaną już naliczone</li>
              <li className="flex gap-2"><span className="text-blue-soft">·</span> Można odebrać z magazynu (płatne) lub poddać utylizacji</li>
              <li className="flex gap-2"><span className="text-blue-soft">·</span> Decyzja jest odwracalna do momentu finalizacji</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <WithdrawForm
          productId={id}
          availableReasons={availableReasons}
          allReasons={RETURN_REASON_LABEL}
        />
      </section>
    </PanelShell>
  );
}
