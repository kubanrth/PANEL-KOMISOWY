/* Tymczasowa trasa QA shelli (Faza 3) — do usunięcia po weryfikacji. */
import { PanelShell } from "@/components/panel/PanelShell";
import { AdminShell } from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, Sparkline } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/panel/StatusPill";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function DevShellPage(props: { searchParams: Promise<{ admin?: string }> }) {
  const sp = await props.searchParams;
  const user = { email: "marcin.k@example.com" };

  if (sp.admin === "1") {
    return (
      <AdminShell
        user={user}
        profile={{ first_name: "Daniel", last_name: "K", role: "admin" }}
        active="aqc"
        breadcrumb={[{ label: "A&QC" }]}
        badges={{ aqc: 14, submissions: 8, inbox: 3, payouts: 21 }}
      >
        <Demo />
      </AdminShell>
    );
  }

  return (
    <PanelShell
      user={user}
      profile={{ first_name: "Marcin", last_name: "Kowalski", account_type: "individual" }}
      walletBalance={824000}
      walletAvailable={824000}
      active="magazyn"
      breadcrumb={[{ label: "Magazyn" }]}
      badges={{ submissions: 21, magazyn: 34, zapotrzebowanie: 5, plany: true, notifications: true }}
    >
      <Demo />
    </PanelShell>
  );
}

function Demo() {
  return (
    <>
      <PageHeader
        label="34 pozycje · widok QA"
        title="Magazyn"
        sub="Tymczasowa strona weryfikacji shelli i prymitywów — Faza 3 redesignu."
        action={<ButtonLink href="#">Nowa oferta</ButtonLink>}
      />
      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Aktywnie w sprzedaży" value="12" delta="+2">
          <Sparkline points={[3, 5, 4, 7, 6, 9, 12]} />
        </KpiCard>
        <KpiCard label="Sprzedane w mies." value="3" delta="+12%" />
        <KpiCard label="Do wypłaty" value="2 340 zł" mono delta="Gotowe" />
        <KpiCard label="A&QC w kolejce" value="14" alert delta="-3" deltaTone="coral" />
      </section>
      <section className="mt-8 flex flex-wrap gap-2">
        <Pill variant="lime">W sprzedaży</Pill>
        <Pill variant="mint">Sprzedane</Pill>
        <Pill variant="blue">A&QC</Pill>
        <Pill variant="yellow">Do decyzji</Pill>
        <Pill variant="coral">Zwrot</Pill>
        <Pill variant="amber">Retro</Pill>
        <Pill variant="mute">Draft</Pill>
      </section>
      <section className="mt-8">
        <EmptyState
          title="Twój magazyn jest pusty"
          sub="Wyślij pierwszą koszulkę — zajmiemy się resztą."
          action={<ButtonLink href="#">Nowa oferta</ButtonLink>}
        />
      </section>
    </>
  );
}
