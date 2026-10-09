import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import logoBeige from "@/assets/logo-beige.svg";
import logoViolet from "@/assets/logo-violet.svg";
import { initials } from "@/data/art-de-vie";
import { profileQuery } from "@/lib/adv-queries";
import { BookmarkIcon, HomeIcon, InboxIcon, UserIcon } from "./icons";
import { PillAction, Title } from "./v3";

export function Logo({ inverse = false, className = "h-8 w-auto" }: { inverse?: boolean; className?: string }) {
  return <img src={inverse ? logoBeige : logoViolet} alt="Art de Vie" className={className} />;
}

const nav = [
  { to: "/", label: "Accueil", Icon: HomeIcon },
  { to: "/demandes", label: "Demandes", Icon: InboxIcon },
  { to: "/offres", label: "Offres", Icon: BookmarkIcon },
  { to: "/membership", label: "Membership", Icon: UserIcon },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return <nav aria-label="Navigation principale" className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-50 grid h-16 w-[calc(100%-32px)] max-w-[500px] -translate-x-1/2 grid-cols-5 items-center justify-items-center rounded-full border border-primary-foreground/22 bg-primary-deep/86 px-2 text-primary-foreground shadow-nav backdrop-blur-[18px] lg:hidden">
    {nav.map(({ to, label, Icon }, index) => {
      const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
      return <Link key={to} to={to} aria-label={label} aria-current={active ? "page" : undefined} className={`flex size-12 items-center justify-center rounded-full transition-colors active:scale-95 ${index > 1 ? index === 2 ? "col-start-4" : "col-start-5" : ""} ${active ? "bg-primary-foreground/16" : "hover:bg-primary-foreground/10"}`}><Icon filled={active} aria-hidden="true" /></Link>;
    })}
    <Button asChild variant="light" size="icon" className="col-start-3 row-start-1 size-12" title="Nouvelle demande"><Link to="/demandes/nouvelle" search={{ offer: undefined }} aria-label="Nouvelle demande"><Plus className="size-6" /></Link></Button>
  </nav>;
}

export function AppShell({ children, nav = true, immersive = false }: { children: ReactNode; nav?: boolean; immersive?: boolean }) {
  const baseMain = `appear mx-auto min-h-screen min-w-0 max-w-[1120px] ${immersive ? "px-3 pt-3" : "px-5 pt-6"} sm:px-8 lg:max-w-[1440px] lg:px-4 lg:pb-16 lg:pt-4`;
  return <><main className={`${baseMain} ${nav ? "pb-28 lg:pb-10" : "pb-10"}`}>{children}{nav && <BottomNav />}</main></>;
}

export function TopBar({ title, action }: { title?: string; action?: ReactNode }) {
  const { data: profile } = useQuery(profileQuery);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return <><header className="dark-glass grid h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-full py-2 pl-4 pr-2 lg:hidden"><div className="min-w-0">{title ? <span className="text-sm">{title}</span> : <Logo inverse className="h-[23px] w-auto max-w-full" />}</div>{action ?? <Button asChild variant="light" size="icon" className="size-11 font-medium"><Link to="/membership" aria-label="Votre Membership">{initials(profile?.full_name ?? "")}</Link></Button>}</header>
    <nav aria-label="Navigation desktop" className="hidden lg:dark-glass lg:mx-auto lg:flex lg:min-h-[60px] lg:w-fit lg:max-w-full lg:flex-wrap lg:items-center lg:justify-center lg:gap-2 lg:rounded-full lg:px-4 lg:py-2 lg:text-primary-foreground">
      <Logo inverse className="lg:mr-3 lg:h-[24px] lg:w-auto" />
      {nav.map(({ to, label }) => { const active = to === "/" ? pathname === "/" : pathname.startsWith(to); return <Button key={to} asChild variant="ghost" className={`lg:h-11 lg:px-4 lg:text-[15px] lg:text-primary-foreground lg:hover:bg-primary-foreground/10 ${active ? "lg:bg-primary-foreground/16 lg:font-medium" : "lg:font-normal"}`}><Link to={to} aria-current={active ? "page" : undefined}>{to === "/demandes" ? "Mes demandes" : label}</Link></Button>; })}
      <Button asChild variant="light" className="lg:ml-2 lg:h-11 lg:px-5 lg:text-[15px]"><Link to="/demandes/nouvelle" search={{ offer: undefined }}>Nouvelle demande</Link></Button>
      <Button asChild variant="outline" size="icon" className="lg:size-11 lg:border-primary-foreground/22 lg:bg-transparent lg:text-primary-foreground lg:hover:bg-primary-foreground/10"><Link to="/membership" aria-label="Votre Membership">{initials(profile?.full_name ?? "")}</Link></Button>
    </nav></>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <>
    <div className="mb-6"><TopBar /></div>
    <Title italic={`${title.split(" ").slice(-1).join(" ")}.`} className="text-primary">{title.split(" ").slice(0, -1).join(" ")}{title.includes(" ") ? " " : ""}</Title>
    {subtitle && <p className="mt-2 mb-6 text-[13px] text-muted-foreground">{subtitle}</p>}
  </>;
}

export function NewRequestButton({ className }: { className?: string }) {
  return <PillAction asChild className={className}><Link to="/demandes/nouvelle" search={{ offer: undefined }}>Nouvelle demande</Link></PillAction>;
}

export function ListHeader({ eyebrow, title, italic, introduction, children, desktop = false }: { desktop?: boolean; eyebrow: string; title: string; italic: string; introduction: string; children?: ReactNode }) {
  return <section className={`relative -mx-2 -mt-3 overflow-hidden rounded-[28px] bg-primary-deep p-4 text-primary-foreground sm:mx-0 sm:mt-0 ${desktop ? "lg:flex lg:min-h-[520px] lg:flex-col lg:px-[clamp(20px,3.9vw,56px)] lg:py-6" : ""}`}><Logo inverse className="pointer-events-none absolute bottom-16 left-3 w-[150%] max-w-none opacity-5" /><div className={`relative ${desktop ? "lg:flex lg:flex-1 lg:flex-col" : ""}`}><TopBar /><p className={`eyebrow mt-7 text-primary-foreground/80 ${desktop ? "lg:mt-24" : ""}`}>{eyebrow}</p><Title italic={italic} className={`mt-4 ${desktop ? "lg:text-[clamp(70px,10vw,144px)] lg:leading-[0.96]" : ""}`}>{title}</Title><p className={`mb-5 mt-5 border-t border-primary-foreground/22 pt-4 text-[13px] leading-5 text-primary-foreground ${desktop ? "lg:hidden" : ""}`}>{introduction}</p><div className={desktop ? "lg:mt-auto lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-6 lg:border-t lg:border-primary-foreground/22 lg:pt-7" : undefined}>{desktop && <p className="hidden lg:block lg:min-w-[260px] lg:flex-1 lg:text-[18px] lg:leading-7">{introduction}</p>}{children}</div></div></section>;
}
