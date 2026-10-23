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

// ---- Annulation par le membre (analyse du 23 octobre) ----

/**
 * Une demande encore « Nouvelle » (rien d'engagé) est annulée aussitôt.
 * Une demande prise en charge ou confirmée fait l'objet d'une demande d'annulation :
 * notre équipe l'accepte (la demande passe alors en « Annulée ») ou revient vers le membre.
 */
export const cancelMyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid(), body: z.string().trim().max(2000).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { canRequestChange } = await import("./request-actions-rules");
    const { data: request } = await context.supabase
      .from("requests")
      .select("id, user_id, title, category, status")
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!request) return { ok: false as const, reason: "Cette demande est introuvable." };
    if (!canRequestChange(request.status)) return { ok: false as const, reason: "Cette demande ne peut plus être annulée." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const notify = async (text: string) => {
      try {
        const { notifyConcierge } = await import("./notify-concierge.server");
        await notifyConcierge({ id: request.id, user_id: request.user_id, title: request.title, category: request.category }, text);
      } catch (err) {
        console.error("[cancelMyRequest] notification équipe impossible", err);
      }
    };

    if (request.status === "Nouvelle") {
      const { data: row, error } = await supabaseAdmin.from("requests").update({ status: "Annulée" }).eq("id", request.id).eq("status", "Nouvelle").select("id").maybeSingle();
      if (!error && row) {
        await supabaseAdmin.from("request_events").insert({ request_id: request.id, actor_id: context.userId, kind: "statut changé", detail: "Nouvelle → Annulée (par le membre)" });
        await notify("Demande annulée par le membre.");
        return { ok: true as const, mode: "annulée" as const };
      }
      // Prise en charge entre-temps : on bascule sur une demande d'annulation.
    }
    const { error } = await supabaseAdmin.from("request_changes").insert({ request_id: request.id, kind: "annulation", body: data.body ?? "" });
    if (error) return { ok: false as const, reason: error.code === "23505" ? "Une demande de modification est déjà en cours d’examen." : "Votre demande n’a pas pu être envoyée." };
    await supabaseAdmin.from("request_events").insert({ request_id: request.id, actor_id: context.userId, kind: "modification demandée", detail: "Annuler la demande" });
    await notify(`Demande d’annulation${data.body ? ` : ${data.body}` : ""}`);
    return { ok: true as const, mode: "demandée" as const };
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

// ---- Lot 6.1 : réponse du membre à une proposition ----

/** optionId null : « Aucune ne me convient ». Le choix préremplit le montant de la demande s'il n'est pas encore facturé. */
export const answerProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ proposalId: z.string().uuid(), optionId: z.string().uuid().nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    // RLS : le membre ne lit que les propositions de ses propres demandes.
    const { data: proposal } = await context.supabase.from("request_proposals").select("id, request_id, status").eq("id", data.proposalId).maybeSingle();
    if (!proposal) return { ok: false as const, reason: "Cette proposition est introuvable." };
    if (proposal.status !== "en attente") return { ok: false as const, reason: "Vous avez déjà répondu à cette proposition." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isOpenStatus } = await import("./team-request-rules");
    const { data: parent } = await supabaseAdmin.from("requests").select("status").eq("id", proposal.request_id).maybeSingle();
    if (!parent || !isOpenStatus(parent.status)) return { ok: false as const, reason: "Cette demande est close : la proposition n’est plus valable." };
    let option: { id: string; label: string; estimate_cents: number | null } | null = null;
    if (data.optionId) {
      const { data: o } = await supabaseAdmin.from("request_proposal_options").select("id, label, estimate_cents").eq("id", data.optionId).eq("proposal_id", proposal.id).maybeSingle();
      if (!o) return { ok: false as const, reason: "Cette option est introuvable." };
      option = o;
    }
    const { data: updated } = await supabaseAdmin.from("request_proposals").update({ status: option ? "acceptée" : "déclinée", decided_at: new Date().toISOString() }).eq("id", proposal.id).eq("status", "en attente").select("id").maybeSingle();
    if (!updated) return { ok: false as const, reason: "Vous avez déjà répondu à cette proposition." };
    if (option) {
      const { error: chosenError } = await supabaseAdmin.from("request_proposal_options").update({ chosen: true }).eq("id", option.id);
      if (chosenError) {
        // L'option n'a pas pu être retenue : la proposition revient en attente, le membre peut répondre de nouveau.
        await supabaseAdmin.from("request_proposals").update({ status: "en attente", decided_at: null }).eq("id", proposal.id);
        return { ok: false as const, reason: "Votre choix n’a pas pu être enregistré. Réessayez dans un instant." };
      }
      if (option.estimate_cents !== null) {
        const { data: invoice } = await supabaseAdmin.from("invoices").select("id").eq("request_id", proposal.request_id).maybeSingle();
        if (!invoice) {
          const { error: amountError } = await supabaseAdmin.from("requests").update({ amount_cents: option.estimate_cents }).eq("id", proposal.request_id);
          if (amountError) console.error("[answerProposal] montant non reporté", amountError.message);
        }
      }
    }
    await supabaseAdmin.from("request_events").insert({ request_id: proposal.request_id, actor_id: context.userId, kind: option ? "proposition acceptée" : "proposition déclinée", detail: option?.label ?? null });
    try {
      const { data: request } = await supabaseAdmin.from("requests").select("id, user_id, title, category").eq("id", proposal.request_id).maybeSingle();
      if (request) {
        const { notifyConcierge } = await import("./notify-concierge.server");
        await notifyConcierge(request, option ? `Option choisie : ${option.label}` : "Aucune des options proposées ne convient.");
      }
    } catch (err) {
      console.error("[answerProposal] notification équipe impossible", err);
    }
    return { ok: true as const };
  });

