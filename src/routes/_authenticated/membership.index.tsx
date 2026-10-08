import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleUserRound, FileText, Gift, History, LogOut, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, TopBar } from "@/components/art-de-vie/app-shell";
import { Photo } from "@/components/art-de-vie/cards";
import { MemberCard } from "@/components/art-de-vie/member-card";
import { ArrowCircle, PillAction, Title } from "@/components/art-de-vie/v3";
import { imageFor } from "@/data/art-de-vie";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/adv-queries";
import { isAdminQuery } from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/membership/")({ head: () => ({ meta: [{ title: "Votre Membership — Art de Vie" }, { name: "description", content: "Votre carte et votre espace membre Art de Vie." }, { property: "og:title", content: "Votre Membership — Art de Vie" }, { property: "og:description", content: "Votre carte et votre espace membre Art de Vie." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function AccountTile({ to, icon, label, dark = false, photo }: { to: "/membership/informations" | "/membership/factures" | "/membership/historique" | "/membership/parrainer"; icon: React.ReactNode; label: string; dark?: boolean; photo?: string }) {
  return <Link to={to} className={`relative flex min-h-[164px] flex-col justify-between overflow-hidden rounded-card p-5 transition-transform active:scale-[0.98] ${dark ? "bg-primary-deep text-primary-foreground" : "bg-primary/10 text-primary"}`}>
    {photo ? <Photo src={photo} alt="Bassin Art de Vie" className="absolute inset-0 h-full w-full" /> : null}
    <span className="relative z-10 flex size-11 items-center justify-center rounded-full border border-current/25">{icon}</span>
    <div className="relative z-10 flex items-end justify-between gap-3"><span className="max-w-[120px] text-[16px] font-medium leading-5">{label}</span><ArrowCircle diagonal inverse={!dark && !photo} className="size-9" /></div>
  </Link>;
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

  return <AppShell immersive>
    <section className="relative h-[376px] overflow-hidden rounded-[28px] text-primary-foreground lg:h-[420px]">
      <Photo src={imageFor("entree-de-nuit")} alt="Entrée Art de Vie de nuit" hero eager className="absolute inset-0 h-full w-full" />
      <div className="relative z-10 flex h-full flex-col p-4 sm:p-6">
        <TopBar />
        <div className="mt-auto max-w-[650px] pb-8"><p className="eyebrow text-primary-foreground/80">Membership</p><Title italic="Membership." className="mt-4 text-[44px] lg:text-[52px]">Votre </Title><p className="mt-5 max-w-md text-[14px] leading-6">Votre carte personnelle ouvre l’accès à votre espace et aux attentions réservées par notre maison.</p></div>
      </div>
    </section>

    <div className="relative z-20 mx-auto -mt-[88px] max-w-[620px] px-2 lg:max-w-[980px]">
      <div className="lg:grid lg:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-10">
        <div><MemberCard profile={profile}/>{showConcierge ? <PillAction asChild className="mt-5 w-full"><a href={whatsappUrl} target="_blank" rel="noreferrer">Écrire à {conciergeFirstName}</a></PillAction> : null}</div>
        <div className="mt-9 lg:mt-[88px]"><p className="eyebrow text-primary">Votre compte</p><div className="mt-4 grid grid-cols-2 gap-3">
          <AccountTile to="/membership/informations" label="Vos informations" icon={<CircleUserRound className="size-5" />} dark />
          <AccountTile to="/membership/factures" label="Mes factures" icon={<FileText className="size-5" />} />
          <AccountTile to="/membership/historique" label="Historique des demandes" icon={<History className="size-5" />} />
          <AccountTile to="/membership/parrainer" label="Parrainer un membre" icon={<Gift className="size-5" />} photo={imageFor("bassin")} />
        </div>
        {isAdmin ? <Button asChild variant="outline" size="lg" className="mt-4 w-full"><Link to="/admin"><ShieldCheck />Administration</Link></Button> : null}
        <Button type="button" variant="outline" size="lg" className="mt-3 w-full" onClick={signOut}><LogOut />Se déconnecter</Button></div>
      </div>
    </div>
    <blockquote className="mx-auto mt-12 max-w-xl border-t border-primary/25 px-6 pt-8 text-center font-display text-[24px] italic leading-9 text-primary">« Le luxe véritable, c’est le temps rendu à l’essentiel. »</blockquote>
  </AppShell>;
}