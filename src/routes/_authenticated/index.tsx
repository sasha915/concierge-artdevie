import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { AppShell, Logo, TopBar } from "@/components/art-de-vie/app-shell";
import { EmptyState, OfferCard, Photo, StatusBadge } from "@/components/art-de-vie/cards";
import { ArrowCircle, Counter, PillAction, StatusTimeline, Title } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatShortDate, imageFor, initials, type Offer, type Profile, type RequestItem } from "@/data/art-de-vie";
import { offersQuery, profileQuery, requestsQuery } from "@/lib/adv-queries";
import vendome from "@/assets/v3/place-vendome.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/")({ head: () => ({ meta: [{ title: "Accueil — Art de Vie" }, { name: "description", content: "Votre conciergerie privée, demandes et privilèges." }, { property: "og:title", content: "Accueil — Art de Vie" }, { property: "og:description", content: "Votre conciergerie privée, demandes et privilèges." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Home });

function CurrentRequest({ item }: { item: RequestItem }) {
  return <Link to="/demandes/$requestId" params={{ requestId: item.id }} className="dark-glass block rounded-[24px] p-4 transition-transform active:scale-[0.98] lg:max-w-[460px]">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><span className="eyebrow text-primary-foreground">Demande en cours</span><StatusBadge status={item.status} onPhoto /></div>
    <h2 className="v3-card-title mt-4 text-[23px]">{item.title}</h2>
    <p className="mt-2 text-[12px] leading-5">{formatDate(item.scheduled_date)}{item.scheduled_time ? ` · ${item.scheduled_time.slice(0, 5).replace(":", " h ")}` : ""}</p>
    <div className="mt-4"><StatusTimeline status={item.status} dark /></div>
  </Link>;
}

function MiniMember({ profile }: { profile: Profile | null | undefined }) {
  return <div className="member-grain w-[120px] rotate-[-4deg] rounded-[14px] border border-gold p-3 text-primary-foreground shadow-member"><div className="flex items-center justify-between gap-2"><Logo inverse className="h-3 w-auto" /><span className="flex size-4 items-center justify-center rounded-full border border-gold text-[7px]">{initials(profile?.full_name ?? "")}</span></div><p className="mt-5 font-display text-sm">{profile?.plan ?? "—"}</p></div>;
}

function HomeOffer({ offer }: { offer: Offer }) {
  return <Link to="/offres" className="relative block h-[336px] w-[252px] shrink-0 overflow-hidden rounded-card text-primary-foreground transition-transform active:scale-[0.98]">
    <Photo src={imageFor(offer.image_key)} alt={offer.title} category={offer.category} className="absolute inset-0 h-full" />
    <div className="absolute inset-x-4 top-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2"><span className="dark-glass w-fit rounded-full px-3 py-2 text-[11px] font-medium uppercase tracking-[0.13em]">{offer.category}</span><ArrowCircle diagonal /></div>
    <div className="absolute inset-x-5 bottom-5"><h3 className="v3-card-title text-[25px]">{offer.title}</h3><p className="mt-2 text-[13px]">{offer.partner}</p></div>
  </Link>;
}

function Home() {
  const { data: requests = [], isPending: requestsPending } = useQuery(requestsQuery);
  const { data: offers = [], isPending: offersPending } = useQuery(offersQuery);
  const { data: profile } = useQuery(profileQuery);
  const [greeting, setGreeting] = useState("Bonjour");
  useEffect(() => { setGreeting(new Date().getHours() < 18 ? "Bonjour" : "Bonsoir"); }, []);
  const upcoming = requests.filter((r) => r.status === "Nouvelle" || r.status === "En cours" || r.status === "Confirmée");
  const nextRequest = upcoming[0];
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "";
  const conciergeFirstName = profile?.concierge_referent?.split(/\s+/)[0] ?? null;
  const whatsappDigits = profile?.concierge_whatsapp?.replace(/[^0-9]/g, "") ?? "";
  const showConcierge = profile?.plan === "Signature" && Boolean(conciergeFirstName) && whatsappDigits.length > 0;
  const whatsappUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Bonjour ${conciergeFirstName ?? ""}, j'aimerais échanger avec vous.`)}`;

  return <AppShell immersive>
    <header className="mb-6 hidden lg:block"><h1 className="v3-card-title text-[22px] text-primary">Tableau de bord</h1></header>
    <section className="relative flex min-h-[600px] flex-col overflow-hidden rounded-[28px] p-[14px] text-primary-foreground lg:min-h-[380px] lg:p-6">
      <Photo src={vendome.url} alt="La place Vendôme à Paris" hero eager className="absolute inset-0 h-full w-full" />
      <div className="relative"><TopBar /></div>
      <div className="relative mt-10 lg:absolute lg:right-6 lg:top-[98px] lg:mt-0 lg:w-[40%]">{requestsPending ? <Skeleton className="h-[164px] rounded-card bg-primary-foreground/15" /> : nextRequest ? <CurrentRequest item={nextRequest} /> : null}</div>
      <div className="relative mt-auto px-1 pb-1 pt-10 lg:max-w-[52%] lg:pt-12">
        <p className="eyebrow mb-5 text-primary-foreground">{greeting}{firstName ? ` ${firstName}` : ""}</p>
        <Title as="h2" italic={<>à votre rythme.</>} className="text-[47px]">Votre<br className="lg:hidden" /> conciergerie,<br /></Title>
        <PillAction asChild light className="mt-7"><Link to="/demandes/nouvelle" search={{ offer: undefined }}>Nouvelle demande</Link></PillAction>
      </div>
      <div className="absolute bottom-8 right-9 hidden lg:block"><MiniMember profile={profile} /></div>
    </section>
    <section aria-label="Votre activité" className="mx-2 mb-8 mt-9 grid grid-cols-2 gap-4 lg:mb-6 lg:mt-6 lg:gap-6">
      <div className="border-t border-primary/25 pt-6 text-primary">{requestsPending ? <Skeleton className="h-[72px] w-16 bg-primary/10" /> : <Counter value={upcoming.length} />}<p className="mt-1 text-[15px]">demandes actives</p></div>
      <div className="border-t border-primary/25 pt-6 text-primary">{offersPending ? <Skeleton className="h-[72px] w-16 bg-primary/10" /> : <Counter value={offers.length} />}<p className="mt-1 text-[15px]">offres en vedette</p></div>
    </section>
    <section className="grid grid-cols-2 gap-3 lg:hidden">
      <Link to="/membership" className="flex min-h-[208px] min-w-0 flex-col justify-between rounded-[28px] bg-primary/10 p-[18px] text-primary transition-transform active:scale-[0.98]"><MiniMember profile={profile} /><div><p className="eyebrow mt-6">Membership</p><h2 className="v3-card-title mt-2 text-[21px]">Votre carte</h2></div></Link>
      {showConcierge && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex min-h-[208px] min-w-0 flex-col justify-between rounded-[28px] bg-primary-deep p-[18px] text-primary-foreground transition-transform active:scale-[0.98]"><div className="flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-full bg-primary-foreground/16"><MessageCircle className="size-5" /></span><ArrowCircle diagonal /></div><div><p className="eyebrow mt-5 text-primary-foreground">Votre concierge</p><h2 className="v3-card-title mt-2 text-[21px]">Écrire à<br />{conciergeFirstName}</h2></div></a>}
    </section>
    <section className="mt-12 lg:hidden"><div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-2"><Title as="h2" italic={<>en vedette.</>} className="text-[34px] text-primary">Offres<br /></Title><Link to="/offres" aria-label="Toutes les offres" className="rounded-full border border-primary/25"><ArrowCircle className="size-11 bg-transparent" /></Link></div><div className="no-scrollbar -mr-3 flex gap-3 overflow-x-auto pb-1">{offersPending ? [0, 1].map((i) => <Skeleton key={i} className="h-[336px] w-[252px] shrink-0 rounded-card bg-primary/10" />) : offers.map((o) => <HomeOffer key={o.id} offer={o} />)}</div>{!offersPending && offers.length === 0 && <EmptyState>Aucune offre pour le moment.</EmptyState>}</section>
    <section className="mt-[22px] hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] gap-[22px] lg:grid">
      <div className="min-w-0"><div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><h2 className="v3-card-title text-[24px] text-primary">Demandes récentes</h2><Link to="/demandes" className="text-[12px] font-medium text-primary">Tout voir</Link></div><div className="divide-y divide-primary/25">{requestsPending ? <Skeleton className="h-40 bg-primary/10" /> : requests.length ? requests.slice(0, 3).map((item) => <Link key={item.id} to="/demandes/$requestId" params={{ requestId: item.id }} className="block py-4"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><div className="min-w-0"><span className="eyebrow">{item.category}</span><h3 className="v3-card-title mt-2 text-[20px] text-primary">{item.title}</h3><p className="mt-2 text-[12px] text-muted-foreground">{formatShortDate(item.scheduled_date)}</p></div><StatusBadge status={item.status} /></div></Link>) : <EmptyState>Aucune demande pour le moment.</EmptyState>}</div></div>
      <div className="min-w-0"><div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><h2 className="v3-card-title text-[24px] text-primary">Privilèges en vedette</h2><Link to="/offres" className="text-[12px] font-medium text-primary">Tout voir</Link></div><div className="grid grid-cols-2 gap-3">{offers.slice(0, 4).map((offer) => <OfferCard key={offer.id} offer={offer} compact />)}</div></div>
    </section>
  </AppShell>;
}
