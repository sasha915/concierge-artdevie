import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, CircleUserRound, FileText, Gift, History, LogOut, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, PageHeader } from "@/components/art-de-vie/app-shell";
import { MemberCard } from "@/components/art-de-vie/member-card";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/adv-queries";

export const Route = createFileRoute("/_authenticated/membership/")({ head: () => ({ meta: [{ title: "Ma carte de membre — Art de Vie" }, { name: "description", content: "Votre carte et votre espace membre Art de Vie." }, { property: "og:title", content: "Ma carte de membre — Art de Vie" }, { property: "og:description", content: "Votre carte et votre espace membre Art de Vie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

const row = "flex items-center gap-4 border-b border-primary/10 p-5 last:border-0";

function Page() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile = null } = useQuery(profileQuery);
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

  return <AppShell>
    <div className="lg:hidden"><PageHeader title="Ma carte de membre" subtitle="Votre carte d'accès virtuelle aux privilèges Art de Vie." /></div>
    <header className="mb-7 hidden lg:block">
      <h1 className="font-display text-[32px] font-semibold leading-tight text-primary">Ma carte de membre</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">Votre carte d'accès virtuelle aux privilèges Art de Vie.</p>
    </header>
    <div className="mx-auto max-w-[620px] lg:grid lg:max-w-none lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:gap-10">
      <div className="min-w-0">
        <MemberCard profile={profile}/>
        {showConcierge ? (
          <Button asChild variant="primary" size="lg" className="mt-6 w-full">
            <a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle />Écrire à {conciergeFirstName}</a>
          </Button>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="mt-6 overflow-hidden rounded-card bg-card lg:mt-0 lg:flex lg:h-full lg:flex-col lg:justify-center">
          <Link to="/membership/informations" className={row}><CircleUserRound className="size-5 text-primary"/><span className="flex-1 text-sm font-medium">Vos informations</span><ChevronRight className="size-4 text-muted-foreground"/></Link>
          <Link to="/membership/factures" className={row}><FileText className="size-5 text-primary"/><span className="flex-1 text-sm font-medium">Mes factures</span><ChevronRight className="size-4 text-muted-foreground"/></Link>
          <Link to="/membership/historique" className={row}><History className="size-5 text-primary"/><span className="flex-1 text-sm font-medium">Historique des demandes</span><ChevronRight className="size-4 text-muted-foreground"/></Link>
          <Link to="/membership/parrainer" className={row}><Gift className="size-5 text-primary"/><span className="flex-1 text-sm font-medium">Parrainer un membre</span><ChevronRight className="size-4 text-muted-foreground"/></Link>
          <button type="button" onClick={signOut} className={row + " w-full text-left"}><LogOut className="size-5 text-primary"/><span className="flex-1 text-sm font-medium">Se déconnecter</span><ChevronRight className="size-4 text-muted-foreground"/></button>
        </div>
      </div>
    </div>
    <blockquote className="mx-auto mt-12 max-w-sm text-center font-display text-xl italic leading-8 text-primary">« Le luxe véritable, c’est le temps rendu à l’essentiel. »</blockquote>
  </AppShell>;
}
