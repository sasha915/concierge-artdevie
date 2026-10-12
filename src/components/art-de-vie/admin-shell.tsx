import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Lock, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/art-de-vie/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { lockAdmin } from "@/lib/admin-gate.functions";

const teamNav = [
  { to: "/admin", label: "Tableau de bord", exact: true },
  { to: "/admin/membres", label: "Membres", exact: false },
] as const;

const pill = "inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AdminShell({ children }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lock = useServerFn(lockAdmin);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/connexion", replace: true });
  }

  async function lockSession() {
    await lock({});
    queryClient.removeQueries({ queryKey: ["admin"] });
    await navigate({ to: "/admin-connexion", replace: true });
  }

  return (
    <div className="team-theme min-h-screen">
      <div className="px-4 pt-4">
        <nav aria-label="Navigation équipe" className="team-glass mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-full px-3 py-2 backdrop-blur-[18px]">
          <Link to="/admin" className="mr-1 flex items-center gap-2 rounded-full px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo inverse className="h-[22px] w-auto" />
          </Link>
          <span className="eyebrow mr-2 rounded-full border border-border px-3 py-1 text-[10px]">Équipe</span>
          {teamNav.map(({ to, label, exact }) => {
            const active = exact ? pathname === to || pathname === `${to}/` : pathname.startsWith(to);
            return <Link key={to} to={to} aria-current={active ? "page" : undefined} className={`${pill} ${active ? "bg-primary font-medium text-primary-foreground" : "hover:bg-primary/10"}`}>{label}</Link>;
          })}
          <Link to="/membership" className={`${pill} hover:bg-primary/10`}><ArrowLeft className="size-4" />Retour à l’espace membre</Link>
          <button type="button" aria-label="Verrouiller l’administration" onClick={lockSession} className={`${pill} size-11 justify-center border border-border px-0 hover:bg-primary/10`}><Lock className="size-4" /></button>
          <button type="button" aria-label="Se déconnecter" onClick={signOut} className={`${pill} size-11 justify-center border border-border px-0 hover:bg-primary/10`}><LogOut className="size-4" /></button>
        </nav>
      </div>
      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 lg:px-[clamp(20px,3.9vw,56px)]">{children}</main>
    </div>
  );
}

export function TeamStatus({ status }: { status: string }) {
  const cls: Record<string, string> = {
    "Nouvelle": "border border-primary text-primary",
    "En cours": "bg-primary/18 text-primary",
    "Confirmée": "bg-[var(--team-confirmed)] text-primary-foreground",
    "Terminée": "bg-primary text-primary-deep",
    "Annulée": "border border-dashed border-border team-mention",
  };
  return <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${cls[status] ?? "border border-border"}`}>{status}</span>;
}
