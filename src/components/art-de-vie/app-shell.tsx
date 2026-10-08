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

export function AppShell({ children, nav = true, immersive = false }: { children: ReactNode; nav?: boolean; immersive?: boolean }) {
  const baseMain = `appear mx-auto min-h-screen min-w-0 max-w-[1120px] ${immersive ? "px-3 pt-3" : "px-5 pt-6"} sm:px-8 lg:ml-[264px] lg:max-w-[calc(100%-264px)] lg:px-10 lg:pb-10 lg:pt-8 xl:px-12`;
  return <><DesktopSidebar /><main className={`${baseMain} ${nav ? "pb-28 lg:pb-10" : "pb-10"}`}>{children}{nav && <BottomNav />}</main></>;
}

export function TopBar({ title, action }: { title?: string; action?: ReactNode }) {
  const { data: profile } = useQuery(profileQuery);
  return <header className="dark-glass grid h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-full py-2 pl-4 pr-2"><div className="min-w-0">{title ? <span className="text-sm">{title}</span> : <Logo inverse className="h-[23px] w-auto max-w-full" />}</div>{action ?? <Button asChild variant="light" size="icon" className="size-11 font-medium"><Link to="/membership" aria-label="Votre Membership">{initials(profile?.full_name ?? "")}</Link></Button>}</header>;
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

export function ListHeader({ eyebrow, title, italic, introduction, children }: { eyebrow: string; title: string; italic: string; introduction: string; children?: ReactNode }) {
  return <section className="relative -mx-2 -mt-3 overflow-hidden rounded-[28px] bg-primary-deep p-4 text-primary-foreground sm:mx-0 sm:mt-0"><Logo inverse className="pointer-events-none absolute bottom-16 left-3 w-[150%] max-w-none opacity-5" /><div className="relative"><TopBar /><p className="eyebrow mt-7 text-primary-foreground/80">{eyebrow}</p><Title italic={italic} className="mt-4">{title}</Title><p className="mb-5 mt-5 border-t border-primary-foreground/22 pt-4 text-[13px] leading-5 text-primary-foreground">{introduction}</p>{children}</div></section>;
}
