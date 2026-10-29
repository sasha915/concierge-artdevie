import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import logoBeige from "@/assets/logo-beige.svg";
import logoViolet from "@/assets/logo-violet.svg";
import { initials } from "@/data/art-de-vie";
import { profileQuery, unreadRequestNotificationsQuery } from "@/lib/adv-queries";
import { BookmarkIcon, HomeIcon, InboxIcon, UserIcon } from "./icons";
import { PillAction, Title } from "./v3";
import { t, tPair } from "@/lib/i18n";
import { useDelegation, useSignOut } from "./use-delegation";

export function Logo({ inverse = false, className = "h-8 w-auto" }: { inverse?: boolean; className?: string }) {
  return <img src={inverse ? logoBeige : logoViolet} alt={t("Art de Vie")} className={className} />;
}

const nav = [
  { to: "/", label: "Accueil", Icon: HomeIcon },
  { to: "/demandes", label: "Demandes", Icon: InboxIcon },
  { to: "/offres", label: "Offres", Icon: BookmarkIcon },
  { to: "/membership", label: "Membership", Icon: UserIcon },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: unread = [] } = useQuery(unreadRequestNotificationsQuery);
  // Lot 5.4 : un proche autorisé n'a que l'accueil et ses demandes.
  const { delegation } = useDelegation();
  const items = delegation ? nav.filter((n) => n.to === "/" || n.to === "/demandes") : nav;
  return (
    <nav
      aria-label={t("Navigation principale")}
      className={`fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-50 grid h-16 w-[calc(100%-28px)] max-w-[500px] -translate-x-1/2 ${delegation ? "grid-cols-3" : "grid-cols-5"} items-center justify-items-center rounded-full border border-foreground/22 bg-primary-deep/86 px-2 text-foreground shadow-nav backdrop-blur-[18px] md:flex md:w-auto md:max-w-none md:gap-1 lg:hidden`}
    >
      {items.map(({ to, label, Icon }, index) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            aria-label={to === "/demandes" && unread.length > 0 ? t("{label}, nouveautés", { label: t(label) }) : t(label)}
            aria-current={active ? "page" : undefined}
            className={`relative flex size-12 items-center justify-center rounded-full transition-colors active:scale-95 md:w-auto md:gap-2 md:pl-4 md:pr-5 md:text-[15px] ${active ? "md:font-medium" : ""} ${delegation ? (index === 1 ? "col-start-3" : "") : index > 1 ? (index === 2 ? "col-start-4" : "col-start-5") : ""} ${active ? "bg-foreground/16" : "hover:bg-foreground/10"}`}
          >
            <Icon filled={active} aria-hidden="true" />
            {/* Tablette : libellé à côté de l'icône. */}
            <span aria-hidden="true" className="hidden whitespace-nowrap md:inline">{to === "/demandes" ? t("Mes demandes") : t(label)}</span>
            {to === "/demandes" && unread.length > 0 && <span aria-hidden="true" className="absolute right-2.5 top-2.5 size-2 rounded-full bg-foreground" />}
          </Link>
        );
      })}
      <Button asChild variant="light" size="icon" className={`${delegation ? "col-start-2" : "col-start-3"} row-start-1 size-12 md:hidden`} title={t("Nouvelle demande")}>
        <Link to="/demandes/nouvelle" search={{ offer: undefined }} aria-label={t("Nouvelle demande")}>
          <Plus className="size-6" />
        </Link>
      </Button>
    </nav>
  );
}

export function AppShell({
  children,
  nav = true,
  immersive = false,
}: {
  children: ReactNode;
  nav?: boolean;
  immersive?: boolean;
}) {
  const baseMain = `appear mx-auto min-h-screen min-w-0 max-w-[1120px] ${immersive ? "px-3 pt-3" : "px-5 pt-6"} sm:px-8 md:px-5 lg:max-w-[1440px] lg:px-4 lg:pb-16 lg:pt-4`;
  return (
    <>
      <main className={`${baseMain} ${nav ? "pb-28 lg:pb-10" : "pb-10"}`}>
        {children}
        {nav && <BottomNav />}
      </main>
    </>
  );
}

