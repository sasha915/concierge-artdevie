import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(80),
  email: z.string().trim().email("Adresse email invalide").max(160),
  message: z.string().trim().max(500).optional(),
});

/** Recommandations encore ouvertes par membre, au-delà desquelles une nouvelle est refusée. */
const MAX_OPEN_REFERRALS = 5;

/**
 * Parrainage : le membre recommande une personne à notre équipe.
 * Aucun compte n'est créé ici (analyse du 23 octobre) : l'équipe prend contact,
 * puis ouvre l'adhésion depuis l'interface équipe et relie le parrainage au nouveau membre.
 */
export const sendReferralInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("id, email, disabled_at").eq("id", userId).maybeSingle();
    if (!me || me.disabled_at) return { ok: false as const, reason: "Cette fonction est réservée aux membres." };
    const { data: team } = await supabase.rpc("is_team", { _user_id: userId });
    if (team === true) return { ok: false as const, reason: "Cette fonction est réservée aux membres." };

    const email = data.email.toLowerCase();
    if (email === (me.email ?? "").toLowerCase()) return { ok: false as const, reason: "Indiquez l’adresse de la personne que vous recommandez." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: open }, { data: already }] = await Promise.all([
      supabaseAdmin.from("referrals").select("id").eq("inviter_id", userId).neq("status", "Converti"),
      supabaseAdmin.from("referrals").select("id").eq("inviter_id", userId).eq("email", email).limit(1),
    ]);
    if ((open ?? []).length >= MAX_OPEN_REFERRALS) return { ok: false as const, reason: "Vous avez déjà plusieurs recommandations en cours. Notre équipe y répond avant d’en recevoir de nouvelles." };
    if ((already ?? []).length > 0) return { ok: false as const, reason: "Vous avez déjà recommandé cette personne." };
    // Discrétion : la réponse est la même que la personne soit déjà cliente ou non ; l'équipe le voit, pas le membre.

    // Écrit avec la session du membre : la règle de la base (is_member) s'applique.
    const { error } = await supabase.from("referrals").insert({
      inviter_id: userId,
      full_name: data.fullName,
      email,
      message: data.message ?? null,
    });
    if (error) return { ok: false as const, reason: "Votre recommandation n’a pas pu être transmise. Réessayez dans un instant." };
    return { ok: true as const };
  });
