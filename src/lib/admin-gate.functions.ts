import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminSessionConfig, GATE_MAX_ATTEMPTS, GATE_WINDOW_MINUTES, isAdminUnlocked, type AdminGateSession } from "./admin-gate.server";

/** Verrou ouvert pour ce compte (le jeton est joint par la middleware globale ; la route équipe est rendue côté client). */
export const adminGateStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { unlocked: await isAdminUnlocked(context.userId) };
  });

/**
 * Ouverture de l'espace équipe : uniquement après une connexion Google récente avec l'adresse @artdevie.co
 * du compte (Google Workspace), pour un administrateur ou un concierge. Une session ouverte par mot de passe
 * est refusée. La session d'équipe est liée au compte et se referme après deux heures.
 */
export const unlockAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { teamSessionIssue } = await import("./team-auth-rules");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - GATE_WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("admin_gate_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("succeeded", false)
      .gte("created_at", since);
    if ((count ?? 0) >= GATE_MAX_ATTEMPTS) return { ok: false as const, reason: "locked" as const };

    const issue = teamSessionIssue(context.claims as { email?: unknown; amr?: unknown });
    const { data: team } = issue ? { data: null } : await context.supabase.rpc("is_team", { _user_id: context.userId });
    const refusal = issue ?? (team !== true ? ("hors_equipe" as const) : null);
    // Chaque refus compte (cinq par quart d'heure) ; une session simplement trop ancienne n'est pas une tentative suspecte.
    if (refusal && refusal !== "connexion_ancienne" && refusal !== "connexion_google_requise") {
      await supabaseAdmin.from("admin_gate_attempts").insert({ user_id: context.userId, succeeded: false });
    }
    if (refusal) return { ok: false as const, reason: refusal };
    await supabaseAdmin.from("admin_gate_attempts").insert({ user_id: context.userId, succeeded: true });

    const session = await useSession<AdminGateSession>(adminSessionConfig());
    await session.update({ adminUnlocked: true, userId: context.userId });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminGateSession>(adminSessionConfig());
  await session.clear();
  return { ok: true as const };
});
