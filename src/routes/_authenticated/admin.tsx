import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { adminGateStatus } from "@/lib/admin-gate.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/connexion" });
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
    const roles = error ? [] : (data ?? []).map((r) => r.role as string);
    const teamRole: "admin" | "concierge" | null = roles.includes("admin") ? "admin" : roles.includes("concierge") ? "concierge" : null;
    if (!teamRole) throw redirect({ to: "/" });
    const gate = await adminGateStatus();
    if (!gate.unlocked) throw redirect({ to: "/admin-connexion" });
    return { teamRole };
  },
  component: () => <Outlet />,
});
