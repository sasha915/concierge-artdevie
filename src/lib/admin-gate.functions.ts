import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { adminSessionConfig, GATE_MAX_ATTEMPTS, GATE_WINDOW_MINUTES, isAdminUnlocked, type AdminGateSession } from "./admin-gate.server";

/** Verrou ouvert pour ce compte (le jeton est joint par la middleware globale ; la route équipe est rendue côté client). */
export const adminGateStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { unlocked: await isAdminUnlocked(context.userId) };
  });

/**
 * Ouverture de l'espace équipe : identifiant et mot de passe personnels du compte connecté
 * (administrateur ou concierge), vérifiés auprès de Supabase ; cinq essais par quart d'heure
 * et par compte. La session ouverte est liée à ce compte et se referme après deux heures.
 */
export const unlockAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ email: z.string().trim().email().max(160), password: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
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

    const matches = await credentialsMatch(data.email, data.password, context.userId);
    await supabaseAdmin.from("admin_gate_attempts").insert({ user_id: context.userId, succeeded: matches });
    if (!matches) return { ok: false as const, reason: "invalid" as const };
    const session = await useSession<AdminGateSession>(adminSessionConfig());
    await session.update({ adminUnlocked: true, userId: context.userId });
    return { ok: true as const };
  });

/** Vérifie l'identifiant et le mot de passe sans toucher à la session du navigateur ; ils doivent être ceux du compte connecté. */
async function credentialsMatch(email: string, password: string, userId: string): Promise<boolean> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    console.warn("accès équipe refusé : SUPABASE_URL ou SUPABASE_PUBLISHABLE_KEY manquant");
    return false;
  }
  const probe = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await probe.auth.signInWithPassword({ email: email.toLowerCase(), password });
  if (error || !data.user) return false;
  // La session ouverte pour la vérification est aussitôt refermée ; celle du navigateur reste intacte.
  await probe.auth.signOut({ scope: "local" }).catch(() => undefined);
  return data.user.id === userId;
}

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminGateSession>(adminSessionConfig());
  await session.clear();
  return { ok: true as const };
});
