import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleUserRound, FileText, Gift, History, LogOut, MessageCircle, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, TopBar } from "@/components/art-de-vie/app-shell";
import { Photo } from "@/components/art-de-vie/cards";
import { MemberCard } from "@/components/art-de-vie/member-card";
import { ArrowCircle, PillAction, Title } from "@/components/art-de-vie/v3";
import { imageFor } from "@/data/art-de-vie";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/adv-queries";
import { isAdminQuery } from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/membership/")({
  head: () => ({
    meta: [
      { title: "Votre Membership — Art de Vie" },
      { name: "description", content: "Votre carte et votre espace membre Art de Vie." },
      { property: "og:title", content: "Votre Membership — Art de Vie" },
      { property: "og:description", content: "Votre carte et votre espace membre Art de Vie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function AccountTile({
  to,
  icon,
  label,
  dark = false,
  photo,
}: {
  to: "/membership/informations" | "/membership/factures" | "/membership/historique" | "/membership/parrainer" | "/membership/preferences" | "/membership/releve";
  icon: React.ReactNode;
  label: string;
  dark?: boolean;
  photo?: string | undefined;
}) {
  return (
    <Link
      to={to}
      className={`relative flex min-h-[164px] flex-col justify-between overflow-hidden rounded-card p-5 lg:min-h-[240px] lg:p-6 transition-transform active:scale-[0.98] ${dark ? "bg-primary-deep text-foreground" : "bg-primary/10 text-primary"} ${photo ? "lg:text-foreground" : ""}`}
    >
      {photo ? <Photo src={photo} alt="Bassin Art de Vie" className="absolute inset-0 h-full w-full" /> : null}
      <span className="relative z-10 flex size-11 items-center justify-center rounded-full border border-current/25">
        {icon}
      </span>
      <div className="relative z-10 flex items-end justify-between gap-3">
        <span className="max-w-[120px] lg:max-w-[220px] lg:text-[26px] lg:leading-8 text-[16px] font-medium leading-5">
          {label}
        </span>
        <ArrowCircle diagonal inverse={!dark && !photo} className="size-9 lg:absolute lg:right-6 lg:top-[-154px]" />
      </div>
    </Link>
  );
}

function Page() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile = null } = useQuery(profileQuery);
  const { data: isAdmin = false } = useQuery(isAdminQuery);
  const conciergeFirstName = profile?.concierge_referent?.split(/\s+/)[0] ?? null;
  const whatsappDigits = profile?.concierge_whatsapp?.replace(/[^0-9]/g, "") ?? "";
  const whatsappUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Bonjour ${conciergeFirstName ?? ""}, j'aimerais échanger avec vous.`)}`;
  const showConcierge = profile?.plan === "Signature" && Boolean(conciergeFirstName) && whatsappDigits.length > 0;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/connexion", replace: true });
  }

  return (
    <AppShell immersive>
      <section className="relative h-[376px] overflow-hidden rounded-[28px] text-foreground lg:h-[660px]">
        <Photo
          src={imageFor("entree-de-nuit")}
          alt="Entrée Art de Vie de nuit"
          hero
          eager
          className="absolute inset-0 h-full w-full"
        />
        <div className="relative z-10 flex h-full flex-col p-4 sm:p-6 lg:px-[clamp(20px,3.9vw,56px)] lg:py-6">
          <TopBar />
          <div className="mt-auto max-w-[650px] pb-8 lg:max-w-[min(760px,calc(100%-460px))] lg:pb-12">
            <p className="eyebrow text-foreground/80">Membership</p>
            <Title
              italic="Membership."
              className="mt-4 text-[44px] lg:text-[clamp(52px,7.2vw,104px)] lg:leading-[0.96]"
            >
              Votre{" "}
            </Title>
            <p className="mt-5 max-w-md text-[14px] leading-6 lg:border-t lg:border-foreground/22 lg:pt-6 lg:text-[18px] lg:leading-7">
              Votre carte personnelle ouvre l’accès à votre espace et aux attentions réservées par notre maison.
            </p>
            {showConcierge && (
              <PillAction asChild light className="hidden lg:mt-6 lg:inline-flex">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  Écrire à {conciergeFirstName}
                </a>
              </PillAction>
            )}
          </div>
        </div>
      </section>

      <div className="relative z-20 mx-auto -mt-[88px] max-w-[620px] px-2 lg:-mt-[230px] lg:max-w-none lg:px-[clamp(20px,3.9vw,56px)]">
        <div className="lg:relative">
          <div className="lg:ml-auto lg:w-[460px]">
            <MemberCard profile={profile} />
            {showConcierge ? (
              <PillAction asChild className="mt-5 w-full lg:hidden">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  Écrire à {conciergeFirstName}
                </a>
              </PillAction>
            ) : null}
          </div>
          <div className="mt-9 lg:mt-16">
            <p className="eyebrow text-primary">Votre compte</p>
            <Title as="h2" italic="compte." className="hidden lg:mt-5 lg:block lg:text-[clamp(38px,4.44vw,64px)]">
              Votre{" "}
            </Title>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:mt-10 lg:grid-cols-4 lg:gap-4">
              <AccountTile
                to="/membership/informations"
                label="Vos informations"
                icon={<CircleUserRound className="size-5" />}
                dark
              />
              <AccountTile to="/membership/factures" label="Mes factures" icon={<FileText className="size-5" />} />
              <AccountTile
                to="/membership/historique"
                label="Historique des demandes"
                icon={<History className="size-5" />}
              />
              <AccountTile
                to="/membership/parrainer"
                label="Parrainer un membre"
                icon={<Gift className="size-5" />}
                photo={imageFor("bassin")}
              />
            </div>
            {/* Lot 6.4 : bloc ajouté, sous les tuiles existantes. */}
            <div className="mt-3 grid grid-cols-2 gap-3 lg:mt-4 lg:grid-cols-4 lg:gap-4">
              <AccountTile to="/membership/preferences" label="Mes préférences" icon={<Sparkles className="size-5" />} />
              <AccountTile to="/membership/releve" label="Mon relevé" icon={<ReceiptText className="size-5" />} />
            </div>
            {isAdmin ? (
              <Button asChild variant="outline" size="lg" className="mt-4 w-full lg:hidden">
                <Link to="/admin">
                  <ShieldCheck />
                  Administration
                </Link>
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="lg" className="mt-3 w-full lg:hidden" onClick={signOut}>
              <LogOut />
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>
      <blockquote className="mx-auto mt-12 max-w-xl border-t border-primary/25 px-6 pt-8 text-center font-display text-[24px] italic leading-9 text-primary lg:mx-[clamp(20px,3.9vw,56px)] lg:mt-24 lg:max-w-[62%] lg:px-0 lg:text-left lg:text-[40px] lg:leading-[1.3]">
        « Le luxe véritable, c’est le temps rendu à l’essentiel. »
      </blockquote>
      <div className="hidden lg:mx-[clamp(20px,3.9vw,56px)] lg:-mt-12 lg:flex lg:flex-wrap lg:justify-end lg:gap-3">
        {isAdmin && (
          <Button asChild variant="outline" size="lg">
            <Link to="/admin">
              <ShieldCheck />
              Administration
            </Link>
          </Button>
        )}
        <Button variant="outline" size="lg" onClick={signOut}>
          <LogOut />
          Se déconnecter
        </Button>
      </div>
    </AppShell>
  );
}
