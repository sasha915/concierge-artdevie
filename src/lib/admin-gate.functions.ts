import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminPasswordMatches, adminSessionConfig, GATE_MAX_ATTEMPTS, GATE_WINDOW_MINUTES, isAdminUnlocked, type AdminGateSession } from "./admin-gate.server";

/** Verrou ouvert pour ce compte (le jeton est joint par la middleware globale ; la route équipe est rendue côté client). */
export const adminGateStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { unlocked: await isAdminUnlocked(context.userId), configured: Boolean(process.env["ADMIN_PASSWORD"]) };
  });

/**
 * Ouverture de l'espace équipe : compte connecté et membre de l'équipe, mot de passe commun,
 * cinq essais par quart d'heure et par compte. La session ouverte est liée à ce compte.
 */
export const unlockAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ password: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const expected = process.env["ADMIN_PASSWORD"];
    if (!expected) {
      console.warn("accès administration refusé : secret ADMIN_PASSWORD manquant");
      return { ok: false as const, reason: "not_configured" as const };
    }
    const { data: team } = await context.supabase.rpc("is_team", { _user_id: context.userId });
    if (team !== true) return { ok: false as const, reason: "invalid" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - GATE_WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("admin_gate_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("succeeded", false)
      .gte("created_at", since);
    if ((count ?? 0) >= GATE_MAX_ATTEMPTS) return { ok: false as const, reason: "locked" as const };

    const matches = adminPasswordMatches(data.password, expected);
    await supabaseAdmin.from("admin_gate_attempts").insert({ user_id: context.userId, succeeded: matches });
    if (!matches) return { ok: false as const, reason: "invalid" as const };
    const session = await useSession<AdminGateSession>(adminSessionConfig());
    await session.update({ adminUnlocked: true, userId: context.userId });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminGateSession>(adminSessionConfig());
  await session.clear();
  return { ok: true as const };
});
