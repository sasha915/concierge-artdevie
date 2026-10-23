import { createFileRoute, Navigate, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/adv-queries";
import { setLang } from "@/lib/i18n";
import { isDelegatePathAllowed } from "@/lib/delegate-rules";
import { useDelegation } from "@/components/art-de-vie/use-delegation";
import { InactiveAccess } from "@/components/art-de-vie/delegate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/connexion" });
    return { user: data.user };
  },
  component: Authenticated,
});

/**
 * Lot 6.5 : l'espace membre suit la langue du profil ; l'interface équipe reste en français.
 * Lot 5.4 : un compte sans profil membre est un proche autorisé ; il n'atteint que l'accueil
 * et ses demandes (les fonctions serveur revérifient l'accès à chaque appel).
 */
function Authenticated() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile, isSuccess } = useQuery(profileQuery);
  const { delegation, pending } = useDelegation();
  const team = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/admin-connexion");
  const lang = team ? "fr" : profile?.language ?? delegation?.language;
  useLayoutEffect(() => {
    if (lang === "fr" || lang === "en") setLang(lang);
  }, [lang]);

  if (isSuccess && profile === null) {
    if (pending) return null;
    if (!delegation) return <InactiveAccess />;
    if (!isDelegatePathAllowed(pathname)) return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
