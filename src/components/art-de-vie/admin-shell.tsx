import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, LogOut, Menu, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/art-de-vie/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { adminGateStatus, lockAdmin } from "@/lib/admin-gate.functions";
import { adminReferralsQuery, allRequestsQuery, teamRoleQuery } from "@/lib/admin-queries";
import { profileQuery } from "@/lib/adv-queries";
import { Avatar, useMyAvatar } from "./avatar";
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

const pill = "inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-[14px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AdminShell({ children }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lock = useServerFn(lockAdmin);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: teamRole = null } = useQuery(teamRoleQuery);
  const isAdmin = teamRole === "admin";
  const { data: referrals = [] } = useQuery({ ...adminReferralsQuery, enabled: isAdmin });
  const pendingReferrals = referrals.filter((r) => r.status === "Invitation envoyée").length;
  const { data: requests = [] } = useQuery(allRequestsQuery);
  const newRequests = requests.filter((r) => r.status === "Nouvelle").length;
  const { data: profile } = useQuery(profileQuery);
  const myPhoto = useMyAvatar();
  // Session équipe vérifiée chaque minute et au retour sur l'onglet : expirée, on revient à l'accès équipe.
  const gate = useServerFn(adminGateStatus);
  const { data: gateState } = useQuery({ queryKey: ["admin-gate"], queryFn: () => gate(), refetchInterval: 60_000, refetchOnWindowFocus: true, staleTime: 0 });
  useEffect(() => {
    if (gateState && !gateState.unlocked) void navigate({ to: "/admin-connexion", replace: true });
  }, [gateState, navigate]);
  const badge = "inline-flex min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1.5 text-[11px] font-semibold text-primary";

  async function signOut() {
    // Le verrou d'équipe et les données en mémoire ne survivent pas à la déconnexion.
    try { await lock({}); } catch { /* verrou déjà fermé */ }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/connexion", replace: true });
  }

  async function lockSession() {
    // Après « Verrouiller », la page d'accès ne rouvre pas d'elle-même : une nouvelle connexion Google est demandée.
    try { sessionStorage.setItem("adv-team-locked", "1"); } catch { /* stockage indisponible */ }
    await lock({});
    queryClient.removeQueries({ queryKey: ["admin"] });
    await navigate({ to: "/admin-connexion", replace: true });
  }

  const items = teamNav.filter((item) => isAdmin || !("adminOnly" in item));
  const isActive = (to: string, exact: boolean) => (exact ? pathname === to || pathname === `${to}/` : pathname.startsWith(to) && !pathname.startsWith("/admin/demandes/nouvelle"));
  const countFor = (to: string) => (to === "/admin/demandes" ? newRequests : to === "/admin/parrainages" ? pendingReferrals : 0);
  const total = newRequests + pendingReferrals;

  // Sous 1280 px : barre compacte et menu en panneau (la barre complète tient sur une ligne au-delà).
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="team-theme min-h-screen">
      <div className="relative z-40 px-4 pt-4">
        <div className="xl:hidden">
          <div className="team-glass flex items-center justify-between gap-2 rounded-full py-2 pl-4 pr-2 backdrop-blur-[18px]">
            <div className="flex min-w-0 items-center gap-2">
              <Link to="/admin" aria-label="Art de Vie, tableau de bord" className="flex shrink-0 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Logo inverse className="h-[22px] w-auto" />
              </Link>
              <span className="hidden rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground sm:inline">Équipe</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/admin/demandes/nouvelle" className={`${pill} bg-primary font-medium text-primary-foreground hover:bg-primary/90`}><Plus className="size-4" />Demande</Link>
              <button ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="team-menu" onClick={() => setMenuOpen((v) => !v)} className={`${pill} border border-border ${menuOpen ? "bg-primary/16" : "hover:bg-primary/10"}`}>
                {menuOpen ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
                Menu
                {total > 0 && <span className={badge} aria-label={`${total} à traiter`}>{total}</span>}
              </button>
              <span title={profile?.full_name ?? ""} aria-label={profile?.full_name ? `Connecté : ${profile.full_name}` : undefined} className="hidden sm:inline-flex"><Avatar url={myPhoto} name={profile?.full_name ?? ""} className="size-11 bg-primary/14 text-[13px] font-semibold" /></span>
            </div>
          </div>
          {menuOpen && (
            <nav id="team-menu" aria-label="Navigation équipe" className="team-panel absolute inset-x-4 top-[84px] rounded-[28px] border border-border p-3 shadow-member">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {items.map(({ to, label, exact }) => {
                  const active = isActive(to, exact);
                  const count = countFor(to);
                  return <Link key={to} to={to} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)} className={`flex min-h-14 items-center justify-between gap-3 rounded-[18px] px-[18px] text-[17px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary font-medium text-primary-foreground" : "hover:bg-primary/10"}`}>{label}{count > 0 && <span className={active ? "inline-flex min-w-6 items-center justify-center rounded-full bg-primary-foreground px-1.5 text-[12px] font-semibold text-primary" : badge}>{count}</span>}</Link>;
                })}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2 border-t border-border px-1.5 pb-1 pt-3">
                <Button type="button" variant="outline" onClick={lockSession} className="h-11 gap-2 rounded-full px-4"><Lock className="size-4" />Verrouiller</Button>
                <Button type="button" variant="outline" onClick={signOut} className="h-11 gap-2 rounded-full px-4"><LogOut className="size-4" />Se déconnecter</Button>
              </div>
            </nav>
          )}
        </div>
        <nav aria-label="Navigation de l’équipe" className="team-glass mx-auto hidden w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-full px-3 py-2 backdrop-blur-[18px] xl:flex">
          <Link to="/admin" className="mr-1 flex items-center gap-2 rounded-full px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo inverse className="h-[22px] w-auto" />
          </Link>
          <span className="mr-2 rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Équipe</span>
          {items.map(({ to, label, exact }) => {
            const active = isActive(to, exact);
            return <Link key={to} to={to} aria-current={active ? "page" : undefined} className={`${pill} ${active ? "bg-primary font-medium text-primary-foreground" : "hover:bg-primary/10"}`}>{label}{to === "/admin/parrainages" && pendingReferrals > 0 && <span className={active ? "inline-flex min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1.5 text-[11px] font-semibold text-primary" : badge}>{pendingReferrals}</span>}{to === "/admin/demandes" && newRequests > 0 && <span className={badge} aria-label={`${newRequests} nouvelle${newRequests > 1 ? "s" : ""}`}>{newRequests}</span>}</Link>;
          })}
          <Link to="/admin/demandes/nouvelle" className={`${pill} bg-primary font-medium text-primary-foreground hover:bg-primary/90`}><Plus className="size-4" />Demande</Link>
          {/* Initiales du compte connecté : simple repère, l'équipe n'a pas d'espace membre. */}
          <span title={profile?.full_name ? `Connecté : ${profile.full_name}` : undefined} aria-label={profile?.full_name ? `Connecté : ${profile.full_name}` : undefined} className="inline-flex"><Avatar url={myPhoto} name={profile?.full_name ?? ""} className="size-11 bg-primary text-[13px] font-semibold text-primary-foreground" /></span>
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

/** Chargement en échec dans l'espace équipe : message et nouvel essai, jamais une liste vide trompeuse. */
export function TeamLoadError({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" className="team-panel rounded-[28px] p-6 text-[14px] text-muted-foreground">
    <p>Le chargement n’a pas abouti. Vérifiez votre connexion.</p>
    <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}>Réessayer</Button>
  </div>;
}
