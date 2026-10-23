import { todayParis } from "@/lib/billing-webhook-rules";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { EmptyState } from "@/components/art-de-vie/cards";
import { PillAction } from "@/components/art-de-vie/v3";
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
  const [month, setMonth] = useState(() => todayParis().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const { data: rows = [], isLoading } = useQuery(statementSourceQuery);
  const { data: profile } = useQuery(profileQuery);
  const lines = statementLines(rows, month, profile?.plan);
  const total = statementTotal(lines);
  const current = todayParis().slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(current, -i));

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
        <section className="rounded-[28px] bg-panel p-6 text-foreground sm:p-8 lg:mx-4 lg:p-10">
          <div role="group" aria-label={t("Mois du relevé")} className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:px-0">
            {months.map((m) => (
              <button key={m} type="button" aria-pressed={m === month} onClick={() => setMonth(m)} className={`h-11 shrink-0 rounded-full px-[18px] text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${m === month ? "bg-primary text-primary-foreground" : "border border-foreground/24 bg-foreground/8 hover:bg-foreground/15"}`}>
                {monthLabel(m, getLang()).replace(/\s\d{4}$/, "")}
              </button>
            ))}
          </div>
          <p className="eyebrow mt-8 text-muted-foreground" aria-live="polite">{monthLabel(month, getLang())}</p>
          <strong className="mt-3 block font-display text-[48px] font-normal italic leading-none lg:text-[88px]">{formatAmount(total)}</strong>
          <p className="mt-3 text-[14px] text-muted-foreground">{t("Total du mois")} · {lines.length > 1 ? t("{n} prestations ce mois-ci", { n: lines.length }) : t("{n} prestation ce mois-ci", { n: lines.length })}</p>
          {lines.some((l) => l.estimated) && <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{t("Commission comprise. Les prestations pas encore facturées sont estimées ; la facture fait foi.")}</p>}
        </section>

        {isLoading ? (
          <Skeleton className="mt-5 h-40 rounded-card bg-panel lg:mx-4" />
        ) : lines.length === 0 ? (
          <div className="mt-6 lg:mx-4">
            <EmptyState>{t("Aucune prestation ce mois-ci.")}</EmptyState>
          </div>
        ) : (
          <ul className="mt-5 overflow-hidden rounded-card bg-panel px-5 text-primary lg:mx-4 lg:px-8">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-4 border-b border-primary/25 py-5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatShortDate(l.date)}{l.estimated ? ` · ${t("estimation, pas encore facturée")}` : ""}</p>
                </div>
                <p className="font-display text-lg text-primary lg:text-[26px]">{formatAmount(l.amount_cents)}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 lg:mx-4">
          <PillAction type="button" disabled={busy || isLoading} onClick={() => void download()} className="w-full sm:w-auto">
            <Download className="size-4" />
            {t("Télécharger le relevé")}
          </PillAction>
        </div>
      </div>
    </AppShell>
  );
}
