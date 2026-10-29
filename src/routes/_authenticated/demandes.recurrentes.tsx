import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { EmptyState } from "@/components/art-de-vie/cards";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatTime } from "@/data/art-de-vie";
import { recurringRequestsQuery } from "@/lib/adv-queries";
import { endRecurring, setRecurringPaused } from "@/lib/messages.functions";
import { todayIn } from "@/lib/timezone";
import { nextOccurrence, rhythmEyebrow, rhythmLabel, type RecurringRule } from "@/lib/planning-rules";
import { PillAction } from "@/components/art-de-vie/v3";

/** « Chaque mardi » : jour de la semaine dans la langue de l'application. */
function eyebrowOf(r: RecurringRule & { rhythm: string }): string {
  const e = rhythmEyebrow(r);
  if (e.day === undefined) return t(e.key);
  const day = new Date(Date.UTC(2026, 0, 4 + e.day)).toLocaleDateString(locale(), { weekday: "long", timeZone: "UTC" });
  return t(e.key, { day });
}
import { locale, t } from "@/lib/i18n";

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
  const end = useServerFn(endRecurring);
  const [busy, setBusy] = useState<string | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const today = todayIn();

  async function stop(id: string) {
    setBusy(id);
    try {
      const res = await end({ data: { id } });
      if (!res.ok) toast.error(t(res.reason));
      else toast.success(t("La série s’arrête : plus aucune échéance ne sera créée."));
      setEnding(null);
      await queryClient.invalidateQueries({ queryKey: ["recurring"] });
    } catch {
      toast.error(t("Le changement n’a pas pu être enregistré."));
    } finally {
      setBusy(null);
    }
  }

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
        <p className="mb-6 max-w-[560px] text-[14px] leading-6 text-muted-foreground lg:ml-4 lg:max-w-[760px] lg:text-[18px] lg:leading-7">
          {t("Ce qui revient chaque semaine ou chaque mois, sans avoir à le redemander.")}
        </p>
        {isLoading ? (
          <Skeleton className="h-40 rounded-card bg-panel" />
        ) : rules.length === 0 ? (
          <EmptyState>{t("Aucune demande récurrente pour le moment.")}</EmptyState>
        ) : (
          <ul className="grid gap-3 lg:mx-4 lg:grid-cols-2">
            {rules.map((r) => {
              const next = nextOccurrence(r, today);
              return (
                <li key={r.id} className={`rounded-card p-5 text-primary ${r.paused ? "border border-primary/25" : "bg-panel"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="eyebrow text-muted-foreground">{eyebrowOf(r)}</p>
                      <p className="v3-card-title mt-3 text-[22px] lg:text-[26px]">{r.title}</p>
                    </div>
                    <Switch checked={!r.paused} disabled={busy === r.id} onCheckedChange={(on) => void toggle(r.id, !on)} aria-label={r.paused ? t("Reprendre la série") : t("Suspendre la série")} />
                  </div>
                  <dl className="mt-4 grid gap-1 text-[13px]">
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("Rythme")}</dt><dd>{t(rhythmLabel(r.rhythm))}{r.scheduled_time ? ` · ${formatTime(r.scheduled_time)}` : ""}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("Prochaine échéance")}</dt><dd>{r.paused ? t("Suspendue") : next ? formatDate(next) : t("Série terminée")}</dd></div>
                    {r.end_date && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{t("Jusqu’au")}</dt><dd>{formatDate(r.end_date)}</dd></div>}
                  </dl>
                  {next && (ending === r.id ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <p className="text-[13px] text-muted-foreground">{t("Mettre fin à cette série ? Les demandes déjà créées restent suivies.")}</p>
                      <Button type="button" size="sm" disabled={busy === r.id} onClick={() => void stop(r.id)}>{t("Confirmer")}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEnding(null)}>{t("Annuler")}</Button>
                    </div>
                  ) : (
                    <Button type="button" variant="link" className="mt-3 h-auto px-0 text-[13px]" onClick={() => setEnding(r.id)}>{t("Mettre fin à la série")}</Button>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-6 max-w-[560px] text-[14px] leading-6 text-muted-foreground lg:ml-4 lg:max-w-[760px]">
          {t("Chaque échéance crée une demande que vous suivez comme les autres. Vous pouvez suspendre une série ou y mettre fin à tout moment ; pour en changer le rythme ou l’horaire, écrivez-nous.")}
        </p>
        <div className="mt-5 lg:mx-4">
          <PillAction asChild className="w-full sm:w-auto">
            <Link to="/demandes/nouvelle" search={{ offer: undefined }}>{t("Créer une demande récurrente")}</Link>
          </PillAction>
        </div>
      </div>
    </AppShell>
  );
}
