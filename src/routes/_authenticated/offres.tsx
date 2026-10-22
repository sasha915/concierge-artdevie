import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, ListHeader } from "@/components/art-de-vie/app-shell";
import { EditorialOfferCard, EmptyState, Filters } from "@/components/art-de-vie/cards";
import { Skeleton } from "@/components/ui/skeleton";
import { offersQuery } from "@/lib/adv-queries";
import { t, tPair } from "@/lib/i18n";

const cats = ["Toutes", "Restaurant", "Bien-être", "Voyage", "Culture"];

export const Route = createFileRoute("/_authenticated/offres")({ head: () => ({ meta: [{ title: t("Offres privées — Art de Vie") }, { name: "description", content: t("Les privilèges partenaires réservés aux membres.") }, { property: "og:title", content: t("Offres privées — Art de Vie") }, { property: "og:description", content: t("Les privilèges partenaires réservés aux membres.") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const [active, setActive] = useState("Toutes");
  const { data: offers = [], isLoading } = useQuery(offersQuery);
  const list = active === "Toutes" ? offers : offers.filter((o) => o.category === active);
  const groups = Array.from({ length: Math.ceil(list.length / 4) }, (_, index) => list.slice(index * 4, index * 4 + 4));
  return <AppShell>
    <div className="lg:hidden"><ListHeader eyebrow="Offres" title="Les " italic="offres." introduction="Privilèges négociés par votre conciergerie."><Filters values={cats} active={active} onChange={setActive} dark /></ListHeader></div>
    <header className="mb-[22px] hidden lg:hidden">
      <h1 className="v3-heading text-[32px] text-primary">{tPair("Les ", "offres.")[0]}<em className="font-display font-normal">{tPair("Les ", "offres.")[1]}</em></h1>
      <p className="mt-2 text-[13px] text-muted-foreground">{t("Privilèges négociés par votre conciergerie.")}</p>
    </header>
    <div className="hidden lg:block"><ListHeader desktop eyebrow="Offres" title="Les " italic="offres." introduction="Privilèges négociés par votre conciergerie."><Filters values={cats} active={active} onChange={setActive} dark desktop/></ListHeader></div>
    {isLoading ? <div className="mt-4 grid grid-cols-2 gap-3 lg:mt-6"><Skeleton className="col-span-2 h-[412px] rounded-card bg-panel" /><Skeleton className="h-[268px] rounded-card bg-panel" /><Skeleton className="h-[268px] rounded-card bg-panel" /></div> : <div className="mt-3 grid gap-3 lg:mt-6 lg:gap-4">{groups.map((group, groupIndex) => <div key={group[0]?.id ?? groupIndex} className="grid grid-cols-2 gap-3 lg:grid-cols-12 lg:gap-4">{group[0] && <div className="col-span-2 lg:col-span-6"><EditorialOfferCard offer={group[0]} variant="hero" /></div>}{group[1] && <div className="lg:col-span-3 lg:h-[520px]"><EditorialOfferCard offer={group[1]} variant="tile" /></div>}{group[2] && <div className="lg:col-span-3 lg:h-[520px]"><EditorialOfferCard offer={group[2]} variant="tile" /></div>}{group[3] && <div className="col-span-2 lg:col-span-12"><EditorialOfferCard offer={group[3]} variant="feature" /></div>}</div>)}</div>}
    {!isLoading && list.length === 0 && <div className="mt-6"><EmptyState>{t("Aucune offre dans cette catégorie pour le moment.")}</EmptyState></div>}
  </AppShell>;
}
