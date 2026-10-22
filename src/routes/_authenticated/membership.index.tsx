import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CircleUserRound, FileText, Gift, History, Languages, LogOut, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell, TopBar } from "@/components/art-de-vie/app-shell";
import { Photo } from "@/components/art-de-vie/cards";
import { MemberCard } from "@/components/art-de-vie/member-card";
import { PillAction, Title } from "@/components/art-de-vie/v3";
import { imageFor } from "@/data/art-de-vie";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/adv-queries";
import { isAdminQuery } from "@/lib/admin-queries";
import { t, tPair } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/membership/")({
  head: () => ({
    meta: [
      { title: t("Votre Membership — Art de Vie") },
      { name: "description", content: t("Votre carte et votre espace membre Art de Vie.") },
      { property: "og:title", content: t("Votre Membership — Art de Vie") },
      { property: "og:description", content: t("Votre carte et votre espace membre Art de Vie.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type TileTo = "/membership/informations" | "/membership/factures" | "/membership/historique" | "/membership/parrainer" | "/membership/preferences" | "/membership/releve" | "/membership/langue";

/** Tuile de compte V4 : icône cerclée, flèche beige, libellé en bas ; panneau, verre ou photo. */
function AccountTile({ to, icon, label, tone = "panel", photo }: { to: TileTo; icon: React.ReactNode; label: string; tone?: "panel" | "glass"; photo?: string | undefined }) {
  return (
    <Link
      to={to}
      className={`relative isolate flex min-h-[148px] flex-col justify-between gap-3.5 overflow-hidden rounded-[24px] p-[14px] pl-4 text-foreground transition-transform active:scale-[0.98] lg:min-h-[188px] lg:rounded-[28px] lg:p-6 ${tone === "glass" && !photo ? "border border-foreground/16 bg-glass" : "bg-panel"}`}
    >
      {photo ? <Photo src={photo} alt={t("Bassin Art de Vie")} hero className="absolute inset-0 -z-10 h-full w-full" /> : null}
      <span className="flex items-start justify-between gap-2">
        <span className="flex size-10 items-center justify-center rounded-full border border-foreground/24 lg:size-12">{icon}</span>
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground lg:size-10"><ArrowUpRight className="size-4" /></span>
      </span>
      <span className="block text-[19px] leading-[1.16] tracking-[-0.025em] lg:text-[26px]">{label}</span>
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
  const whatsappUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(t("Bonjour {name}, j’aimerais échanger avec vous.", { name: conciergeFirstName ?? "" }))}`;
  const showConcierge = profile?.plan === "Signature" && Boolean(conciergeFirstName) && whatsappDigits.length > 0;
  const [head, tail] = tPair("Votre", "Membership.");

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/connexion", replace: true });
  }

  const writeButton = showConcierge ? (
    <PillAction asChild light className="w-full lg:w-auto">
      <a href={whatsappUrl} target="_blank" rel="noreferrer">
        {t("Écrire à")} {conciergeFirstName}
      </a>
    </PillAction>
  ) : null;

  const quote = (
    <blockquote className="rounded-[24px] border border-foreground/16 bg-glass p-[22px] font-display text-[23px] italic leading-[1.28] lg:rounded-[28px] lg:p-7 lg:text-[32px]">
      {t("« Le luxe véritable, c’est le temps rendu à l’essentiel. »")}
    </blockquote>
  );

  const outline = "flex h-[52px] w-full items-center justify-between gap-3 rounded-full border border-foreground/24 pl-6 pr-2 text-[15px] font-medium transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto lg:justify-start lg:px-6";
  const footer = (
    <div className="grid gap-3 lg:flex lg:flex-wrap">
      {isAdmin && (
        <Link to="/admin" className={outline}>
          <span className="lg:order-2">{t("Administration")}</span>
          <span className="flex size-9 items-center justify-center rounded-full border border-foreground/24 lg:order-1 lg:size-auto lg:border-0"><ShieldCheck className="size-4" /></span>
        </Link>
      )}
      <button type="button" onClick={signOut} className={outline}>
        <span className="lg:order-2">{t("Se déconnecter")}</span>
        <span className="flex size-9 items-center justify-center rounded-full border border-foreground/24 lg:order-1 lg:size-auto lg:border-0"><LogOut className="size-4" /></span>
      </button>
    </div>
  );

  const tiles = (
    <div className="grid grid-cols-2 gap-3 lg:gap-4">
      <AccountTile to="/membership/informations" label={t("Vos informations")} icon={<CircleUserRound className="size-[18px]" />} />
      <AccountTile to="/membership/factures" label={t("Mes factures")} icon={<FileText className="size-[18px]" />} tone="glass" />
      <AccountTile to="/membership/historique" label={t("Historique des demandes")} icon={<History className="size-[18px]" />} tone="glass" />
      <AccountTile to="/membership/parrainer" label={t("Parrainer un membre")} icon={<Gift className="size-[18px]" />} photo={imageFor("bassin")} />
      {/* Lots 6.4 et 6.5 */}
      <AccountTile to="/membership/preferences" label={t("Mes préférences")} icon={<Sparkles className="size-[18px]" />} />
      <AccountTile to="/membership/releve" label={t("Mon relevé")} icon={<ReceiptText className="size-[18px]" />} tone="glass" />
      <AccountTile to="/membership/langue" label={t("Langue de l’application")} icon={<Languages className="size-[18px]" />} tone="glass" />
    </div>
  );

  return (
    <AppShell immersive>
      <div className="hidden lg:mb-10 lg:block">
        <TopBar />
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <section className="relative isolate flex h-[372px] flex-col justify-between overflow-hidden rounded-[28px] bg-panel p-[14px] pb-24 text-foreground">
          <Photo src={imageFor("entree-de-nuit")} alt={t("Entrée Art de Vie de nuit")} hero eager className="absolute inset-0 -z-10 h-full w-full" />
          <TopBar />
          <div className="px-1.5">
            <Title italic={tail} className="text-[46px] leading-[0.98]">{head}{" "}</Title>
            <p className="mt-3 max-w-[310px] text-[15px] leading-[22px] text-muted-foreground">
              {t("Votre carte personnelle ouvre l’accès à votre espace et aux attentions réservées par notre maison.")}
            </p>
          </div>
        </section>
        <div className="relative z-10 mx-2.5 -mt-[76px]">
          <MemberCard profile={profile} />
        </div>
        {writeButton && <div className="mt-4">{writeButton}</div>}
        <section className="mt-8">
          <h2 className="eyebrow mx-2 mb-3.5 text-muted-foreground">{t("Votre compte")}</h2>
          {tiles}
        </section>
        <div className="mt-3">{quote}</div>
        <div className="mt-3">{footer}</div>
      </div>

      {/* Ordinateur */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-8 lg:px-4">
        <div className="lg:col-span-5 lg:space-y-4">
          <MemberCard profile={profile} />
          {quote}
          {footer}
        </div>
        <div className="lg:col-span-7">
          <p className="eyebrow text-muted-foreground">{t("Membership")}</p>
          <Title italic={tail} className="mt-5 text-[clamp(56px,6vw,96px)] leading-[0.98]">{head}{" "}</Title>
          <p className="mt-6 max-w-[520px] text-[18px] leading-7 text-muted-foreground">
            {t("Votre carte personnelle ouvre l’accès à votre espace et aux attentions réservées par notre maison.")}
          </p>
          {writeButton && <div className="mt-7">{writeButton}</div>}
          <h2 className="eyebrow mt-12 mb-4 text-muted-foreground">{t("Votre compte")}</h2>
          {tiles}
        </div>
      </div>
    </AppShell>
  );
}
