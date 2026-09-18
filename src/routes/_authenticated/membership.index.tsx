import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, CircleUserRound, FileText, Gift, History, LogOut } from "lucide-react";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";
import { MemberCard } from "@/components/art-de-vie/member-card";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/adv-queries";

export const Route = createFileRoute("/_authenticated/membership/")({ head: () => ({ meta: [{ title: "Ma carte de membre — Art de Vie" }, { name: "description", content: "Votre carte et votre espace membre Art de Vie." }, { property: "og:title", content: "Ma carte de membre — Art de Vie" }, { property: "og:description", content: "Votre carte et votre espace membre Art de Vie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

const row = "flex items-center gap-4 border-b border-primary/10 p-5 last:border-0";

function Page() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile = null } = useQuery(profileQuery);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/connexion", replace: true });
  }

  return <AppShell><div className="mb-6 flex justify-center"><Logo className="h-[19px] w-auto" /></div><div className="mb-8"><h1 className="font-display text-[32px] font-semibold leading-tight text-primary">Ma carte de membre</h1><p className="mt-2 text-[13px] text-muted-foreground">Votre carte d'accès virtuelle aux privilèges Art de Vie.</p></div><div className="mx-auto max-w-[620px]"><MemberCard profile={profile}/>
    <div className="mt-10 overflow-hidden rounded-card bg-card">
      <Link to="/membership/informations" className={row}><CircleUserRound className="size-5 text-primary"/><span className="flex-1 text-sm font-medium">Vos informations</span><ChevronRight className="size-4 text-muted-foreground"/></Link>
      <Link to="/membership/factures" className={row}><FileText className="size-5 text-primary"/><span className="flex-1 text-sm font-medium">Mes factures</span><ChevronRight className="size-4 text-muted-foreground"/></Link>
      <Link to="/membership/historique" className={row}><History className="size-5 text-primary"/><span className="flex-1 text-sm font-medium">Historique des demandes</span><ChevronRight className="size-4 text-muted-foreground"/></Link>
      <button type="button" className={row + " w-full text-left"}><Gift className="size-5 text-primary"/><span className="flex-1 text-sm font-medium">Parrainer un membre</span><ChevronRight className="size-4 text-muted-foreground"/></button>
      <button type="button" onClick={signOut} className={row + " w-full text-left"}><LogOut className="size-5 text-primary"/><span className="flex-1 text-sm font-medium">Se déconnecter</span><ChevronRight className="size-4 text-muted-foreground"/></button>
    </div>
    <blockquote className="mx-auto my-12 max-w-sm text-center font-display text-xl italic leading-8 text-primary">« Le luxe véritable, c’est le temps rendu à l’essentiel. »</blockquote>
  </div></AppShell>;
}
