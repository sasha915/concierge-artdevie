import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/adv-queries";
import { setLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/connexion" });
    return { user: data.user };
  },
  component: Authenticated,
});

/** Lot 6.5 : l'espace membre suit la langue du profil ; l'interface équipe reste en français. */
function Authenticated() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useQuery(profileQuery);
  const team = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/admin-connexion");
  const lang = team ? "fr" : profile?.language;
  useLayoutEffect(() => {
    if (lang === "fr" || lang === "en") setLang(lang);
  }, [lang]);
  return <Outlet />;
}
