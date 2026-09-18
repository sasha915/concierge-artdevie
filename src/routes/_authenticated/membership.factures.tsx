import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { EmptyState, Filters } from "@/components/art-de-vie/cards";
import { formatAmount, formatShortDate } from "@/data/art-de-vie";
import { invoicesQuery, profileQuery } from "@/lib/adv-queries";

export const Route = createFileRoute("/_authenticated/membership/factures")({ head: () => ({ meta: [{ title: "Mes factures — Art de Vie" }, { name: "description", content: "Consultez votre formule et vos factures." }, { property: "og:title", content: "Mes factures — Art de Vie" }, { property: "og:description", content: "Consultez votre formule et vos factures." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const [active, setActive] = useState("Toutes");
  const { data: invoices = [], isLoading } = useQuery(invoicesQuery);
  const { data: profile } = useQuery(profileQuery);
  const list = active === "Toutes" ? invoices : invoices.filter((i) => i.kind === active);
  const essentiel = profile?.plan === "Essentiel";
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return <AppShell nav={false}><div className="mx-auto max-w-2xl"><SubHeader title="Mes factures"/>
    <section className="rounded-card bg-linear-to-br from-primary to-primary-deep p-6 text-primary-foreground">
      <span className="text-[11px] uppercase tracking-[0.13em]">Formule {profile?.plan ?? "Signature"}</span>
      <div className="mt-6 flex items-end justify-between gap-5">
        <div><strong className="font-display text-[40px] font-normal">{essentiel ? "890 €" : "1 490 €"}</strong><span className="text-sm">{essentiel ? " / an" : " / mois"}</span></div>
        <span className="text-right text-[10px] leading-4 opacity-80">Prochain prélèvement<br/>{next.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
      </div>
      {essentiel && <p className="mt-4 text-[10px] leading-4 opacity-80">+ 10 % de commission sur les prestations</p>}
    </section>
    <div className="mt-8"><Filters values={["Toutes", "Abonnement", "Prestations"]} active={active} onChange={setActive}/></div>
    <div className="mt-5 overflow-hidden rounded-card bg-card">{list.map((i) => <div key={i.id} className="flex items-center gap-4 border-b border-primary/10 p-5 last:border-0">
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{i.number}</p><p className="mt-1 text-xs text-muted-foreground">{formatShortDate(i.issued_on)} · {i.kind}</p></div>
      <div className="text-right"><p className="font-display text-lg text-primary">{formatAmount(i.amount_cents)}</p><span className="mt-1 inline-block rounded-full bg-primary px-2.5 py-1 text-[9px] font-semibold text-primary-foreground">{i.status}</span></div>
    </div>)}</div>
    {!isLoading && list.length === 0 && <div className="mt-6"><EmptyState>Aucune facture dans cette catégorie.</EmptyState></div>}
  </div></AppShell>;
}
