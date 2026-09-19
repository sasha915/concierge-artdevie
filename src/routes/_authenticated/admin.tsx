import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/connexion" });
    const { data, error } = await supabase.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    if (error || data !== true) throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
