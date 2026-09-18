import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/art-de-vie/app-shell";
import { EmptyState, Filters, OfferCard } from "@/components/art-de-vie/cards";
import { offersQuery } from "@/lib/adv-queries";

const cats = ["Toutes", "Restaurant", "Bien-être", "Voyage", "Culture"];

export const Route = createFileRoute("/_authenticated/offres")({ head: () => ({ meta: [{ title: "Offres privées — Art de Vie" }, { name: "description", content: "Les privilèges partenaires réservés aux membres." }, { property: "og:title", content: "Offres privées — Art de Vie" }, { property: "og:description", content: "Les privilèges partenaires réservés aux membres." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const [active, setActive] = useState("Toutes");
  const { data: offers = [], isLoading } = useQuery(offersQuery);
  const list = active === "Toutes" ? offers : offers.filter((o) => o.category === active);
  return <AppShell>
    <PageHeader title="Offres" subtitle="Privilèges négociés par votre conciergerie." />
    <Filters values={cats} active={active} onChange={setActive}/>
    <div className="mt-6 grid gap-5 sm:grid-cols-2">{list.map((o) => <OfferCard key={o.id} offer={o}/>)}</div>
    {!isLoading && list.length === 0 && <div className="mt-6"><EmptyState>Aucune offre dans cette catégorie pour le moment.</EmptyState></div>}
  </AppShell>;
}
