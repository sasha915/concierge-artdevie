import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, MessageCircle, Plus } from "lucide-react";
import { AppShell, Logo, TopBar } from "@/components/art-de-vie/app-shell";
import { EmptyState, Photo, StatusBadge } from "@/components/art-de-vie/cards";
import { Counter, PillAction, StatusTimeline, Title } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDate,
  formatShortDate,
  formatTime,
  imageFor,
  offerImage,
  initials,
  type Offer,
  type Profile,
  type RequestItem, requestPhoto } from "@/data/art-de-vie";
import { offersQuery, profileQuery, requestsQuery } from "@/lib/adv-queries";
import { WELCOME_LATER_KEY } from "@/components/art-de-vie/welcome";
import vendome from "@/assets/v3/place-vendome.jpg.asset.json";
import { locale, t, tPair } from "@/lib/i18n";
import { isActiveRequest, orderForDisplay, todayInParis } from "@/lib/request-order";
import { useDelegation } from "@/components/art-de-vie/use-delegation";
import { DelegateHome } from "@/components/art-de-vie/delegate";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async () => {
    // Comptes d'équipe : pas d'accueil membre ni de carte, direction l'espace équipe.
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data } = await supabase.rpc("is_team", { _user_id: auth.user.id });
    if (data === true) throw redirect({ to: "/admin-connexion", replace: true });
    // Lot 6.4 : questionnaire d'accueil tant qu'il n'est pas terminé, sauf « Plus tard » pendant la session.
    let later = false;
    try { later = sessionStorage.getItem(WELCOME_LATER_KEY) === "1"; } catch { /* stockage indisponible */ }
    if (!later) {
      const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", auth.user.id).maybeSingle();
      if (profile && !profile.onboarded_at) throw redirect({ to: "/bienvenue", replace: true });
    }
  },
  head: () => ({
    meta: [
      { title: t("Accueil — Art de Vie") },
      { name: "description", content: t("Votre conciergerie privée : vos demandes et nos offres.") },
      { property: "og:title", content: t("Accueil — Art de Vie") },
      { property: "og:description", content: t("Votre conciergerie privée : vos demandes et nos offres.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

/** Cercle d'action V4 : contour fin sur panneau sombre, ou beige plein. */
function Ring({ diagonal = true, solid = false, className = "" }: { diagonal?: boolean; solid?: boolean; className?: string }) {
  const Icon = diagonal ? ArrowUpRight : ArrowRight;
  return (
    <span aria-hidden="true" className={`flex size-9 shrink-0 items-center justify-center rounded-full ${solid ? "bg-primary text-primary-foreground" : "border border-foreground/24 text-foreground"} ${className}`}>
      <Icon className="size-4" />
    </span>
  );
}

/** Demande en cours : carte beige (V4), photo au-dessus sur ordinateur. */
function CurrentRequest({ item }: { item: RequestItem }) {
  return (
    <Link
      to="/demandes/$requestId"
      params={{ requestId: item.id }}
      className="block h-full rounded-[24px] bg-primary p-[18px] text-primary-foreground transition-transform active:scale-[0.98] md:flex md:gap-3 md:rounded-[28px] md:p-3 lg:flex-col lg:gap-0"
    >
      <Photo src={requestPhoto(item)} alt={item.title} category={item.category} className="hidden md:block md:min-h-[260px] md:w-[300px] md:shrink-0 md:rounded-[18px] lg:h-[250px] lg:min-h-0 lg:w-auto lg:rounded-[20px]" />
      <span className="block md:min-w-0 md:flex-1 md:self-center md:px-2 md:py-2 lg:mt-auto lg:flex-none lg:self-auto lg:px-3 lg:pb-1 lg:pt-5">
        <span className="flex items-center justify-between gap-3">
          <span className="eyebrow text-ink-soft">{t("Demande en cours")}</span>
          <span className="inline-flex h-[26px] items-center rounded-full bg-primary-foreground px-[11px] text-[12px] font-medium text-primary">{t(item.status)}</span>
        </span>
        <span className="mt-3.5 block text-[28px] leading-[1.08] tracking-[-0.04em] md:mt-4 md:text-[32px]">{item.title}</span>
        <span className="mt-1.5 block text-[14px] leading-5 text-ink-soft">
          {formatDate(item.scheduled_date)}
          {item.scheduled_time ? ` · ${formatTime(item.scheduled_time)}` : ""}
        </span>
        <span className="mt-4 block">
          <StatusTimeline status={item.status} onLight />
        </span>
        <span className="mt-5 hidden h-[52px] items-center justify-between rounded-full bg-primary-foreground pl-6 pr-2 text-[15px] font-medium text-primary lg:flex">
          {t("Suivre ma demande")}
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowRight className="size-4" /></span>
        </span>
      </span>
    </Link>
  );
}

function MiniMember({ profile }: { profile: Profile | null | undefined }) {
  return (
    <div className="member-grain relative h-[66px] w-[104px] overflow-hidden rounded-[12px] border border-gold p-[9px] text-foreground lg:h-[90px] lg:w-[148px] lg:p-3">
      <div className="flex items-center justify-between gap-2">
        <Logo inverse className="h-[11px] w-auto lg:h-3" />
        <span className="hidden text-[8px] lg:inline">{initials(profile?.full_name ?? "")}</span>
      </div>
      <p className="absolute bottom-[7px] left-[9px] font-display text-[12px] lg:bottom-3 lg:left-3 lg:text-[15px]">{profile?.plan ?? "—"}</p>
    </div>
  );
}

const tile = "flex min-h-[156px] min-w-0 flex-col justify-between gap-3 rounded-[24px] p-[14px] pl-[18px] transition-transform active:scale-[0.98] md:min-h-[176px] md:p-5 lg:min-h-[216px] lg:rounded-[28px] lg:p-6";

/** Offre en vedette : carte photo (mobile, carrousel). */
function HomeOffer({ offer }: { offer: Offer }) {
  return (
    <Link
      to="/offres"
      className="relative flex h-[300px] w-[236px] shrink-0 flex-col md:w-auto justify-between overflow-hidden rounded-[24px] bg-panel p-3 pb-[18px] text-foreground transition-transform active:scale-[0.98]"
    >
      <Photo src={offerImage(offer)} alt={offer.title} category={offer.category} className="absolute inset-0 h-full" />
      <span className="relative flex">
        <span className="dark-glass inline-flex h-[30px] items-center rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.13em]">{t(offer.category)}</span>
      </span>
      <span className="relative block px-1.5">
        <span className="block text-[24px] leading-[1.1] tracking-[-0.035em]">{offer.title}</span>
        <span className="mt-1.5 block text-[13px] text-muted-foreground">{offer.partner}</span>
      </span>
    </Link>
  );
}

/** Rang de liste (ordinateur) : vignette, surtitre, titre, mention, pastille, flèche. */
function Row({ to, params, image, category, title, meta, badge }: { to: "/demandes/$requestId" | "/offres"; params?: { requestId: string }; image: string | undefined; category: string; title: string; meta: string; badge?: React.ReactNode }) {
  return (
    <Link to={to} params={params as never} className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-5 border-b border-foreground/16 py-4 last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Photo src={image} alt={title} category={category} className="h-[96px] rounded-[16px]" />
      <span className="min-w-0">
        <span className="eyebrow block text-[11px] text-muted-foreground">{t(category)}</span>
        <span className="mt-2 block truncate text-[26px] leading-tight tracking-[-0.03em]">{title}</span>
        <span className="mt-1 block text-[14px] text-muted-foreground">{meta}</span>
      </span>
      <span className="flex items-center gap-3">{badge}<Ring className="size-11" /></span>
    </Link>
  );
}

/** Lot 5.4 : un proche autorisé a son propre accueil. */
function Home() {
  const { delegation } = useDelegation();
  if (delegation) return <DelegateHome delegation={delegation} />;
  return <MemberHome />;
}

function MemberHome() {
  const heroTitle = tPair("Votre conciergerie, à votre", "rythme.");
  const offersTitle = tPair("Offres en", "vedette.");
  const latestTitle = tPair("Vos dernières", "demandes.");
  const { data: requests = [], isPending: requestsPending } = useQuery(requestsQuery);
  const { data: offers = [], isPending: offersPending } = useQuery(offersQuery);
  const { data: profile } = useQuery(profileQuery);
  const [greeting, setGreeting] = useState("Bonjour");
  const [today, setToday] = useState("");
  useEffect(() => {
    setGreeting(new Date().getHours() < 18 ? "Bonjour" : "Bonsoir");
    const d = new Date().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
    setToday(d.charAt(0).toUpperCase() + d.slice(1));
  }, []);
  const ordered = orderForDisplay(requests, todayInParis());
  const upcoming = ordered.filter(isActiveRequest);
  const nextRequest = upcoming[0];
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "";
  const conciergeFirstName = profile?.concierge_referent?.split(/\s+/)[0] ?? null;
  const whatsappDigits = profile?.concierge_whatsapp?.replace(/[^0-9]/g, "") ?? "";
  // Le concierge n'est nommé que s'il est réellement attribué (nom et WhatsApp sur la fiche), quelle que soit la formule.
  const showConcierge = Boolean(conciergeFirstName) && whatsappDigits.length > 0;
  const whatsappUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(t("Bonjour {name}, j’aimerais échanger avec vous.", { name: conciergeFirstName ?? "" }))}`;
  const hello = `${t(greeting)}${firstName ? ` ${firstName}` : ""}`;

  return (
    <AppShell immersive>
      <div className="hidden md:mb-4 md:block lg:mb-5">
        <TopBar />
      </div>
      {/* Une colonne bornée à l'écran sur mobile : le carrousel d'offres défile au lieu d'élargir la page. */}
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12">
        {/* Héros */}
        <section className={`relative flex min-h-[476px] flex-col justify-between overflow-hidden rounded-[28px] bg-panel p-[14px] pb-[18px] text-foreground md:min-h-[520px] md:p-8 lg:min-h-[540px] lg:p-9 ${nextRequest ? "lg:col-span-8" : "lg:col-span-12"}`}>
          <Photo src={vendome.url} alt={t("La place Vendôme à Paris")} hero eager className="absolute inset-0 h-full w-full" />
          <div className="relative md:hidden">
            <TopBar />
          </div>
          <div className="relative hidden items-start justify-between gap-4 md:flex">
            <p className="eyebrow text-muted-foreground">{today}</p>
            <span className="rounded-full border border-foreground/24 px-4 py-2 text-[14px]">{hello}</span>
          </div>
          <div className="relative px-1.5 md:px-0">
            <p className="eyebrow mb-3.5 text-muted-foreground md:hidden">{hello}</p>
            <Title as="h1" italic={heroTitle[1]} className="text-[46px] leading-none md:text-[72px] md:leading-[0.96] lg:max-w-[820px] lg:text-[clamp(56px,6vw,92px)] lg:leading-[0.98]">
              {heroTitle[0]}{" "}
            </Title>
            <p className="mt-6 hidden max-w-[520px] text-[18px] leading-7 text-foreground/90 md:block">
              {t("Suivez vos demandes et vos privilèges, ou contactez votre conciergerie en un geste.")}
            </p>
            <div className="mt-[22px] md:mt-7 md:flex md:flex-wrap md:gap-3">
              <PillAction asChild light plus className="w-full md:w-auto">
                <Link to="/demandes/nouvelle" search={{ offer: undefined }}>
                  {t("Nouvelle demande")}
                </Link>
              </PillAction>
              <Link to="/demandes" className="hidden h-[52px] items-center rounded-full border border-foreground/24 px-6 text-[15px] font-medium transition-colors hover:bg-foreground/10 md:inline-flex">
                {t("Mes demandes")}
              </Link>
            </div>
          </div>
        </section>

        {/* Demande en cours */}
        {requestsPending ? (
          <Skeleton className="h-[180px] rounded-[24px] bg-panel lg:col-span-4 lg:h-auto" />
        ) : nextRequest ? (
          <div className="lg:col-span-4">
            <CurrentRequest item={nextRequest} />
          </div>
        ) : null}

        {/* Tuiles */}
        <section aria-label={t("Votre activité")} className="grid grid-cols-2 gap-3 md:gap-4 lg:col-span-12 lg:grid-cols-4">
          <Link to="/demandes" className={`${tile} bg-panel text-foreground`}>
            <span className="flex justify-end"><Ring /></span>
            <span>
              {requestsPending ? <Skeleton className="h-[60px] w-14 bg-foreground/10" /> : <Counter value={upcoming.length} />}
              <span className="mt-1.5 block text-[14px] text-muted-foreground lg:text-[16px]">{t("demandes actives")}</span>
            </span>
          </Link>
          <Link to="/offres" className={`${tile} border border-foreground/16 bg-glass text-foreground`}>
            <span className="flex justify-end"><Ring /></span>
            <span>
              {offersPending ? <Skeleton className="h-[60px] w-14 bg-foreground/10" /> : <Counter value={offers.length} />}
              <span className="mt-1.5 block text-[14px] text-muted-foreground lg:text-[16px]">{t("offres en vedette")}</span>
            </span>
          </Link>
          <Link to="/membership" className={`${tile} border border-foreground/16 bg-glass text-foreground lg:border-0 lg:bg-panel`}>
            <span className="flex items-start justify-between gap-2"><MiniMember profile={profile} /><Ring className="hidden lg:flex" /></span>
            <span>
              <span className="eyebrow block whitespace-nowrap text-[10px] text-muted-foreground lg:text-[11px]">{t("Membership")}</span>
              <span className="mt-1.5 block text-[20px] leading-tight tracking-[-0.025em] lg:text-[28px]">{t("Votre carte")}</span>
            </span>
          </Link>
          {showConcierge ? (
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className={`${tile} bg-panel text-foreground lg:border lg:border-foreground/16 lg:bg-glass`}>
              <span className="flex justify-end">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><MessageCircle className="size-4" /></span>
              </span>
              <span>
                <span className="eyebrow block whitespace-nowrap text-[10px] text-muted-foreground lg:text-[11px]">{t("Votre concierge")}</span>
                <span className="mt-1.5 block text-[18px] leading-tight tracking-[-0.02em] lg:text-[28px]">{t("Écrire à")} {conciergeFirstName}</span>
              </span>
            </a>
          ) : (
            /* Sans concierge référent : la quatrième tuile de la maquette ouvre une demande écrite à la conciergerie. */
            <Link to="/demandes/nouvelle" search={{ offer: undefined }} className={`${tile} bg-panel text-foreground lg:border lg:border-foreground/16 lg:bg-glass`}>
              <span className="flex justify-end">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><MessageCircle className="size-4" /></span>
              </span>
              <span>
                <span className="eyebrow block whitespace-nowrap text-[10px] text-muted-foreground lg:text-[11px]">{t("Votre conciergerie")}</span>
                <span className="mt-1.5 block text-[18px] leading-tight tracking-[-0.02em] lg:text-[28px]">{t("Nous écrire")}</span>
              </span>
            </Link>
          )}
        </section>

        {/* Mobile : offres en carrousel */}
        <section className="mt-6 min-w-0 md:order-last md:mt-4 lg:hidden">
          <div className="flex items-end justify-between gap-3 px-2 pb-4">
            <Title as="h2" italic={offersTitle[1]} className="text-[34px] leading-[1.04] text-primary md:text-[44px]">
              {offersTitle[0]}{" "}
            </Title>
            <Link to="/offres" aria-label={t("Toutes les offres")} className="rounded-full">
              <Ring diagonal={false} className="size-11" />
            </Link>
          </div>
          <div className="no-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:[&>*:nth-child(n+4)]:hidden">
            {offersPending
              ? [0, 1].map((i) => <Skeleton key={i} className="h-[300px] w-[236px] shrink-0 rounded-[24px] bg-panel" />)
              : offers.map((o) => <HomeOffer key={o.id} offer={o} />)}
          </div>
          {!offersPending && offers.length === 0 && <EmptyState>{t("Aucune offre pour le moment.")}</EmptyState>}
        </section>

        {/* Ordinateur : dernières demandes et offres en vedette */}
        <section className="hidden md:block md:rounded-[28px] md:bg-panel md:p-6 lg:col-span-7 lg:p-7">
          <p className="eyebrow text-muted-foreground">{t("Demandes récentes")}</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <Title as="h2" italic={latestTitle[1]} className="text-[clamp(34px,3.2vw,52px)]">{latestTitle[0]}{" "}</Title>
            <Link to="/demandes" className="shrink-0 text-[14px] underline underline-offset-4">{t("Toutes les demandes")}</Link>
          </div>
          <div className="mt-4">
            {requestsPending ? <Skeleton className="h-60 bg-foreground/10" />
              : ordered.length ? ordered.slice(0, 3).map((item) => (
                  <Row key={item.id} to="/demandes/$requestId" params={{ requestId: item.id }} image={requestPhoto(item)} category={item.category} title={item.title} meta={formatDate(item.scheduled_date)} badge={<StatusBadge status={item.status} />} />
                ))
              : <EmptyState>{t("Aucune demande pour le moment.")}</EmptyState>}
          </div>
        </section>
        <section className="hidden lg:col-span-5 lg:block lg:rounded-[28px] lg:border lg:border-foreground/16 lg:bg-glass lg:p-7">
          <p className="eyebrow text-muted-foreground">{t("Offres")}</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <Title as="h2" italic={offersTitle[1]} className="whitespace-nowrap text-[clamp(34px,3.2vw,52px)]">{offersTitle[0]}{" "}</Title>
            <Link to="/offres" className="shrink-0 text-[14px] underline underline-offset-4">{t("Toutes les offres")}</Link>
          </div>
          <div className="mt-4">
            {offersPending ? <Skeleton className="h-60 bg-foreground/10" />
              : offers.length ? offers.slice(0, 3).map((offer) => (
                  <Row key={offer.id} to="/offres" image={offerImage(offer)} category={offer.category} title={offer.title} meta={offer.partner} />
                ))
              : <EmptyState>{t("Aucune offre pour le moment.")}</EmptyState>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
