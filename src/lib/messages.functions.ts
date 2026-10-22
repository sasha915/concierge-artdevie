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

// ---- Lot 5.2 : documents visibles par le membre ----

/** Lien signé (cinq minutes) vers un document : la RLS ne laisse lire au membre que les documents visibles de ses demandes. */
export const getMemberFileUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: file } = await context.supabase.from("request_files").select("path, name").eq("id", data.id).maybeSingle();
    if (!file) return { ok: false as const, reason: "Ce document est introuvable." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from("request-files").createSignedUrl(file.path, 300, { download: file.name });
    if (error || !signed) return { ok: false as const, reason: "Le téléchargement n’a pas pu être préparé." };
    return { ok: true as const, url: signed.signedUrl };
  });

// ---- Lot 5.3 : modification, avis ----

const changeKinds = z.enum(["date", "couverts", "precision", "annulation"]);

export const requestChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid(), kind: changeKinds, body: z.string().trim().max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { canRequestChange, changeKindLabel } = await import("./request-actions-rules");
    if (data.kind !== "annulation" && !data.body) return { ok: false as const, reason: "Précisez votre souhait." };
    const { data: request } = await context.supabase
      .from("requests")
      .select("id, user_id, title, category, status")
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!request) return { ok: false as const, reason: "Cette demande est introuvable." };
    if (!canRequestChange(request.status)) return { ok: false as const, reason: "Cette demande ne peut plus être modifiée." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("request_changes").insert({ request_id: request.id, kind: data.kind, body: data.body });
    if (error) return { ok: false as const, reason: error.code === "23505" ? "Une demande de modification est déjà en cours d’examen." : "Votre demande n’a pas pu être envoyée." };
    await supabaseAdmin.from("request_events").insert({ request_id: request.id, actor_id: context.userId, kind: "modification demandée", detail: changeKindLabel(data.kind) });
    try {
      const { notifyConcierge } = await import("./notify-concierge.server");
      await notifyConcierge({ id: request.id, user_id: request.user_id, title: request.title, category: request.category }, `Demande de modification — ${changeKindLabel(data.kind)}${data.body ? ` : ${data.body}` : ""}`);
    } catch (err) {
      console.error("[requestChange] notification équipe impossible", err);
    }
    return { ok: true as const };
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid(), rating: z.enum(["Parfaite", "Bien", "À revoir"]), comment: z.string().trim().max(1000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: request } = await context.supabase
      .from("requests")
      .select("id, status")
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!request) return { ok: false as const, reason: "Cette demande est introuvable." };
    if (request.status !== "Terminée") return { ok: false as const, reason: "Vous pourrez donner votre avis une fois la prestation terminée." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("request_reviews").insert({ request_id: request.id, user_id: context.userId, rating: data.rating, comment: data.comment });
    if (error) return { ok: false as const, reason: error.code === "23505" ? "Vous avez déjà donné votre avis sur cette demande." : "Votre avis n’a pas pu être enregistré." };
    await supabaseAdmin.from("request_events").insert({ request_id: request.id, actor_id: context.userId, kind: "avis reçu", detail: data.rating });
    return { ok: true as const };
  });
