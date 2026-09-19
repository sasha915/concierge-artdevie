import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { adminGateStatus } from "@/lib/admin-gate.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/connexion" });
    const { data, error } = await supabase.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    if (error || data !== true) throw redirect({ to: "/" });
    const gate = await adminGateStatus();
    if (!gate.unlocked) throw redirect({ to: "/admin-connexion" });
  },
  component: () => <Outlet />,
});
