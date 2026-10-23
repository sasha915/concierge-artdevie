import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REQUEST_IMAGE } from "@/lib/request-images";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { translate } from "@/lib/i18n";
import { canInviteDelegate } from "@/lib/delegate-rules";

/**
 * Lot 5.4 : proches autorisés.
 * Côté membre : inviter un proche, lui retirer l'accès.
 * Côté proche : toutes ses lectures et écritures passent ici, jamais par les tables :
 * la délégation est revérifiée à chaque appel et seuls les champs utiles sont renvoyés
 * (ni montant, ni facture, ni proposition, ni préférence du membre).
 */

type Ctx = { supabase: any; userId: string };

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function requireDelegation(context: Ctx) {
  const admin = await adminClient();
  const { delegationOf } = await import("./delegates.server");
  const delegation = await delegationOf(admin, context.userId);
  return { admin, delegation };
}

// ---------- Membre ----------

export const inviteDelegate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(160),
    relation: z.string().trim().max(60).optional().or(z.literal("")),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: me } = await ctx.supabase.from("profiles").select("id, email, disabled_at").eq("id", ctx.userId).maybeSingle();
    if (!me || me.disabled_at) return { ok: false as const, reason: "Cette fonction est réservée aux membres." };
    const { data: team } = await ctx.supabase.rpc("is_team", { _user_id: ctx.userId });
    if (team === true) return { ok: false as const, reason: "Cette fonction est réservée aux membres." };

    const email = data.email.toLowerCase();
    if (email === (me.email ?? "").toLowerCase()) return { ok: false as const, reason: "Indiquez l’adresse de votre proche, et non la vôtre." };

    const admin = await adminClient();
    const { data: mine } = await admin.from("member_delegates").select("status").eq("member_id", ctx.userId);
    if (!canInviteDelegate(mine ?? [])) return { ok: false as const, reason: "Vous avez déjà trois proches autorisés. Retirez un accès pour en inviter un autre." };

    // Discrétion : aucune réponse ne révèle si l'adresse appartient déjà à un client.
    // Une adresse de membre ou d'équipe est écartée par l'équipe à la confirmation (approveDelegate).

    const { error } = await admin.from("member_delegates").insert({
      member_id: ctx.userId,
      full_name: data.fullName,
      email,
      relation: data.relation || null,
    });
    if (error) {
      // Adresse déjà invitée ailleurs : même réponse qu'une invitation enregistrée, rien n'est révélé.
      if (error.code === "23505") return { ok: true as const };
      return { ok: false as const, reason: "L’invitation n’a pas pu être enregistrée." };
    }
    return { ok: true as const };
  });

export const revokeMyDelegate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const admin = await adminClient();
    const { data: row } = await admin.from("member_delegates").select("id, status, delegate_id").eq("id", data.id).eq("member_id", ctx.userId).maybeSingle();
    if (!row) return { ok: false as const, reason: "Ce proche est introuvable." };
    const { revokeDelegation } = await import("./delegates.server");
    return revokeDelegation(admin, row, ctx.userId);
  });

// ---------- Proche ----------

export type DelegationInfo = { delegateName: string; memberName: string; language: "fr" | "en" };

export const getMyDelegation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DelegationInfo | null> => {
    const { delegation } = await requireDelegation(context as Ctx);
    if (!delegation) return null;
    return { delegateName: delegation.fullName, memberName: delegation.memberName, language: delegation.language };
  });

const delegateRequestCols = "id, category, status, title, description, scheduled_date, scheduled_time, guests, concierge, image_key, created_at";

export type DelegateRequest = {
  id: string;
  category: string;
  status: string;
  title: string;
  description: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  guests: number | null;
  concierge: string;
  image_key: string;
  created_at: string;
};

export const listDelegateRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DelegateRequest[]> => {
    const { admin, delegation } = await requireDelegation(context as Ctx);
    if (!delegation) return [];
    const { data, error } = await admin
      .from("requests")
      .select(delegateRequestCols)
      .eq("delegate_record", delegation.id)
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error("Les demandes n’ont pas pu être chargées.");
    return (data ?? []) as DelegateRequest[];
  });

export type DelegateMessage = { id: string; from: "moi" | "membre" | "équipe"; body: string; created_at: string };
export type DelegateFile = { id: string; name: string; mime: string; size: number; created_at: string };
export type DelegateThread = { request: DelegateRequest; messages: DelegateMessage[]; files: DelegateFile[]; proposalPending: boolean };

