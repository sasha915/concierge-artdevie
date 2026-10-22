import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Lock, LogOut, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/art-de-vie/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { lockAdmin } from "@/lib/admin-gate.functions";
import { adminReferralsQuery, teamRoleQuery } from "@/lib/admin-queries";
import { Button } from "@/components/ui/button";

const teamNav = [
  { to: "/admin", label: "Tableau de bord", exact: true },
  { to: "/admin/demandes", label: "Demandes", exact: false },
  { to: "/admin/agenda", label: "Agenda", exact: false },
  { to: "/admin/membres", label: "Membres", exact: false },
  { to: "/admin/offres", label: "Offres", exact: false, adminOnly: true },
  { to: "/admin/parrainages", label: "Parrainages", exact: false, adminOnly: true },
  { to: "/admin/equipe", label: "Équipe", exact: false, adminOnly: true },
] as const;

const pill = "inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AdminShell({ children }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lock = useServerFn(lockAdmin);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: teamRole = null } = useQuery(teamRoleQuery);
  const isAdmin = teamRole === "admin";
  const { data: referrals = [] } = useQuery({ ...adminReferralsQuery, enabled: isAdmin });
  const pendingReferrals = referrals.filter((r) => r.status === "Invitation envoyée").length;

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
        <nav aria-label="Navigation équipe" className="team-glass mx-auto grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[28px] px-3 py-2 backdrop-blur-[18px] sm:flex sm:w-fit sm:flex-wrap sm:justify-center sm:gap-1 sm:rounded-full">
          <Link to="/admin" className="mr-1 flex items-center gap-2 rounded-full px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo inverse className="h-[22px] w-auto" />
          </Link>
          <span className="eyebrow mr-2 rounded-full border border-border px-3 py-1 text-[10px]">Équipe</span>
          {teamNav.filter((item) => isAdmin || !("adminOnly" in item)).map(({ to, label, exact }) => {
            const active = exact ? pathname === to || pathname === `${to}/` : pathname.startsWith(to) && !pathname.startsWith("/admin/demandes/nouvelle");
            return <Link key={to} to={to} aria-current={active ? "page" : undefined} className={`${pill} ${active ? "bg-primary font-medium text-primary-foreground" : "hover:bg-primary/10"}`}>{label}{to === "/admin/parrainages" && pendingReferrals > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1.5 text-[11px] font-semibold text-primary">{pendingReferrals}</span>}</Link>;
          })}
          <Link to="/admin/demandes/nouvelle" className={`${pill} bg-primary font-medium text-primary-foreground hover:bg-primary/90`}><Plus className="size-4" />Demande</Link>
          <Link to="/membership" className={`${pill} col-span-2 min-w-0 hover:bg-primary/10 sm:col-auto`}><ArrowLeft className="size-4 shrink-0" />Retour à l’espace membre</Link>
          <Button type="button" variant="outline" size="icon" title="Verrouiller l’espace équipe" aria-label="Verrouiller l’espace équipe" onClick={lockSession} className="size-11 rounded-full"><Lock className="size-4" /></Button>
          <Button type="button" variant="outline" size="icon" title="Se déconnecter" aria-label="Se déconnecter" onClick={signOut} className="size-11 rounded-full"><LogOut className="size-4" /></Button>
        </nav>
      </div>
      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 lg:px-[clamp(20px,3.9vw,56px)]">{children}</main>
    </div>
  );
}

const STATUS_CLASS: Record<string, string> = {
  "Nouvelle": "border border-primary text-primary",
  "En cours": "bg-primary/18 text-primary",
  "Confirmée": "bg-[var(--team-confirmed)] text-primary-foreground",
  "Terminée": "bg-primary text-primary-deep",
  "Annulée": "border border-dashed border-border team-mention",
};

/** Style d'un statut de demande dans l'interface équipe (pastilles, agenda). */
export function teamStatusClass(status: string): string {
  return STATUS_CLASS[status] ?? "border border-border";
}

export function TeamStatus({ status }: { status: string }) {
  return <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${teamStatusClass(status)}`}>{status}</span>;
}
