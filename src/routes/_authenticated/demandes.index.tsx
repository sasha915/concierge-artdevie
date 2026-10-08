import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, NewRequestButton, PageHeader } from "@/components/art-de-vie/app-shell";
import { EmptyState, Filters, RequestCard } from "@/components/art-de-vie/cards";
import { requestsQuery } from "@/lib/adv-queries";

const filters = ["Toutes", "Nouvelle", "En cours", "Confirmée", "Terminée", "Annulée"];

export const Route = createFileRoute("/_authenticated/demandes/")({ head: () => ({ meta: [{ title: "Mes demandes — Art de Vie" }, { name: "description", content: "Suivez toutes vos demandes de conciergerie." }, { property: "og:title", content: "Mes demandes — Art de Vie" }, { property: "og:description", content: "Suivez toutes vos demandes de conciergerie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const [active, setActive] = useState("Toutes");
  const { data: requests = [], isLoading } = useQuery(requestsQuery);
  const list = active === "Toutes" ? requests : requests.filter((r) => r.status === active);
  return <AppShell>
    <div className="lg:hidden">
      <PageHeader title="Mes demandes" subtitle="Suivez l'avancement de chaque demande en temps réel." />
    </div>
    <header className="mb-[22px] hidden grid-cols-[minmax(0,1fr)_auto] items-center gap-6 lg:grid">
      <div className="min-w-0">
        <h1 className="font-display text-[32px] font-semibold leading-tight text-primary">Mes demandes</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Suivez l'avancement de chaque demande en temps réel.</p>
      </div>
      <NewRequestButton className="shrink-0" />
    </header>
    <Filters values={filters} active={active} onChange={setActive}/>
    <div className="mt-[22px] grid gap-3 md:grid-cols-2 lg:grid-cols-3">{list.map((r) => <RequestCard key={r.id} item={r}/>)}</div>
    {!isLoading && list.length === 0 && <div className="mt-6"><EmptyState>Aucune demande dans cette catégorie.</EmptyState></div>}
  </AppShell>;
}
