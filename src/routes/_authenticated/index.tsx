import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell, ChevronRight, Clock3, Inbox, Sparkles } from "lucide-react";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";
import { EmptyState, OfferCard, RequestCard } from "@/components/art-de-vie/cards";
import { Button } from "@/components/ui/button";
import { formatShortDate, initials } from "@/data/art-de-vie";
import { offersQuery, profileQuery, requestsQuery } from "@/lib/adv-queries";

export const Route = createFileRoute("/_authenticated/")({ head: () => ({ meta: [{ title: "Accueil — Art de Vie" }, { name: "description", content: "Votre conciergerie privée, demandes et privilèges." }, { property: "og:title", content: "Accueil — Art de Vie" }, { property: "og:description", content: "Votre conciergerie privée, demandes et privilèges." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Home });

function Home() {
  const { data: requests = [] } = useQuery(requestsQuery);
  const { data: offers = [] } = useQuery(offersQuery);
  const { data: profile } = useQuery(profileQuery);
  const upcoming = requests.filter((r) => r.status === "Nouvelle" || r.status === "En cours" || r.status === "Confirmée");
  const nextRequest = upcoming[0];
const name = profile?.full_name?.trim() || "Membre Art de Vie";
const firstName = profile?.full_name?.split(" ")[0]?.trim() || "Membre";
const greeting = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir";

  return <AppShell><header className="mb-6 flex items-center justify-between"><Logo/><Button aria-label="Notifications" variant="icon" size="icon"><Bell/></Button></header>
    <section className="relative mb-20 overflow-visible rounded-card bg-linear-to-br from-primary to-primary-deep px-6 pb-8 pt-7 text-primary-foreground sm:px-10"><p className="mb-[10px] text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(238,237,227,0.7)]">{greeting} {firstName}</p><p className="max-w-[480px] font-display text-[38px] font-normal leading-[1.15] sm:text-[46px]">Votre conciergerie,<br/><em>à votre rythme.</em></p><p className="mt-3 max-w-[220px] text-[13px] leading-[19px] text-[rgba(238,237,227,0.75)]">Suivez vos demandes et vos privilèges, ou contactez votre concierge en un geste.</p><div className="mt-8 flex flex-wrap gap-3"><Button asChild variant="light"><Link to="/demandes/nouvelle">Nouvelle demande</Link></Button><Button asChild variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"><Link to="/offres">Voir les offres</Link></Button></div><div className="absolute -bottom-8 right-5 w-[108px] rotate-[-3deg] rounded-[14px] border border-gold bg-primary-light p-3 shadow-member"><div className="flex items-start justify-between"><Logo inverse className="h-3 w-auto" /><span className="flex size-4 items-center justify-center rounded-full border border-gold text-[7px]">{initials(name)}</span></div><p className="mt-[10px] font-display text-[13px] font-medium">{profile?.plan ?? "Signature"}</p></div></section>
    <section className="grid grid-cols-3 gap-2 sm:gap-4"><div className="rounded-card bg-card p-4 sm:p-5"><Inbox className="mb-4 size-4 text-primary"/><strong className="font-display text-2xl font-normal text-primary">{upcoming.length}</strong><p className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-xs">Demandes actives</p></div><div className="rounded-card bg-card p-4 sm:p-5"><Sparkles className="mb-4 size-4 text-primary"/><strong className="font-display text-2xl font-normal text-primary">{offers.length}</strong><p className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-xs">Offres vedettes</p></div><div className="rounded-card bg-card p-4 sm:p-5"><Clock3 className="mb-4 size-4 text-primary"/><strong className="font-display text-2xl font-normal text-primary">12 min</strong><p className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-xs">Réponse moyenne</p></div></section>
    <section className="mt-10">
      {nextRequest ? (
        <section className="mt-1 flex items-center gap-4 rounded-card bg-card p-6">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-primary-light">Prochaine demande</p>
            <p className="mt-3 font-display text-[26px] leading-[32px] font-medium text-primary">{nextRequest.title}</p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-[13px] text-muted-foreground">{formatShortDate(nextRequest.scheduled_date)}</span>
              <span className="rounded-full bg-primary px-[13px] py-[5px] text-[12px] font-medium text-primary-foreground">{nextRequest.status}</span>
            </div>
          </div>
          <Link to="/demandes/$requestId" params={{ requestId: nextRequest.id }} aria-label="Voir le détail de la demande" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
            <ChevronRight className="size-[18px]" />
          </Link>
        </section>
      ) : (
        <EmptyState>Aucune demande en cours. Confiez-nous votre prochaine envie.</EmptyState>
      )}
    </section>
    <section className="mt-10"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl text-primary">Offres en vedette</h2><Link to="/offres" aria-label="Toutes les offres" className="text-primary"><ArrowRight/></Link></div><div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">{offers.slice(0,3).map((o)=><OfferCard key={o.id} offer={o} compact/>)}</div></section>
  </AppShell>;
}
