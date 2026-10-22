import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { EmptyState } from "@/components/art-de-vie/cards";
import { PillAction } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatShortDate } from "@/data/art-de-vie";
import { profileQuery, statementSourceQuery } from "@/lib/adv-queries";
import { monthLabel, shiftMonth, statementLines, statementTotal } from "@/lib/member-rules";
import { getLang, t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/membership/releve")({
  head: () => ({
    meta: [
      { title: t("Mon relevé — Art de Vie") },
      { name: "description", content: t("Le relevé mensuel de vos prestations.") },
      { property: "og:title", content: t("Mon relevé — Art de Vie") },
      { property: "og:description", content: t("Le relevé mensuel de vos prestations.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const { data: rows = [], isLoading } = useQuery(statementSourceQuery);
  const { data: profile } = useQuery(profileQuery);
  const lines = statementLines(rows, month);
  const total = statementTotal(lines);
  const current = new Date().toISOString().slice(0, 7);

  async function download() {
    setBusy(true);
    try {
      const { downloadStatement } = await import("@/lib/statement-pdf");
      await downloadStatement({ lang: getLang(), month, memberName: profile?.full_name ?? "", memberNumber: profile?.member_number ?? null, lines });
    } catch {
      toast.error(t("Le relevé n’a pas pu être préparé."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-3xl lg:max-w-none">
        <SubHeader title="Mon relevé" />
        <section aria-label={t("Mois du relevé")} className="rounded-[28px] bg-primary-deep p-6 text-foreground sm:p-8 lg:mx-[clamp(20px,3.9vw,56px)] lg:p-10">
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" size="icon" aria-label={t("Mois précédent")} onClick={() => setMonth((m) => shiftMonth(m, -1))} className="border-foreground/22 text-foreground hover:bg-foreground/10">
              <ChevronLeft />
            </Button>
            <p className="eyebrow text-foreground/80" aria-live="polite">{monthLabel(month, getLang())}</p>
            <Button type="button" variant="outline" size="icon" aria-label={t("Mois suivant")} disabled={month >= current} onClick={() => setMonth((m) => shiftMonth(m, 1))} className="border-foreground/22 text-foreground hover:bg-foreground/10">
              <ChevronRight />
            </Button>
          </div>
          <p className="mt-8 text-[13px] opacity-80">{t("Total du mois")}</p>
          <strong className="mt-1 block font-display text-[48px] font-normal italic leading-none lg:text-[88px]">{formatAmount(total)}</strong>
        </section>

        {isLoading ? (
          <Skeleton className="mt-5 h-40 rounded-card bg-primary/10 lg:mx-[clamp(20px,3.9vw,56px)]" />
        ) : lines.length === 0 ? (
          <div className="mt-6 lg:mx-[clamp(20px,3.9vw,56px)]">
            <EmptyState>{t("Aucune prestation ce mois-ci.")}</EmptyState>
          </div>
        ) : (
          <ul className="mt-5 overflow-hidden rounded-card bg-primary/10 px-5 text-primary lg:mx-[clamp(20px,3.9vw,56px)] lg:px-8">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-4 border-b border-primary/25 py-5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatShortDate(l.date)}</p>
                </div>
                <p className="font-display text-lg text-primary lg:text-[26px]">{formatAmount(l.amount_cents)}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 lg:mx-[clamp(20px,3.9vw,56px)]">
          <PillAction type="button" disabled={busy || isLoading} onClick={() => void download()} className="w-full sm:w-auto">
            <Download className="size-4" />
            {t("Télécharger le relevé")}
          </PillAction>
        </div>
      </div>
    </AppShell>
  );
}
