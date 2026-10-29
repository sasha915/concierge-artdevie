import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, ListHeader, NewRequestButton } from "@/components/art-de-vie/app-shell";
import { EmptyState, ErrorState, Filters, RequestCard, RequestRow } from "@/components/art-de-vie/cards";
import { Skeleton } from "@/components/ui/skeleton";
import { recurringRequestsQuery, requestsQuery } from "@/lib/adv-queries";
import { t } from "@/lib/i18n";
import { isActiveRequest, orderForDisplay, todayInParis } from "@/lib/request-order";
import { useDelegation } from "@/components/art-de-vie/use-delegation";
import { DelegateRequestsList } from "@/components/art-de-vie/delegate";

const filters = ["Toutes", "Nouvelle", "En cours", "Confirmée", "Terminée", "Annulée"];

export const Route = createFileRoute("/_authenticated/demandes/")({ head: () => ({ meta: [{ title: t("Mes demandes — Art de Vie") }, { name: "description", content: t("Suivez toutes vos demandes de conciergerie.") }, ] }), component: Page });

function Page() {
  const { delegation } = useDelegation();
  if (delegation) return <DelegateRequestsList />;
  return <MemberPage />;
}

function MemberPage() {
  const [active, setActive] = useState("Toutes");
  const { data: requests = [], isLoading, isError, refetch } = useQuery(requestsQuery);
  const { data: recurring = [] } = useQuery(recurringRequestsQuery);
  const ordered = orderForDisplay(requests, todayInParis());
  const list = active === "Toutes" ? ordered : ordered.filter((r) => r.status === active);
  return <AppShell immersive>
    <div className="md:hidden"><ListHeader eyebrow="Demandes" title="Mes " italic="demandes." introduction="Suivez l’avancement de chaque demande en temps réel."><Filters values={filters} active={active} onChange={setActive} dark /></ListHeader></div>
    <div className="hidden md:block"><ListHeader desktop action={<NewRequestButton />} eyebrow="Demandes" title="Mes " italic="demandes." introduction="Suivez l’avancement de chaque demande en temps réel."><Filters values={filters} active={active} onChange={setActive} dark desktop /></ListHeader></div>
    {isLoading ? <div className="mt-3 grid gap-3 md:mt-5 md:gap-4 lg:grid-cols-12"><Skeleton className="h-[400px] rounded-card bg-panel md:h-[460px] lg:col-span-7 lg:h-[600px]" /><Skeleton className="h-[180px] rounded-card bg-panel lg:col-span-5 lg:h-[600px]" /></div> : <>
      {/* Mobile (maquette V4) : grande carte puis cartes empilées. */}
      <div className="mt-3 grid gap-3 md:hidden">{list.map((r, index) => <RequestCard key={r.id} item={r} featured={index === 0 && isActiveRequest(r)} />)}</div>
      {/* Ordinateur (maquette V4) : grande carte à gauche, les autres demandes en lignes dans un panneau à droite. */}
      {list.length > 0 && (() => {
        const featured = list[0] && isActiveRequest(list[0]) ? list[0] : null;
        const rest = featured ? list.slice(1) : list;
        return <div className="mt-5 hidden md:flex md:flex-wrap md:items-stretch md:gap-4">
          {featured && <div className="min-w-0 flex-[7_1_520px]"><RequestCard item={featured} featured desktop /></div>}
          {rest.length > 0 && <div className={`min-w-0 rounded-[28px] bg-panel px-6 py-2.5 ${featured ? "flex-[5_1_340px] self-start" : "flex-1"}`}>{rest.map((r) => <RequestRow key={r.id} item={r} />)}</div>}
        </div>;
      })()}
    </>}
    {isError && <div className="mt-6"><ErrorState onRetry={() => void refetch()} /></div>}
    {!isLoading && !isError && list.length === 0 && <div className="mt-6"><EmptyState>{t("Aucune demande dans cette catégorie.")}</EmptyState></div>}
    {recurring.length > 0 && <div className="mt-6"><Link to="/demandes/recurrentes" className="flex items-center justify-between gap-4 rounded-card bg-panel p-5 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span><span className="eyebrow block">{t("Demandes récurrentes")}</span><span className="mt-1 block text-[15px]">{recurring.length > 1 ? t("{n} séries en place", { n: recurring.length }) : t("{n} série en place", { n: recurring.length })}</span></span><span aria-hidden="true">→</span></Link></div>}
  </AppShell>;
}