// ---- Lot 6.2 : demandes récurrentes ----

export const createRecurringFromRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    requestId: z.string().uuid(),
    recurrence: z.object({
      rhythm: z.enum(["hebdomadaire", "mensuelle", "dates"]),
      dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    }),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: request } = await context.supabase
      .from("requests")
      .select("id, user_id, category, title, description, guests, scheduled_date, scheduled_time, image_key, recurring_id, status")
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!request) return { ok: false as const, reason: "Cette demande est introuvable." };
    if (request.recurring_id) return { ok: false as const, reason: "Cette demande appartient déjà à une série." };
    const { isOpenStatus } = await import("./team-request-rules");
    if (!isOpenStatus(request.status)) return { ok: false as const, reason: "Une demande close ne peut pas servir de modèle à une série." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createRecurringRule } = await import("./recurring.server");
    return createRecurringRule(supabaseAdmin, request, data.recurrence, context.userId);
  });

/** Fin d'une série : plus aucune échéance après aujourd'hui ; les demandes déjà créées restent suivies normalement. */
export const endRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rule } = await context.supabase.from("recurring_requests").select("id").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!rule) return { ok: false as const, reason: "Cette série est introuvable." };
    const { todayParis } = await import("./billing-webhook-rules");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("recurring_requests").update({ end_date: todayParis(), paused: false }).eq("id", rule.id);
    if (error) return { ok: false as const, reason: "Le changement n’a pas pu être enregistré." };
    return { ok: true as const };
  });

export const setRecurringPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), paused: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rule } = await context.supabase.from("recurring_requests").select("id").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!rule) return { ok: false as const, reason: "Cette série est introuvable." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("recurring_requests").update({ paused: data.paused }).eq("id", rule.id);
    if (error) return { ok: false as const, reason: "Le changement n’a pas pu être enregistré." };
    return { ok: true as const };
  });

// ---- Lot 6.4 : questionnaire d'accueil ----

const choiceList = z.array(z.string().max(80)).max(20);

/** Réponses du membre au questionnaire, et s'il l'a déjà terminé. Les notes de l'équipe ne sont jamais renvoyées. */
export const getMyWelcome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      context.supabase.from("profiles").select("onboarded_at").eq("id", context.userId).maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    const isTeam = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "concierge");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prefs } = await supabaseAdmin
      .from("member_preferences")
      .select("tables_choix, sejours_choix, transferts_choix, dates_membre")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      onboarded: !!profile?.onboarded_at,
      isTeam,
      answers: {
        tables_choix: (prefs?.tables_choix ?? []) as string[],
        sejours_choix: (prefs?.sejours_choix ?? []) as string[],
        transferts_choix: (prefs?.transferts_choix ?? []) as string[],
        dates_membre: (prefs?.dates_membre ?? "") as string,
      },
    };
  });

/** Enregistre les réponses ; complete marque le questionnaire comme terminé (il ne se présente plus à la connexion). */
export const saveMyWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    tables_choix: choiceList,
    sejours_choix: choiceList,
    transferts_choix: choiceList,
    dates_membre: z.string().max(2000),
    complete: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { cleanChoices } = await import("./member-rules");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("member_preferences").upsert({
      user_id: context.userId,
      tables_choix: cleanChoices("tables_choix", data.tables_choix),
      sejours_choix: cleanChoices("sejours_choix", data.sejours_choix),
      transferts_choix: cleanChoices("transferts_choix", data.transferts_choix),
      dates_membre: data.dates_membre.trim(),
      member_updated_at: now,
    }, { onConflict: "user_id" });
    if (error) return { ok: false as const, reason: "Vos réponses n’ont pas pu être enregistrées." };
    if (data.complete) {
      await supabaseAdmin.from("profiles").update({ onboarded_at: now }).eq("id", context.userId).is("onboarded_at", null);
    }
    return { ok: true as const };
  });
