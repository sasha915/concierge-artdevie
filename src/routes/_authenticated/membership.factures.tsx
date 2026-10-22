import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CreditCard, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { EmptyState, Filters } from "@/components/art-de-vie/cards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PillAction } from "@/components/art-de-vie/v3";
import { formatAmount, formatShortDate } from "@/data/art-de-vie";
import { ratePercent } from "@/lib/billing-rules";
import { invoicesQuery, planQuery, profileQuery } from "@/lib/adv-queries";
import { activateAutoDebit, billingStatus, payInvoice } from "@/lib/mollie.functions";
import { getLang, locale, t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/membership/factures")({
  head: () => ({
    meta: [
      { title: t("Mes factures — Art de Vie") },
      { name: "description", content: t("Consultez votre formule et vos factures.") },
      { property: "og:title", content: t("Mes factures — Art de Vie") },
      { property: "og:description", content: t("Consultez votre formule et vos factures.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const [active, setActive] = useState("Toutes");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const { data: invoices = [], isLoading } = useQuery(invoicesQuery);
  const { data: profile } = useQuery(profileQuery);
  const { data: billing } = useQuery({ queryKey: ["billing-status"], queryFn: useServerFn(billingStatus) });
  const list = active === "Toutes" ? invoices : invoices.filter((i) => i.kind === active);
  const planName = billing?.plan ?? profile?.plan ?? null;
  const essentiel = planName === "Essentiel";
  const { data: plan } = useQuery(planQuery(planName));
  const next = new Date();
  if (plan ? plan.period === "an" : essentiel) next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("paiement")) {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [queryClient]);

  async function pay(invoiceId: string) {
    setBusy(true);
    try {
      const res = await payInvoice({ data: { invoiceId } });
      if (res.ok) {
        window.location.href = res.checkoutUrl;
        return;
      }
      toast.error(t(
        res.reason === "mollie_not_configured"
          ? "Le paiement en ligne n'est pas encore activé."
          : "Impossible de préparer ce paiement.",
      ));
    } catch {
      toast.error(t("Impossible de préparer ce paiement."));
    } finally {
      setBusy(false);
    }
  }

  async function subscribe() {
    setBusy(true);
    try {
      const res = await activateAutoDebit();
      if (res.ok) {
        window.location.href = res.checkoutUrl;
        return;
      }
      toast.error(t(
        res.reason === "mollie_not_configured"
          ? "Le prélèvement automatique n'est pas encore activé."
          : "Impossible de préparer le prélèvement.",
      ));
    } catch {
      toast.error(t("Impossible de préparer le prélèvement."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-3xl lg:max-w-none">
        <SubHeader title="Mes factures" />
        <section className="rounded-[28px] bg-primary-deep p-6 text-foreground sm:p-8 lg:mx-4 lg:p-10">
          <span className="eyebrow text-foreground/80">{t("Formule {name}", { name: profile?.plan ?? "Signature" })}</span>
          <div className="mt-6 flex items-end justify-between gap-5">
            <div>
              <strong className="font-display text-[40px] lg:text-[88px] font-normal">
                {plan ? formatAmount(plan.price_cents) : "—"}
              </strong>
              <span className="text-sm">{plan ? (plan.period === "an" ? t(" / an") : t(" / mois")) : ""}</span>
            </div>
            <div className="text-right text-[10px] leading-4 opacity-80">
              <p>
                {t("Prochain prélèvement")}
                <br />
                {next.toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" })}
              </p>
              {plan?.min_commitment_months && (
                <p className="mt-2">
                  {t("Engagement minimum")}
                  <br />
                  {t("{n} mois", { n: plan.min_commitment_months })}
                </p>
              )}
            </div>
          </div>
          {essentiel && (
            <p className="mt-4 text-[10px] leading-4 opacity-80">{t("+ 10 % de commission sur les prestations")}</p>
          )}
          {billing && !billing.hasMandate && (
            <div className="mt-5">
              <Button
                variant="light"
                size="lg"
                className="w-full"
                disabled={busy || !billing.configured}
                onClick={subscribe}
              >
                <RefreshCcw className="size-4" />
                {billing.configured
                  ? t("Activer le prélèvement automatique")
                  : t("Prélèvement automatique bientôt disponible")}
              </Button>
            </div>
          )}
          {billing?.hasMandate && (
            <p className="mt-5 flex items-center gap-2 text-[11px] opacity-80">
              <RefreshCcw className="size-3.5" />
              {t("Prélèvement automatique actif")}
            </p>
          )}
        </section>
        <div className="mt-5 lg:mx-4 lg:mt-16 lg:rounded-[28px] lg:bg-primary-deep lg:p-6">
          <Filters
            values={["Toutes", "Abonnement", "Prestations"]}
            active={active}
            onChange={setActive}
            desktop
            desktopDark
          />
        </div>
        {isLoading ? (
          <div className="mt-5 grid gap-3">
            <Skeleton className="h-24 rounded-card bg-panel" />
            <Skeleton className="h-24 rounded-card bg-panel" />
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-card bg-panel px-5 lg:mx-4 lg:px-8">
            {list.map((i) => {
              const unpaid = i.status !== "Payée";
              return (
                <div key={i.id} className="flex items-center gap-4 border-b border-primary/25 py-5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{i.number}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatShortDate(i.issued_on)} · {t(i.kind)}
                    </p>
                    {i.service_cents != null && (
                      <dl className="mt-2 grid gap-0.5 text-xs text-muted-foreground">
                        <div className="flex gap-2">
                          <dt>{t("Prestation")}</dt>
                          <dd>{formatAmount(i.service_cents)}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt>{t("Commission")}{i.commission_rate ? ` (${getLang() === "en" ? ratePercent(i.commission_rate).replace(" %", "%") : ratePercent(i.commission_rate)})` : ""}</dt>
                          <dd>{formatAmount(i.commission_cents ?? 0)}</dd>
                        </div>
                      </dl>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg lg:text-[26px] text-primary">{formatAmount(i.amount_cents)}</p>
                    {unpaid && billing?.configured ? (
                      <PillAction size="sm" className="mt-1 h-11 pl-4" disabled={busy} onClick={() => pay(i.id)}>
                        <CreditCard className="size-3.5" />
                        {t("Payer")}
                      </PillAction>
                    ) : (
                      <span
                        className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[9px] font-semibold ${i.status === "Payée" ? "bg-primary text-background" : "border border-primary/25 text-muted-foreground"}`}
                      >
                        {t(i.status)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && list.length === 0 && (
          <div className="mt-6">
            <EmptyState>{t("Aucune facture dans cette catégorie.")}</EmptyState>
          </div>
        )}
      </div>
    </AppShell>
  );
}
