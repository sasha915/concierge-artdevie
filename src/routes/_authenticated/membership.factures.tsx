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
import { formatAmount, formatShortDate } from "@/data/art-de-vie";
import { invoicesQuery, profileQuery } from "@/lib/adv-queries";
import { activateAutoDebit, billingStatus, payInvoice } from "@/lib/mollie.functions";

export const Route = createFileRoute("/_authenticated/membership/factures")({ head: () => ({ meta: [{ title: "Mes factures — Art de Vie" }, { name: "description", content: "Consultez votre formule et vos factures." }, { property: "og:title", content: "Mes factures — Art de Vie" }, { property: "og:description", content: "Consultez votre formule et vos factures." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const [active, setActive] = useState("Toutes");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const { data: invoices = [], isLoading } = useQuery(invoicesQuery);
  const { data: profile } = useQuery(profileQuery);
  const { data: billing } = useQuery({ queryKey: ["billing-status"], queryFn: useServerFn(billingStatus) });
  const list = active === "Toutes" ? invoices : invoices.filter((i) => i.kind === active);
  const essentiel = (billing?.plan ?? profile?.plan) === "Essentiel";
  const next = new Date();
  if (essentiel) next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("paiement")) {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [queryClient]);

  async function pay(invoiceId: string) {
    setBusy(true);
    const res = await payInvoice({ data: { invoiceId } });
    setBusy(false);
    if (res.ok) { window.location.href = res.checkoutUrl; return; }
    toast.error(res.reason === "mollie_not_configured" ? "Le paiement en ligne n'est pas encore activé." : "Impossible de préparer ce paiement.");
  }

  async function subscribe() {
    setBusy(true);
    const res = await activateAutoDebit();
    setBusy(false);
    if (res.ok) { window.location.href = res.checkoutUrl; return; }
    toast.error(res.reason === "mollie_not_configured" ? "Le prélèvement automatique n'est pas encore activé." : "Impossible de préparer le prélèvement.");
  }

  return <AppShell nav={false}><div className="mx-auto max-w-2xl"><SubHeader title="Mes factures"/>
    <section className="rounded-card bg-linear-to-br from-primary to-primary-deep p-6 text-primary-foreground">
      <span className="text-[11px] uppercase tracking-[0.13em]">Formule {profile?.plan ?? "Signature"}</span>
      <div className="mt-6 flex items-end justify-between gap-5">
        <div><strong className="font-display text-[40px] font-normal">{essentiel ? "890 €" : "1 490 €"}</strong><span className="text-sm">{essentiel ? " / an" : " / mois"}</span></div>
        <div className="text-right text-[10px] leading-4 opacity-80"><p>Prochain prélèvement<br/>{next.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>{!essentiel && <p className="mt-2">Engagement minimum<br/>12 mois</p>}</div>
      </div>
      {essentiel && <p className="mt-4 text-[10px] leading-4 opacity-80">+ 10 % de commission sur les prestations</p>}
      {billing && !billing.hasMandate && <div className="mt-5">
        <Button variant="light" className="w-full" disabled={busy || !billing.configured} onClick={subscribe}>
          <RefreshCcw className="size-4"/>{billing.configured ? "Activer le prélèvement automatique" : "Prélèvement automatique bientôt disponible"}
        </Button>
      </div>}
      {billing?.hasMandate && <p className="mt-5 flex items-center gap-2 text-[11px] opacity-80"><RefreshCcw className="size-3.5"/>Prélèvement automatique actif</p>}
    </section>
    <div className="mt-5"><Filters values={["Toutes", "Abonnement", "Prestations"]} active={active} onChange={setActive}/></div>
    <div className="mt-5 overflow-hidden rounded-card bg-card">{list.map((i) => { const unpaid = i.status !== "Payée"; return <div key={i.id} className="flex items-center gap-4 border-b border-primary/10 p-5 last:border-0">
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{i.number}</p><p className="mt-1 text-xs text-muted-foreground">{formatShortDate(i.issued_on)} · {i.kind}</p></div>
      <div className="text-right"><p className="font-display text-lg text-primary">{formatAmount(i.amount_cents)}</p>
        {unpaid && billing?.configured
          ? <Button size="sm" className="mt-1" disabled={busy} onClick={() => pay(i.id)}><CreditCard className="size-3.5"/>Payer</Button>
          : <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[9px] font-semibold ${i.status === "Payée" ? "bg-primary text-primary-foreground" : "border border-primary/25 text-muted-foreground"}`}>{i.status}</span>}
      </div>
    </div>; })}</div>
    {!isLoading && list.length === 0 && <div className="mt-6"><EmptyState>Aucune facture dans cette catégorie.</EmptyState></div>}
  </div></AppShell>;
}