export const getDelegateRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<DelegateThread | null> => {
    const ctx = context as Ctx;
    const { admin, delegation } = await requireDelegation(ctx);
    if (!delegation) return null;
    const { data: request } = await admin.from("requests").select(delegateRequestCols).eq("id", data.requestId).eq("delegate_record", delegation.id).maybeSingle();
    if (!request) return null;
    const [{ data: messages }, { data: files }, { data: proposal }] = await Promise.all([
      admin.from("request_messages").select("id, author_id, author_role, body, created_at").eq("request_id", request.id).order("created_at").order("id"),
      admin.from("request_files").select("id, name, mime, size, created_at").eq("request_id", request.id).eq("visible_to_member", true).order("created_at"),
      admin.from("request_proposals").select("id").eq("request_id", request.id).eq("status", "en attente").limit(1),
    ]);
    return {
      request: request as DelegateRequest,
      messages: (messages ?? []).map((m: { id: string; author_id: string | null; author_role: string; body: string; created_at: string }): DelegateMessage => ({
        id: m.id,
        from: m.author_role === "équipe" ? "équipe" : m.author_id === ctx.userId ? "moi" : "membre",
        body: m.body,
        created_at: m.created_at,
      })),
      files: (files ?? []) as DelegateFile[],
      proposalPending: (proposal ?? []).length > 0,
    };
  });

export const sendDelegateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { admin, delegation } = await requireDelegation(ctx);
    if (!delegation) return { ok: false as const, reason: "Votre accès n’est plus actif." };
    const { data: request } = await admin.from("requests").select("id, user_id, title, category, status").eq("id", data.requestId).eq("delegate_record", delegation.id).maybeSingle();
    if (!request) return { ok: false as const, reason: "Cette demande est introuvable." };
    if (request.status === "Annulée") return { ok: false as const, reason: "Cette demande est annulée." };
    const { error } = await admin.from("request_messages").insert({ request_id: request.id, author_id: ctx.userId, author_role: "membre", body: data.body });
    if (error) return { ok: false as const, reason: "Votre message n’a pas pu être envoyé." };
    await admin.from("request_events").insert({ request_id: request.id, actor_id: ctx.userId, kind: "message du membre", detail: `Écrit par ${delegation.fullName}, proche du membre` });
    try {
      const { notifyConcierge } = await import("./notify-concierge.server");
      await notifyConcierge({ id: request.id, user_id: request.user_id, title: request.title, category: request.category }, `(${delegation.fullName}, proche) ${data.body}`);
    } catch (err) {
      console.error("[sendDelegateMessage] notification équipe impossible", err);
    }
    return { ok: true as const };
  });

export const getDelegateFileUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, delegation } = await requireDelegation(context as Ctx);
    if (!delegation) return { ok: false as const, reason: "Votre accès n’est plus actif." };
    const { data: file } = await admin.from("request_files").select("path, name, request_id, visible_to_member").eq("id", data.id).maybeSingle();
    if (!file || !file.visible_to_member) return { ok: false as const, reason: "Ce document est introuvable." };
    const { data: request } = await admin.from("requests").select("id").eq("id", file.request_id).eq("delegate_record", delegation.id).maybeSingle();
    if (!request) return { ok: false as const, reason: "Ce document est introuvable." };
    const { data: signed, error } = await admin.storage.from("request-files").createSignedUrl(file.path, 300, { download: file.name });
    if (error || !signed) return { ok: false as const, reason: "Le téléchargement n’a pas pu être préparé." };
    return { ok: true as const, url: signed.signedUrl as string };
  });


export const createDelegateRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    category: z.enum(["Tables", "Séjours", "Transferts", "Soins", "Sur mesure"]),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    guests: z.number().int().min(1).max(999).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { admin, delegation } = await requireDelegation(ctx);
    if (!delegation) return { ok: false as const, reason: "Votre accès n’est plus actif." };
    const { data: row, error } = await admin.from("requests").insert({
      user_id: delegation.memberId,
      delegate_record: delegation.id,
      category: data.category,
      status: "Nouvelle",
      concierge: "À attribuer",
      title: data.title,
      description: data.description || "",
      scheduled_date: data.scheduledDate || null,
      scheduled_time: data.scheduledTime || null,
      guests: data.guests ?? null,
      image_key: REQUEST_IMAGE[data.category] ?? "entree-de-nuit",
    }).select("id, title").single();
    if (error || !row) return { ok: false as const, reason: "L’envoi a échoué. Réessayez dans un instant." };
    await admin.from("request_events").insert({ request_id: row.id, actor_id: ctx.userId, kind: "reçue", detail: `Demandée par ${delegation.fullName}, proche du membre` });

    // Le membre est prévenu de chaque demande faite en son nom.
    try {
      const { data: member } = await admin.from("profiles").select("notify_requests, language").eq("id", delegation.memberId).maybeSingle();
      if (member?.notify_requests) {
        const lang = member.language === "en" ? "en" : "fr";
        await admin.from("member_notifications").insert({
          user_id: delegation.memberId,
          request_id: row.id,
          kind: "proche",
          body: translate(lang, "{name} a fait une demande en votre nom : « {title} ».", { name: delegation.fullName, title: row.title }),
        });
      }
    } catch (err) {
      console.error("[createDelegateRequest] notification du membre impossible", err);
    }
    return { ok: true as const, id: row.id as string };
  });