export function TopBar({ title, action }: { title?: string; action?: ReactNode }) {
  const { data: profile } = useQuery(profileQuery);
  const { data: unread = [] } = useQuery(unreadRequestNotificationsQuery);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { delegation } = useDelegation();
  const signOut = useSignOut();
  const items = delegation ? nav.filter((n) => n.to === "/" || n.to === "/demandes") : nav;
  const account = delegation ? (
    <Button type="button" variant="light" size="icon" className="size-11" onClick={() => void signOut()} aria-label={t("Se déconnecter")} title={t("Se déconnecter")}>
      <LogOut className="size-4" />
    </Button>
  ) : null;
  return (
    <>
      <header className="dark-glass grid h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-full py-2 pl-4 pr-2 lg:hidden">
        <div className="min-w-0">
          {title ? <span className="text-sm">{title}</span> : <Logo inverse className="h-[23px] w-auto max-w-full" />}
        </div>
        <div className="flex items-center gap-2">
          {/* Tablette : « Nouvelle demande » dans la barre du haut, le « + » de la barre du bas disparaît. */}
          {!action && (
            <Button asChild variant="light" className="hidden h-11 gap-2 px-5 text-[15px] md:inline-flex">
              <Link to="/demandes/nouvelle" search={{ offer: undefined }}>
                <Plus className="size-4" aria-hidden="true" />
                {t("Nouvelle demande")}
              </Link>
            </Button>
          )}
          {action ?? account ?? (
            <Button asChild variant="light" size="icon" className="size-11 font-medium">
              <Link to="/membership" aria-label={t("Votre Membership")}>
                {initials(profile?.full_name ?? "")}
              </Link>
            </Button>
          )}
        </div>
      </header>
      <nav
        aria-label={t("Navigation desktop")}
        className="hidden lg:dark-glass lg:mx-auto lg:flex lg:min-h-[60px] lg:w-fit lg:max-w-full lg:flex-wrap lg:items-center lg:justify-center lg:gap-2 lg:rounded-full lg:px-4 lg:py-2 lg:text-foreground"
      >
        <Logo inverse className="lg:mr-3 lg:h-[24px] lg:w-auto" />
        {items.map(({ to, label }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Button
              key={to}
              asChild
              variant="ghost"
              className={`lg:h-11 lg:px-4 lg:text-[15px] lg:text-foreground lg:hover:bg-foreground/10 ${active ? "lg:bg-foreground/16 lg:font-medium" : "lg:font-normal"}`}
            >
              <Link to={to} aria-current={active ? "page" : undefined} className="relative">
                {to === "/demandes" ? t("Mes demandes") : t(label)}
                {to === "/demandes" && unread.length > 0 && (
                  <>
                    <span aria-hidden="true" className="absolute right-2 top-2 size-1.5 rounded-full bg-foreground" />
                    <span className="sr-only">{t(", nouveautés")}</span>
                  </>
                )}
              </Link>
            </Button>
          );
        })}
        <Button asChild variant="light" className="lg:ml-2 lg:h-11 lg:gap-2 lg:px-5 lg:text-[15px]">
          <Link to="/demandes/nouvelle" search={{ offer: undefined }}>
            <Plus className="size-4" aria-hidden="true" />
            {t("Nouvelle demande")}
          </Link>
        </Button>
        {delegation ? (
          <Button type="button" variant="outline" size="icon" onClick={() => void signOut()} aria-label={t("Se déconnecter")} title={t("Se déconnecter")} className="lg:size-11 lg:border-foreground/22 lg:bg-transparent lg:text-foreground lg:hover:bg-foreground/10">
            <LogOut className="size-4" />
          </Button>
        ) : (
          <Button
            asChild
            variant="outline"
            size="icon"
            className="lg:size-11 lg:border-foreground/22 lg:bg-transparent lg:text-foreground lg:hover:bg-foreground/10"
          >
            <Link to="/membership" aria-label={t("Votre Membership")}>
              {initials(profile?.full_name ?? "")}
            </Link>
          </Button>
        )}
      </nav>
    </>
  );
}

export function PageHeader({ title: rawTitle, subtitle }: { title: string; subtitle?: string }) {
  const title = t(rawTitle);
  return (
    <>
      <div className="mb-6">
        <TopBar />
      </div>
      <Title italic={`${title.split(" ").slice(-1).join(" ")}.`} className="text-primary">
        {title.split(" ").slice(0, -1).join(" ")}
        {title.includes(" ") ? " " : ""}
      </Title>
      {subtitle && <p className="mt-2 mb-6 text-[13px] text-muted-foreground">{t(subtitle)}</p>}
    </>
  );
}

export function NewRequestButton({ className }: { className?: string }) {
  return (
    <PillAction asChild plus className={className}>
      <Link to="/demandes/nouvelle" search={{ offer: undefined }}>
        {t("Nouvelle demande")}
      </Link>
    </PillAction>
  );
}

export function ListHeader({
  eyebrow,
  title,
  italic,
  introduction,
  children,
  action,
  desktop = false,
}: {
  desktop?: boolean;
  eyebrow: string;
  title: string;
  italic: string;
  introduction: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const [head, tail] = tPair(title, italic);
  return (
    <section
      className={`relative isolate overflow-hidden rounded-[28px] bg-panel p-[14px] pb-[22px] text-foreground ${desktop ? "md:overflow-visible md:rounded-none md:bg-transparent md:p-0" : ""}`}
    >
      <Logo inverse className={`pointer-events-none absolute -right-[18%] top-[36%] -z-10 w-[112%] max-w-none opacity-5 ${desktop ? "md:hidden" : ""}`} />
      <TopBar />
      <div className={`px-1.5 pt-[34px] ${desktop ? "md:px-3 md:pt-11 lg:px-8 lg:pt-14" : ""}`}>
        <p className="eyebrow mb-3.5 text-muted-foreground">{t(eyebrow)}</p>
        <Title italic={tail} className={`text-[46px] leading-[0.98] ${desktop ? "md:text-[72px] lg:text-[clamp(56px,6vw,96px)]" : ""}`}>
          {head}
        </Title>
        <div className={desktop ? "md:mt-5 md:flex md:flex-wrap md:items-end md:justify-between md:gap-6" : undefined}>
          <p className={`mt-[22px] border-t border-foreground/24 pt-[18px] text-[15px] leading-[23px] text-muted-foreground ${desktop ? "md:mt-0 md:max-w-[620px] md:border-0 md:pt-0 md:text-[18px] md:leading-7" : ""}`}>
            {t(introduction)}
          </p>
          {action && <div className={desktop ? "hidden md:block" : "hidden"}>{action}</div>}
        </div>
      </div>
      {children && <div className={`-mx-[14px] mt-5 px-5 ${desktop ? "md:mx-0 md:mt-7 md:px-3 lg:px-8" : ""}`}>{children}</div>}
    </section>
  );
}
