import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, ListHeader, NewRequestButton } from "@/components/art-de-vie/app-shell";
import { EmptyState, Filters, RequestCard } from "@/components/art-de-vie/cards";
import { Skeleton } from "@/components/ui/skeleton";
import { requestsQuery } from "@/lib/adv-queries";

const filters = ["Toutes", "Nouvelle", "En cours", "Confirmée", "Terminée", "Annulée"];

export const Route = createFileRoute("/_authenticated/demandes/")({ head: () => ({ meta: [{ title: "Mes demandes — Art de Vie" }, { name: "description", content: "Suivez toutes vos demandes de conciergerie." }, { property: "og:title", content: "Mes demandes — Art de Vie" }, { property: "og:description", content: "Suivez toutes vos demandes de conciergerie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const [active, setActive] = useState("Toutes");
  const { data: requests = [], isLoading } = useQuery(requestsQuery);
  const list = active === "Toutes" ? requests : requests.filter((r) => r.status === active);
  return <AppShell>
    <div className="lg:hidden"><ListHeader eyebrow="Demandes" title="Mes " italic="demandes." introduction="Suivez l’avancement de chaque demande en temps réel."><Filters values={filters} active={active} onChange={setActive} dark /></ListHeader></div>
    <header className="mb-[22px] hidden grid-cols-[minmax(0,1fr)_auto] items-center gap-6 lg:grid">
      <div className="min-w-0">
        <h1 className="v3-heading text-[32px] text-primary">Mes <em className="font-display font-normal">demandes.</em></h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Suivez l'avancement de chaque demande en temps réel.</p>
      </div>
      <NewRequestButton className="shrink-0" />
    </header>
    <div className="hidden lg:block"><Filters values={filters} active={active} onChange={setActive}/></div>
    {isLoading ? <div className="mt-[22px] grid gap-4 lg:grid-cols-2"><Skeleton className="h-[404px] rounded-card bg-primary/10" /><Skeleton className="h-[180px] rounded-card bg-primary/10" /></div> : <div className="mt-[18px] grid gap-4 lg:mt-[22px] lg:grid-cols-2">{list.map((r, index) => <div key={r.id} className={index === 0 && r.status !== "Annulée" ? "lg:row-span-2" : ""}><RequestCard item={r} featured={index === 0}/></div>)}</div>}
    {!isLoading && list.length === 0 && <div className="mt-6"><EmptyState>Aucune demande dans cette catégorie.</EmptyState></div>}
  </AppShell>;
}
