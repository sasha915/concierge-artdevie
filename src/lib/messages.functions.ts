import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Message du membre sur l'une de ses demandes (lot 5.1).
 * La propriété de la demande est vérifiée avec la session du membre (RLS) ;
 * le message est écrit par le serveur, toujours au nom du membre, jamais de l'équipe.
 */
export const sendMemberMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: request } = await context.supabase
      .from("requests")
      .select("id, user_id, title, category, status")
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!request) return { ok: false as const, reason: "Cette demande est introuvable." };
    if (request.status === "Annulée") return { ok: false as const, reason: "Cette demande est annulée." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("request_messages")
      .insert({ request_id: request.id, author_id: context.userId, author_role: "membre", body: data.body });
    if (error) return { ok: false as const, reason: "Votre message n’a pas pu être envoyé." };
    await supabaseAdmin.from("request_events").insert({ request_id: request.id, actor_id: context.userId, kind: "message du membre", detail: null });

    // Prévient la conciergerie par le canal existant ; un échec n'empêche jamais l'envoi du message.
    try {
      const { notifyConcierge } = await import("./notify-concierge.server");
      await notifyConcierge({ id: request.id, user_id: request.user_id, title: request.title, category: request.category }, data.body);
    } catch (err) {
      console.error("[sendMemberMessage] notification équipe impossible", err);
    }
    return { ok: true as const };
  });
