import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { EmptyState } from "@/components/art-de-vie/cards";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatTime } from "@/data/art-de-vie";
import { recurringRequestsQuery } from "@/lib/adv-queries";
import { setRecurringPaused } from "@/lib/messages.functions";
import { nextOccurrence, rhythmLabel } from "@/lib/planning-rules";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/demandes/recurrentes")({
  head: () => ({
    meta: [
      { title: t("Mes demandes récurrentes — Art de Vie") },
      { name: "description", content: t("Vos demandes qui se renouvellent à intervalle régulier.") },
      { property: "og:title", content: t("Mes demandes récurrentes — Art de Vie") },
      { property: "og:description", content: t("Vos demandes qui se renouvellent à intervalle régulier.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const { data: rules = [], isLoading } = useQuery(recurringRequestsQuery);
  const pause = useServerFn(setRecurringPaused);
  const [busy, setBusy] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function toggle(id: string, paused: boolean) {
    setBusy(id);
    try {
      const res = await pause({ data: { id, paused } });
      if (!res.ok) toast.error(t(res.reason));
      await queryClient.invalidateQueries({ queryKey: ["recurring"] });
    } catch {
      toast.error(t("Le changement n’a pas pu être enregistré."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-3xl lg:max-w-none">
        <SubHeader title="Mes demandes récurrentes" backTo="/demandes" />
        <p className="mb-6 max-w-[560px] text-[14px] leading-6 text-muted-foreground lg:ml-[clamp(20px,3.9vw,56px)] lg:max-w-[760px] lg:text-[18px] lg:leading-7">
          {t("Chaque échéance crée une demande que vous suivez comme les autres. Vous pouvez la suspendre à tout moment.")}
        </p>
        {isLoading ? (
          <Skeleton className="h-40 rounded-card bg-primary/10" />
        ) : rules.length === 0 ? (
          <EmptyState>{t("Aucune demande récurrente pour le moment.")}</EmptyState>
        ) : (
          <ul className="grid gap-3 lg:mx-[clamp(20px,3.9vw,56px)] lg:grid-cols-2">
            {rules.map((r) => {
              const next = nextOccurrence(r, today);
              return (
                <li key={r.id} className={`rounded-card p-5 text-primary ${r.paused ? "border border-primary/25" : "bg-primary/10"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="eyebrow">{t(r.category)}</p>
                      <p className="v3-card-title mt-3 text-[22px] lg:text-[26px]">{r.title}</p>
                    </div>
                    <Switch checked={!r.paused} disabled={busy === r.id} onCheckedChange={(on) => void toggle(r.id, !on)} aria-label={r.paused ? t("Reprendre la série") : t("Suspendre la série")} />
                  </div>
                  <dl className="mt-4 grid gap-1 text-[13px]">
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("Rythme")}</dt><dd>{t(rhythmLabel(r.rhythm))}{r.scheduled_time ? ` · ${formatTime(r.scheduled_time)}` : ""}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("Prochaine échéance")}</dt><dd>{r.paused ? t("Suspendue") : next ? formatDate(next) : t("Série terminée")}</dd></div>
                    {r.end_date && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("Jusqu’au")}</dt><dd>{formatDate(r.end_date)}</dd></div>}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
