import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { EmptyState, Filters, RequestCard } from "@/components/art-de-vie/cards";
import { requestsQuery } from "@/lib/adv-queries";

export const Route = createFileRoute("/_authenticated/membership/historique")({ head: () => ({ meta: [{ title: "Historique des demandes — Art de Vie" }, { name: "description", content: "Retrouvez vos demandes passées." }, { property: "og:title", content: "Historique des demandes — Art de Vie" }, { property: "og:description", content: "Retrouvez vos demandes passées." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const [active, setActive] = useState("Toutes");
  const { data: requests = [], isLoading } = useQuery(requestsQuery);
  const history = requests.filter((r) => r.status === "Terminée" || r.status === "Annulée");
  const list = active === "Toutes" ? history : history.filter((r) => r.status === active);
  return <AppShell nav={false}><SubHeader title="Historique"/><Filters values={["Toutes", "Terminée", "Annulée"]} active={active} onChange={setActive}/>
    <div className="mt-5 grid gap-3 md:grid-cols-2">{list.map((r) => <RequestCard key={r.id} item={r}/>)}</div>
    {!isLoading && list.length === 0 && <div className="mt-6"><EmptyState>Aucune demande passée pour l’instant.</EmptyState></div>}
  </AppShell>;
}
