import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PanelShell } from "@/components/panel/PanelShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AppNotification } from "@/lib/types";
import { markAllRead } from "./actions";
import { NotificationItem } from "./NotificationItem";

/* Powiadomienia — redesign: PageHeader, lista chronologiczna grupowana
   po dacie, nieprzeczytane = lime dot + jaśniejsze tło (NotificationItem). */

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, account_type, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: notificationsRaw } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  const notifications = (notificationsRaw ?? []) as AppNotification[];
  const unread = notifications.filter((n) => !n.read_at);

  // Group by date
  const groups = groupByDate(notifications);

  return (
    <PanelShell
      user={{ email: user.email! }}
      profile={profile}
      active="notifications"
      breadcrumb={[{ label: "Powiadomienia" }]}
      cta={
        unread.length > 0 ? (
          <form action={markAllRead}>
            <button className="btn-ghost h-11 px-5 text-[13px] inline-flex items-center gap-2">
              Oznacz wszystkie jako przeczytane
            </button>
          </form>
        ) : undefined
      }
    >
      <PageHeader
        label={unread.length > 0 ? `${unread.length} nieprzeczytanych` : "Wszystko przeczytane"}
        title="Powiadomienia"
        sub="Każdy event w cyklu Twojej sprzedaży trafia tutaj — wycena, oferta, sprzedaż, wypłata, zwrot."
      />

      {notifications.length === 0 ? (
        <section className="mt-8">
          <EmptyState
            title="Brak powiadomień"
            sub="Każdy event w cyklu Twojej sprzedaży trafi tutaj — wycena, oferta, sprzedaż, wypłata, zwrot."
          />
        </section>
      ) : (
        <section className="mt-8 space-y-8">
          {groups.map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div className="label flex items-center gap-3">
                <span className="inline-block h-px w-8 bg-border" aria-hidden />
                {dateLabel}
              </div>
              <div className="mt-3 space-y-2">
                {items.map((n) => (
                  <NotificationItem key={n.id} notification={n} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </PanelShell>
  );
}

function groupByDate(items: AppNotification[]): Array<[string, AppNotification[]]> {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map<string, AppNotification[]>();
  for (const n of items) {
    const d = startOfDay(new Date(n.created_at));
    let label: string;
    if (d.getTime() === today.getTime()) label = "Dziś";
    else if (d.getTime() === yesterday.getTime()) label = "Wczoraj";
    else label = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "long", year: "numeric" }).format(d);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(n);
  }
  return Array.from(groups.entries());
}
function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
