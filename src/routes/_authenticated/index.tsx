import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell, CalendarDays, ChevronRight, Search } from "lucide-react";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";
import { EmptyState, OfferCard, StatusBadge } from "@/components/art-de-vie/cards";
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

  return <AppShell><header className="mb-6 flex items-center justify-between lg:hidden"><Logo/><Button aria-label="Notifications" variant="icon" size="icon"><Bell/></Button></header>
    <header className="mb-6 hidden grid-cols-[minmax(0,1fr)_auto] items-center gap-6 lg:grid"><h1 className="truncate font-display text-[22px] font-semibold text-primary">Tableau de bord</h1><div className="flex shrink-0 items-center gap-2"><Button aria-label="Rechercher" variant="icon" size="icon"><Search /></Button><Button aria-label="Notifications" variant="icon" size="icon"><Bell/></Button></div></header>
    <section className="relative mb-[22px] overflow-visible rounded-card bg-linear-to-br from-primary to-primary-deep px-6 pb-8 pt-7 text-primary-foreground sm:px-10 lg:min-h-[300px] lg:overflow-hidden lg:px-12 lg:py-10"><div className="pointer-events-none absolute -right-20 -top-24 hidden size-[320px] rounded-full bg-radial from-primary-foreground/16 to-transparent to-70% lg:block"/><div className="relative z-10 lg:max-w-[480px]"><p className="mb-[10px] text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(238,237,227,0.7)]">{greeting} {firstName}</p><p className="max-w-[480px] font-display text-[38px] font-normal leading-[1.15] sm:text-[46px]">Votre conciergerie,<br/><em>à votre rythme.</em></p><p className="mt-3 max-w-[220px] text-[13px] leading-[19px] text-[rgba(238,237,227,0.75)] lg:max-w-[420px]">Suivez vos demandes et vos privilèges, ou contactez votre concierge en un geste.</p><div className="mt-8 flex flex-wrap gap-3"><Button asChild variant="light"><Link to="/demandes/nouvelle">Nouvelle demande</Link></Button><Button asChild variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"><Link to="/offres">Voir les offres</Link></Button></div></div><div className="absolute -bottom-8 right-5 z-20 w-[108px] rotate-[-3deg] rounded-[14px] border border-gold bg-primary-light p-3 shadow-member lg:bottom-auto lg:right-12 lg:top-1/2 lg:w-[210px] lg:-translate-y-1/2 lg:p-5"><div className="flex items-start justify-between"><Logo inverse className="h-3 w-auto lg:h-5" /><span className="flex size-4 items-center justify-center rounded-full border border-gold text-[7px] lg:size-8 lg:text-[10px]">{initials(name)}</span></div><p className="mt-[10px] font-display text-[13px] font-medium lg:mt-8 lg:text-xl">{profile?.plan ?? "Signature"}</p><p className="mt-1 hidden text-[9px] font-medium uppercase tracking-[0.13em] text-primary-foreground/60 lg:block">{name}</p></div></section>
    <section className="grid grid-cols-3 gap-2">
      <div className="rounded-[16px] bg-card py-[14px] px-3 text-center lg:rounded-[18px] lg:px-[22px] lg:py-5">
        <p className="font-display text-[22px] font-medium text-primary lg:text-[26px]">{upcoming.length}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Demandes actives</p>
      </div>
      <div className="rounded-[16px] bg-card py-[14px] px-3 text-center lg:rounded-[18px] lg:px-[22px] lg:py-5">
        <p className="font-display text-[22px] font-medium text-primary lg:text-[26px]">{offers.length}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Offres vedettes</p>
      </div>
      <div className="rounded-[16px] bg-card py-[14px] px-3 text-center lg:rounded-[18px] lg:px-[22px] lg:py-5">
        <p className="font-display text-[22px] font-medium text-primary lg:text-[26px]">12 min</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Réponse moyenne</p>
      </div>
    </section>
    <section className="mt-[22px] lg:hidden">
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
    <section className="mt-[22px] lg:hidden"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl text-primary">Offres en vedette</h2><Link to="/offres" aria-label="Toutes les offres" className="text-primary"><ArrowRight/></Link></div><div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">{offers.slice(0,3).map((o)=><OfferCard key={o.id} offer={o} compact/>)}</div></section>
    <section className="mt-[22px] hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] gap-[22px] lg:grid">
      <div className="min-w-0"><div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><h2 className="truncate font-display text-[24px] font-medium text-primary">Demandes récentes</h2><Link to="/demandes" className="text-[12px] font-semibold text-primary">Tout voir</Link></div><div className="grid gap-3">{requests.length > 0 ? requests.slice(0, 3).map((item) => <Link key={item.id} to="/demandes/$requestId" params={{ requestId: item.id }} className="block rounded-[16px] bg-card p-4 transition-transform hover:-translate-y-0.5"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><div className="min-w-0"><span className="eyebrow">{item.category}</span><h3 className="mt-2 truncate font-display text-[19px] font-medium text-primary">{item.title}</h3><p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"><CalendarDays className="size-3.5 shrink-0" />{formatShortDate(item.scheduled_date)}</p></div><StatusBadge status={item.status} /></div></Link>) : <EmptyState>Aucune demande pour le moment.</EmptyState>}</div></div>
      <div className="min-w-0"><div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><h2 className="truncate font-display text-[24px] font-medium text-primary">Privilèges en vedette</h2><Link to="/offres" className="text-[12px] font-semibold text-primary">Tout voir</Link></div><div className="grid grid-cols-2 gap-3">{offers.slice(0, 4).map((offer) => <OfferCard key={offer.id} offer={offer} compact />)}</div></div>
    </section>
  </AppShell>;
}
