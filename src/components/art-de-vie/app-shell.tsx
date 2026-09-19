import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import logoBeige from "@/assets/logo-beige.svg";
import logoViolet from "@/assets/logo-violet.svg";
import { initials } from "@/data/art-de-vie";
import { profileQuery } from "@/lib/adv-queries";
import { BookmarkIcon, HomeIcon, InboxIcon, UserIcon } from "./icons";

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
  return <nav aria-label="Navigation principale" className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-50 flex h-16 w-[calc(100%-32px)] max-w-[500px] -translate-x-1/2 items-center justify-around rounded-full border border-primary/10 bg-card/95 px-2 shadow-nav backdrop-blur-xl lg:hidden">
    {nav.map(({ to, label, Icon }) => {
      const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
      return <Link key={to} to={to} aria-label={label} className={active ? "flex h-11 items-center gap-2 rounded-full bg-primary/10 px-4 text-primary" : "flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"}>
        <Icon filled={active} aria-hidden="true" />{active && <span className="text-[11px] font-semibold">{label}</span>}
      </Link>;
    })}
  </nav>;
}

function DesktopSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useQuery(profileQuery);
  const name = profile?.full_name?.trim() || "Membre Art de Vie";

  return <aside className="fixed inset-y-0 left-0 z-50 hidden w-[264px] flex-col bg-linear-to-b from-primary to-primary-deep px-5 py-8 text-primary-foreground lg:flex">
    <div className="px-3">
      <Logo inverse className="h-[26px] w-auto" />
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-primary-foreground/45">Espace membre</p>
    </div>
    <nav aria-label="Navigation principale" className="mt-14 flex flex-col gap-2">
      {nav.map(({ to, label, Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        const desktopLabel = to === "/demandes" ? "Mes demandes" : label;
        return <Link key={to} to={to} className={active ? "flex h-12 items-center gap-3 rounded-full bg-primary-foreground/12 px-4 text-primary-foreground" : "flex h-12 items-center gap-3 rounded-full px-4 text-primary-foreground/60 transition-colors hover:bg-primary-foreground/8 hover:text-primary-foreground"}>
          <Icon filled={active} className="size-[21px] shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-medium">{desktopLabel}</span>
        </Link>;
      })}
    </nav>
    <div className="mt-auto border-t border-primary-foreground/18 px-2 pt-5">
      <div className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary-foreground/35 font-display text-[13px] font-semibold">{initials(name)}</span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{name}</p>
          <p className="mt-0.5 truncate text-[11px] text-primary-foreground/55">Formule {profile?.plan ?? "Signature"}</p>
        </div>
      </div>
    </div>
  </aside>;
}

export function AppShell({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  return <>{nav && <DesktopSidebar />}<main className={nav ? "mx-auto min-h-screen max-w-[1120px] px-5 pb-28 pt-6 sm:px-8 lg:ml-[264px] lg:max-w-[calc(100%-264px)] lg:px-10 lg:pb-10 lg:pt-8 xl:px-12" : "mx-auto min-h-screen max-w-[1120px] px-5 pb-10 pt-6 sm:px-8 lg:px-10"}>{children}{nav && <BottomNav />}</main></>;
}

export function TopBar({ title, action }: { title?: string; action?: ReactNode }) {
  return <header className="mb-8 flex items-center justify-between"><div>{title ? <h1 className="font-display text-[32px] font-semibold leading-tight text-primary">{title}</h1> : <Logo />}</div>{action ?? <Button aria-label="Notifications" variant="icon" size="icon"><Bell /></Button>}</header>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <>
    <div className="mb-6 flex items-center justify-between"><div className="w-11" /><Logo className="h-[19px] w-auto" /><Button aria-label="Notifications" variant="icon" size="icon"><Bell /></Button></div>
    <h1 className="font-display text-[32px] font-semibold leading-tight text-primary">{title}</h1>
    {subtitle && <p className="mt-2 mb-6 text-[13px] text-muted-foreground">{subtitle}</p>}
  </>;
}

export function NewRequestButton({ className }: { className?: string }) {
  return <Button asChild variant="primary" size="lg" className={className}><Link to="/demandes/nouvelle"><Plus />Nouvelle demande</Link></Button>;
}
