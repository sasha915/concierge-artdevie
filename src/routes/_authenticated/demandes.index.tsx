import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, ListHeader } from "@/components/art-de-vie/app-shell";
import { EmptyState, Filters, RequestCard } from "@/components/art-de-vie/cards";
import { Skeleton } from "@/components/ui/skeleton";
import { recurringRequestsQuery, requestsQuery } from "@/lib/adv-queries";
import { t } from "@/lib/i18n";

const filters = ["Toutes", "Nouvelle", "En cours", "Confirmée", "Terminée", "Annulée"];

export const Route = createFileRoute("/_authenticated/demandes/")({ head: () => ({ meta: [{ title: t("Mes demandes — Art de Vie") }, { name: "description", content: t("Suivez toutes vos demandes de conciergerie.") }, { property: "og:title", content: t("Mes demandes — Art de Vie") }, { property: "og:description", content: t("Suivez toutes vos demandes de conciergerie.") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const [active, setActive] = useState("Toutes");
  const { data: requests = [], isLoading } = useQuery(requestsQuery);
  const { data: recurring = [] } = useQuery(recurringRequestsQuery);
  const list = active === "Toutes" ? requests : requests.filter((r) => r.status === active);
  return <AppShell>
    <div className="lg:hidden"><ListHeader eyebrow="Demandes" title="Mes " italic="demandes." introduction="Suivez l’avancement de chaque demande en temps réel."><Filters values={filters} active={active} onChange={setActive} dark /></ListHeader></div>
    <div className="hidden lg:block"><ListHeader desktop eyebrow="Demandes" title="Mes " italic="demandes." introduction="Suivez l’avancement de chaque demande en temps réel."><Filters values={filters} active={active} onChange={setActive} dark desktop /></ListHeader></div>
    {isLoading ? <div className="mt-[22px] grid gap-4 lg:grid-cols-2"><Skeleton className="h-[404px] rounded-card bg-primary/10" /><Skeleton className="h-[180px] rounded-card bg-primary/10" /></div> : <div className="mt-[18px] grid gap-4 lg:mx-[clamp(4px,2.8vw,40px)] lg:mt-16 lg:grid-cols-12 lg:gap-4">{list.map((r, index) => <div key={r.id} className={list[0]?.status === "Annulée" ? "lg:col-span-6" : index === 0 ? "lg:col-span-7 lg:row-span-3" : index < 4 ? "lg:col-span-5" : "lg:col-span-6"}><RequestCard item={r} featured={index === 0} desktop/></div>)}</div>}
    {!isLoading && list.length === 0 && <div className="mt-6"><EmptyState>{t("Aucune demande dans cette catégorie.")}</EmptyState></div>}
    {recurring.length > 0 && <div className="mt-6 lg:mx-[clamp(4px,2.8vw,40px)]"><Link to="/demandes/recurrentes" className="flex items-center justify-between gap-4 rounded-card bg-primary/10 p-5 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span><span className="eyebrow block">{t("Demandes récurrentes")}</span><span className="mt-1 block text-[15px]">{recurring.length > 1 ? t("{n} séries en place", { n: recurring.length }) : t("{n} série en place", { n: recurring.length })}</span></span><span aria-hidden="true">→</span></Link></div>}
  </AppShell>;
}
