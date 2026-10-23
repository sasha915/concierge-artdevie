import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, ListHeader } from "@/components/art-de-vie/app-shell";
import { EmptyState, ErrorState, Filters, RequestCard } from "@/components/art-de-vie/cards";
import { Skeleton } from "@/components/ui/skeleton";
import { requestsQuery } from "@/lib/adv-queries";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/membership/historique")({ head: () => ({ meta: [{ title: t("Historique des demandes — Art de Vie") }, { name: "description", content: t("Retrouvez vos demandes passées.") }, { property: "og:title", content: t("Historique des demandes — Art de Vie") }, { property: "og:description", content: t("Retrouvez vos demandes passées.") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const [active, setActive] = useState("Toutes");
  const { data: requests = [], isLoading, isError, refetch } = useQuery(requestsQuery);
  const history = requests.filter((r) => r.status === "Terminée" || r.status === "Annulée");
  const list = active === "Toutes" ? history : history.filter((r) => r.status === active);
  const filterValues = ["Toutes", "Terminée", "Annulée"];
  return <AppShell nav={false}><div className="lg:hidden"><ListHeader eyebrow="Historique" title="Historique des " italic="demandes." introduction="Retrouvez les demandes que nous avons accompagnées."><Filters values={filterValues} active={active} onChange={setActive} dark /></ListHeader></div><div className="hidden lg:block"><ListHeader desktop eyebrow="Historique" title="Historique des " italic="demandes." introduction="Retrouvez les demandes que nous avons accompagnées."><Filters values={filterValues} active={active} onChange={setActive} dark desktop /></ListHeader></div>
    {isLoading ? <div className="mt-5 grid gap-4 md:grid-cols-2"><Skeleton className="h-[404px] rounded-card bg-panel" /><Skeleton className="h-[180px] rounded-card bg-panel" /></div> : <div className="mt-5 grid gap-4 md:grid-cols-2 lg:mt-6 lg:grid-cols-12">{list.map((r, index) => <div key={r.id} className={list[0]?.status === "Annulée" ? "lg:col-span-6" : index === 0 ? "lg:col-span-7 lg:row-span-3" : index < 4 ? "lg:col-span-5" : "lg:col-span-6"}><RequestCard item={r} featured={index === 0} desktop /></div>)}</div>}
    {isError && <div className="mt-6"><ErrorState onRetry={() => void refetch()} /></div>}
    {!isLoading && !isError && list.length === 0 && <div className="mt-6"><EmptyState>{t("Aucune demande passée pour l’instant.")}</EmptyState></div>}
  </AppShell>;
}
