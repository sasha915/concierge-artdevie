import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { mollie, mollieKey, statusLabel, type MolliePayment } from "./mollie.server";
import { translate } from "@/lib/i18n";

type Ctx = { supabase: any; userId: string };

export type TeamRole = "admin" | "concierge";

/** Rôle d'équipe de l'appelant, vérifié avec sa propre session (RLS : il lit ses propres rôles). */
async function teamRoleOf(context: Ctx): Promise<TeamRole | null> {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error) return null;
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  return roles.includes("admin") ? "admin" : roles.includes("concierge") ? "concierge" : null;
}

async function unlockedAdminClient() {
  const { requireAdminUnlocked } = await import("./admin-gate.server");
  await requireAdminUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Administrateur ou concierge, session d'équipe déverrouillée. */
async function assertTeam(context: Ctx) {
  const role = await teamRoleOf(context);
  if (!role) throw new Error("Forbidden");
  return { admin: await unlockedAdminClient(), role };
}

/** Administrateur seul, session d'équipe déverrouillée. */
async function assertAdmin(context: Ctx) {
  const role = await teamRoleOf(context);
  if (role !== "admin") throw new Error("Forbidden");
  return unlockedAdminClient();
}

async function teamIds(admin: any): Promise<string[]> {
  const { data } = await admin.from("user_roles").select("user_id").in("role", ["admin", "concierge"]);
  return [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))] as string[];
}

function originOf(): string {
  return getRequest().headers.get("origin") ?? "";
}

const memberFields = {
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  plan: z.enum(["Essentiel", "Signature"]),
  roleLabel: z.string().trim().max(60).optional().or(z.literal("")),
  conciergeReferent: z.string().trim().max(60).optional().or(z.literal("")),
  conciergeWhatsapp: z.string().trim().max(30).optional().or(z.literal("")),
};

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const [{ data: profiles }, { data: requests }, { data: invoices }] = await Promise.all([
      admin.from("profiles").select("id, full_name, email, phone, plan, role_label, member_number, member_since, valid_until, disabled_at, concierge_referent, concierge_whatsapp").order("member_since", { ascending: false }),
      admin.from("requests").select("user_id"),
      admin.from("invoices").select("user_id"),
    ]);
    const countBy = (rows: { user_id: string }[] | null) =>
      (rows ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.user_id]: (acc[r.user_id] ?? 0) + 1 }), {});
    const rc = countBy(requests as { user_id: string }[] | null);
    const ic = countBy(invoices as { user_id: string }[] | null);
    const team = await teamIds(admin);
    return (profiles ?? []).filter((p: Record<string, unknown>) => !team.includes(p['id'] as string)).map((p: Record<string, unknown>) => ({
      ...p,
      requests_count: rc[p['id'] as string] ?? 0,
      invoices_count: role === "admin" ? ic[p['id'] as string] ?? 0 : 0,
    }));
  });

export const getMemberDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const [{ data: profile }, { data: requests }, { data: invoices }] = await Promise.all([
      admin.from("profiles").select("id, full_name, email, phone, plan, role_label, member_number, member_since, valid_until, disabled_at, concierge_referent, concierge_whatsapp, language").eq("id", data.id).maybeSingle(),
      admin.from("requests").select("id, category, status, title, description, scheduled_date, scheduled_time, concierge, image_key").eq("user_id", data.id).order("created_at", { ascending: false }),
      admin.from("invoices").select("id, number, kind, issued_on, amount_cents, status").eq("user_id", data.id).order("issued_on", { ascending: false }),
    ]);
    return { profile: profile ?? null, requests: requests ?? [], invoices: role === "admin" ? invoices ?? [] : [] };
  });

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ email: z.string().trim().email().max(160), ...memberFields }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const email = data.email.toLowerCase();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { full_name: data.fullName, phone: data.phone || null },
    });
    if (error || !created.user) {
      const already = /already|exist|registered/i.test(error?.message ?? "");
      return { ok: false as const, reason: already ? "Cette adresse correspond déjà à un membre." : "La création du compte a échoué." };
    }
    await admin.from("profiles").update({
      full_name: data.fullName,
      phone: data.phone || null,
      plan: data.plan,
      role_label: data.roleLabel || `Membre ${data.plan}`,
      concierge_referent: data.conciergeReferent || null,
      concierge_whatsapp: data.conciergeWhatsapp || null,
    }).eq("id", created.user.id);
    return { ok: true as const, id: created.user.id };
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), ...memberFields }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { error } = await admin.from("profiles").update({
      full_name: data.fullName,
      phone: data.phone || null,
      plan: data.plan,
      role_label: data.roleLabel || `Membre ${data.plan}`,
      concierge_referent: data.conciergeReferent || null,
      concierge_whatsapp: data.conciergeWhatsapp || null,
    }).eq("id", data.id);
    if (error) return { ok: false as const, reason: "La modification a échoué." };
    return { ok: true as const };
  });

/** Lot 6.5 : langue de l'espace membre, modifiable par toute l'équipe. */
export const setMemberLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), language: z.enum(["fr", "en"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const ids = await teamIds(admin);
    if (ids.includes(data.id)) return { ok: false as const, reason: "Ce compte appartient à l’équipe." };
    const { data: row, error } = await admin.from("profiles").update({ language: data.language }).eq("id", data.id).select("id").maybeSingle();
    if (error || !row) return { ok: false as const, reason: "La langue n’a pas pu être enregistrée." };
    return { ok: true as const };
  });

export const setMemberDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    if (data.id === (context as Ctx).userId) {
      return { ok: false as const, reason: "Vous ne pouvez pas désactiver votre propre compte." };
    }
    const { error } = await admin.auth.admin.updateUserById(data.id, { ban_duration: data.disabled ? "876000h" : "none" });
    if (error) return { ok: false as const, reason: "L’opération a échoué." };
    await admin.from("profiles").update({ disabled_at: data.disabled ? new Date().toISOString() : null }).eq("id", data.id);
    return { ok: true as const };
  });

export const sendMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ email: z.string().trim().email().max(160) }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const origin = originOf();
    const { error } = await admin.auth.resetPasswordForEmail(data.email.toLowerCase(), origin ? { redirectTo: `${origin}/reset-password` } : {});
    if (error) return { ok: false as const, reason: "L’email n’a pas pu être envoyé." };
    return { ok: true as const };
  });

export type AdminPayment = {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  currency: string;
  status: string;
  method: string | null;
  recurring: boolean;
};

export const listMemberPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { data: profile } = await admin
      .from("profiles")
      .select("mollie_customer_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!mollieKey()) return { configured: false as const, payments: [] as AdminPayment[] };
    if (!profile?.mollie_customer_id) return { configured: true as const, payments: [] as AdminPayment[] };
    const res = await mollie<{ _embedded?: { payments?: MolliePayment[] } }>(
      `/customers/${profile.mollie_customer_id}/payments?limit=50`,
    );
    const payments: AdminPayment[] = (res._embedded?.payments ?? []).map((p) => ({
      id: p.id,
      date: (p.createdAt ?? "").slice(0, 10),
      description: p.description ?? "Paiement",
      amountCents: Math.round(parseFloat(p.amount.value) * 100),
      currency: p.amount.currency,
      status: statusLabel[p.status] ?? p.status,
      method: p.method ?? null,
      recurring: !!p.subscriptionId,
    }));
    return { configured: true as const, payments };
  });

// ---- Lot 1.1 : demandes (équipe) ----

const requestStatus = z.enum(["Nouvelle", "En cours", "Confirmée", "Terminée", "Annulée"]);
const requestCols = "id, user_id, category, status, title, description, scheduled_date, scheduled_time, guests, concierge, concierge_id, image_key, created_at, team_reply, team_reply_at, amount_cents";

export const listAllRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const [{ data: requests }, { data: profiles }] = await Promise.all([
      admin.from("requests").select(requestCols).order("created_at", { ascending: false }),
      admin.from("profiles").select("id, full_name, email, plan"),
    ]);
    const byId = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]));
    const { data: pending } = await admin.from("request_changes").select("request_id").eq("status", "en attente");
    const pendingIds = new Set((pending ?? []).map((c: { request_id: string }) => c.request_id));
    return (requests ?? []).map((r: { id: string; user_id: string }) => {
      const p = byId.get(r.user_id) as { full_name: string; email: string | null; plan: string } | undefined;
      return { ...r, member_name: p?.full_name ?? "", member_email: p?.email ?? null, member_plan: p?.plan ?? null, pending_change: pendingIds.has(r.id) };
    });
  });

export const getRequestDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const { data: request } = await admin.from("requests").select(requestCols).eq("id", data.id).maybeSingle();
    if (!request) return { request: null, member: null };
    const { data: member } = await admin
      .from("profiles")
      .select("id, full_name, email, phone, plan, role_label, member_number, member_since, valid_until, disabled_at, concierge_referent")
      .eq("id", request.user_id)
      .maybeSingle();
    return { request, member: member ?? null };
  });

// parrain d'un membre (lot 2.2)
export const getMemberParrain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const { data: referral } = await admin
      .from("referrals")
      .select("inviter_id")
      .eq("converted_member_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!referral) return null;
    const { data: inviter } = await admin.from("profiles").select("id, full_name").eq("id", referral.inviter_id).maybeSingle();
    return inviter ? { id: inviter.id as string, full_name: inviter.full_name as string } : null;
  });

export const updateRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), status: requestStatus }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const { data: before, error: readError } = await admin.from("requests").select("status").eq("id", data.id).maybeSingle();
    if (readError || !before) return { ok: false as const, reason: "La demande est introuvable." };
    if (before.status === data.status) return { ok: true as const };
    const { data: row, error } = await admin.from("requests").update({ status: data.status }).eq("id", data.id).eq("status", before.status).select("id").maybeSingle();
    if (error || !row) return { ok: false as const, reason: "Le statut n’a pas pu être modifié. Rechargez la demande." };
    const { error: eventError } = await admin.from("request_events").insert({ request_id: data.id, actor_id: (context as Ctx).userId, kind: "statut changé", detail: `${before.status} → ${data.status}` });
    await notifyMember(admin, data.id, "statut", (title, tr) => statusNotice(title, data.status, tr));
    if (eventError) return { ok: false as const, reason: "Le statut a changé, mais son historique n’a pas pu être enregistré. Rechargez la demande." };
    return { ok: true as const };
  });

export const setRequestConcierge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), conciergeId: z.string().uuid().nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const resolved = await resolveConcierge(admin, data.conciergeId);
    if (!resolved) return { ok: false as const, reason: "Ce compte ne fait pas partie de l’équipe." };
    const { data: row, error } = await admin.from("requests").update(resolved).eq("id", data.id).select("id").maybeSingle();
    if (error || !row) return { ok: false as const, reason: "L’attribution a échoué." };
    const { error: eventError } = await admin.from("request_events").insert({ request_id: data.id, actor_id: (context as Ctx).userId, kind: "attribuée", detail: resolved.concierge_id ? resolved.concierge : null });
    if (eventError) return { ok: false as const, reason: "L’attribution a changé, mais son historique n’a pas pu être enregistré. Rechargez la demande." };
    return { ok: true as const };
  });

export const setRequestReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), reply: z.string().max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const { replyUpdate } = await import("./request-rules");
    const { data: row, error } = await admin.from("requests").update(replyUpdate(data.reply)).eq("id", data.id).select("id").maybeSingle();
    if (error || !row) return { ok: false as const, reason: "La réponse n’a pas pu être enregistrée." };
    const { error: eventError } = await admin.from("request_events").insert({ request_id: data.id, actor_id: (context as Ctx).userId, kind: data.reply.trim() ? "réponse publiée" : "réponse retirée", detail: null });
    if (data.reply.trim()) await notifyMember(admin, data.id, "réponse", (title, tr) => tr("Votre conciergerie a répondu à votre demande « {title} ».", { title }));
    if (eventError) return { ok: false as const, reason: "La réponse a été enregistrée, mais son historique n’a pas pu être enregistré. Rechargez la demande." };
    return { ok: true as const };
  });


const UNASSIGNED = "À attribuer";
async function resolveConcierge(admin: any, id: string | null): Promise<{ concierge: string; concierge_id: string | null } | null> {
  if (!id) return { concierge: UNASSIGNED, concierge_id: null };
  if (!(await teamIds(admin)).includes(id)) return null;
  const { data } = await admin.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return { concierge: (data?.full_name as string | undefined)?.trim() || "Équipe", concierge_id: id };
}

export const listTeamNames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const { data: roles } = await admin.from("user_roles").select("user_id, role").in("role", ["admin", "concierge"]);
    const rows = (roles ?? []) as Array<{ user_id: string; role: TeamRole }>;
    if (!rows.length) return [] as Array<{ id: string; name: string; role: TeamRole }>;
    const { data } = await admin.from("profiles").select("id, full_name").in("id", rows.map((r) => r.user_id));
    const names = new Map((data ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name.trim()]));
    const byId = new Map<string, TeamRole>();
    for (const r of rows) if (byId.get(r.user_id) !== "admin") byId.set(r.user_id, r.role);
    return [...byId].map(([id, r]) => ({ id, name: (names.get(id) as string) || "Équipe", role: r })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const today = new Date().toISOString().slice(0, 10);
    const ids = await teamIds(admin);
    const [{ data: requests }, { data: profiles }] = await Promise.all([
      admin.from("requests").select("id, user_id, title, category, status, concierge, scheduled_date, scheduled_time, created_at").order("created_at", { ascending: true }),
      admin.from("profiles").select("id, full_name, disabled_at"),
    ]);
    const rows = (requests ?? []) as Array<{ id: string; user_id: string; title: string; category: string; status: string; concierge: string; scheduled_date: string | null; scheduled_time: string | null; created_at: string }>;
    const names = new Map((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
    const withName = (r: (typeof rows)[number]) => ({ ...r, member_name: names.get(r.user_id) ?? "" });
    const open = rows.filter((r) => ["Nouvelle", "En cours", "Confirmée"].includes(r.status));
    const last = rows[rows.length - 1];
    const watch = await dashboardWatch(admin, role, rows.map(withName), ids, names);
    return {
      watch,
      openCount: open.length,
      unassignedCount: open.filter((r) => r.concierge === "À attribuer").length,
      activeMembers: (profiles ?? []).filter((p: { id: string; disabled_at: string | null }) => !p.disabled_at && !ids.includes(p.id)).length,
      lastRequest: last ? { id: last.id, title: last.title, created_at: last.created_at } : null,
      toProcess: rows.filter((r) => r.status === "Nouvelle").map(withName),
      upcoming: rows
        .filter((r) => (r.status === "En cours" || r.status === "Confirmée") && r.scheduled_date && r.scheduled_date >= today)
        .sort((a, b) => `${a.scheduled_date}${a.scheduled_time ?? ""}`.localeCompare(`${b.scheduled_date}${b.scheduled_time ?? ""}`))
        .slice(0, 5)
        .map(withName),
    };
  });

// ---- Lot 2.1 : demande au nom d'un membre, notes internes ----

const REQUEST_IMAGE: Record<string, string> = { Tables: "entree-de-nuit", "Séjours": "village-cotier", Transferts: "place-vendome", Soins: "bassin", "Sur mesure": "sur-mesure" };

export const createRequestForMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    memberId: z.string().uuid(),
    category: z.enum(["Tables", "Séjours", "Transferts", "Soins", "Sur mesure"]),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    guests: z.number().int().min(1).max(999).nullable().optional(),
    conciergeId: z.string().uuid().nullable(),
    recurrence: z.object({ rhythm: z.enum(["hebdomadaire", "mensuelle", "dates"]), dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const ids = await teamIds(admin);
    if (ids.includes(data.memberId)) return { ok: false as const, reason: "Ce compte appartient à l’équipe." };
    const { data: member } = await admin.from("profiles").select("id, disabled_at").eq("id", data.memberId).maybeSingle();
    if (!member) return { ok: false as const, reason: "Membre introuvable." };
    const resolved = await resolveConcierge(admin, data.conciergeId);
    if (!resolved) return { ok: false as const, reason: "Ce compte ne fait pas partie de l’équipe." };
    if (data.recurrence && !data.scheduledDate) return { ok: false as const, reason: "Indiquez la date de la première échéance pour une demande récurrente." };
    const { data: row, error } = await admin.from("requests").insert({
      user_id: data.memberId,
      category: data.category,
      status: "Nouvelle",
      title: data.title,
      description: data.description || "",
      scheduled_date: data.scheduledDate || null,
      scheduled_time: data.scheduledTime || null,
      guests: data.guests ?? null,
      ...resolved,
      image_key: REQUEST_IMAGE[data.category] ?? "entree-de-nuit",
    }).select("id").single();
    if (error || !row) return { ok: false as const, reason: "La demande n’a pas pu être créée." };
    const { error: eventError } = await admin.from("request_events").insert({ request_id: row.id, actor_id: context.userId, kind: "créée par l'équipe", detail: null });
    if (eventError) return { ok: false as const, reason: "La demande a été créée, mais son historique n’a pas pu être enregistré. Ne la recréez pas." };
    if (data.recurrence) {
      const { createRecurringRule } = await import("./recurring.server");
      const rec = await createRecurringRule(admin, { id: row.id, user_id: data.memberId, category: data.category, title: data.title, description: data.description || "", guests: data.guests ?? null, scheduled_date: data.scheduledDate || null, scheduled_time: data.scheduledTime || null, image_key: REQUEST_IMAGE[data.category] ?? "entree-de-nuit" }, data.recurrence, context.userId);
      if (!rec.ok) return { ok: false as const, reason: `La demande a été créée, mais pas sa récurrence : ${rec.reason}` };
    }
    return { ok: true as const, id: row.id as string };
  });

export const listRequestEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const [{ data: request, error: requestError }, { data: events, error }] = await Promise.all([
      admin.from("requests").select("user_id").eq("id", data.requestId).maybeSingle(),
      admin.from("request_events").select("id, actor_id, kind, detail, created_at").eq("request_id", data.requestId).order("created_at").order("id"),
    ]);
    if (error || requestError) throw new Error("L’historique n’a pas pu être chargé.");
    if (!request) return [];
    const ids = [...new Set((events ?? []).flatMap((e) => e.actor_id && e.actor_id !== request.user_id ? [e.actor_id] : []))];
    const { data: authors, error: authorsError } = ids.length ? await admin.from("profiles").select("id, full_name").in("id", ids) : { data: [], error: null };
    if (authorsError) throw new Error("Les auteurs de l’historique n’ont pas pu être chargés.");
    const names = new Map((authors ?? []).map((p) => [p.id, p.full_name.trim()]));
    return (events ?? []).map((e) => ({ ...e, author_name: e.actor_id === request.user_id ? "Le membre" : (e.actor_id ? names.get(e.actor_id) : null) || "Équipe" }));
  });

const replyTemplateFields = { label: z.string().trim().min(1).max(100), body: z.string().max(4000), sortOrder: z.number().int().min(0).max(100000) };

export const listReplyTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { data, error } = await admin.from("reply_templates").select("id, label, body, sort_order, created_at").order("sort_order").order("created_at").order("id");
    if (error) throw new Error("Les réponses types n’ont pas pu être chargées.");
    return data ?? [];
  });

export const createReplyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object(replyTemplateFields).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { error } = await admin.from("reply_templates").insert({ label: data.label, body: data.body, sort_order: data.sortOrder });
    return error ? { ok: false as const, reason: error.code === "23505" ? "Ce libellé existe déjà." : "La réponse type n’a pas pu être créée." } : { ok: true as const };
  });

export const updateReplyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), ...replyTemplateFields }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { data: row, error } = await admin.from("reply_templates").update({ label: data.label, body: data.body, sort_order: data.sortOrder }).eq("id", data.id).select("id").maybeSingle();
    return error || !row ? { ok: false as const, reason: error?.code === "23505" ? "Ce libellé existe déjà." : "La réponse type n’a pas pu être modifiée." } : { ok: true as const };
  });

export const deleteReplyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { data: row, error } = await admin.from("reply_templates").delete().eq("id", data.id).select("id").maybeSingle();
    return error || !row ? { ok: false as const, reason: "La réponse type n’a pas pu être supprimée." } : { ok: true as const };
  });

export const reorderReplyTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(1000).refine((ids) => new Set(ids).size === ids.length) }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { data: rows, error } = await admin.from("reply_templates").select("id, label, body, created_at");
    if (error || !rows || rows.length !== data.ids.length || rows.some((r) => !data.ids.includes(r.id))) return { ok: false as const, reason: "La liste a changé. Rechargez les réponses types." };
    const { error: saveError } = await admin.from("reply_templates").upsert(rows.map((r) => ({ ...r, sort_order: data.ids.indexOf(r.id) + 1 })), { onConflict: "id" });
    return saveError ? { ok: false as const, reason: "L’ordre n’a pas pu être enregistré." } : { ok: true as const };
  });

export const listRequestNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const { data: notes } = await admin.from("request_notes").select("id, author_id, body, created_at").eq("request_id", data.requestId).order("created_at", { ascending: true });
    const rows = (notes ?? []) as Array<{ id: string; author_id: string; body: string; created_at: string }>;
    const authorIds = [...new Set(rows.map((n) => n.author_id))];
    const { data: authors } = authorIds.length ? await admin.from("profiles").select("id, full_name").in("id", authorIds) : { data: [] };
    const names = new Map((authors ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
    return rows.map((n) => ({ ...n, author_name: names.get(n.author_id) || "Équipe" }));
  });

export const addRequestNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const { error } = await admin.from("request_notes").insert({ request_id: data.requestId, author_id: (context as Ctx).userId, body: data.body });
    if (error) return { ok: false as const, reason: "La note n’a pas pu être ajoutée." };
    return { ok: true as const };
  });

export const listRequestableMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const ids = await teamIds(admin);
    const { data } = await admin.from("profiles").select("id, full_name, email, plan, disabled_at").is("disabled_at", null).order("full_name");
    return ((data ?? []) as Array<{ id: string; full_name: string; email: string | null; plan: string }>)
      .filter((p) => !ids.includes(p.id))
      .map(({ id, full_name, email, plan }) => ({ id, full_name, email, plan }));
  });

// ---- Lot 2.2 : parrainages ----

const referralStatus = z.enum(["Invitation envoyée", "Contacté", "Converti"]);

export const listReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { data: referrals } = await admin
      .from("referrals")
      .select("id, inviter_id, full_name, email, message, status, converted_member_id, created_at")
      .order("created_at", { ascending: false });
    const rows = (referrals ?? []) as Array<{ id: string; inviter_id: string; full_name: string; email: string; message: string | null; status: string; converted_member_id: string | null; created_at: string }>;
    const inviterIds = [...new Set(rows.map((r) => r.inviter_id))];
    const { data: inviters } = inviterIds.length ? await admin.from("profiles").select("id, full_name").in("id", inviterIds) : { data: [] };
    const names = new Map((inviters ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
    return rows.map((r) => ({ ...r, inviter_name: names.get(r.inviter_id) ?? "" }));
  });

export const setReferralStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), status: referralStatus }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { error } = await admin.from("referrals").update({ status: data.status }).eq("id", data.id);
    if (error) return { ok: false as const, reason: "Le statut n’a pas pu être modifié." };
    return { ok: true as const };
  });

export const convertReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ referralId: z.string().uuid(), memberId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    if ((await teamIds(admin)).includes(data.memberId)) return { ok: false as const, reason: "Ce compte appartient à l’équipe." };
    const { error } = await admin.from("referrals").update({ status: "Converti", converted_member_id: data.memberId }).eq("id", data.referralId);
    if (error) return { ok: false as const, reason: "Le parrainage n’a pas pu être mis à jour." };
    return { ok: true as const };
  });

// ---- Lot 3.1 : rôles d'équipe ----

export const getMyTeamRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => teamRoleOf(context as Ctx));

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { data: roles } = await admin.from("user_roles").select("user_id, role, created_at").in("role", ["admin", "concierge"]).order("created_at");
    const rows = (roles ?? []) as Array<{ user_id: string; role: TeamRole; created_at: string }>;
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = ids.length ? await admin.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
    const byId = new Map((profiles ?? []).map((p: { id: string; full_name: string; email: string | null }) => [p.id, p]));
    return ids.map((id) => {
      const own = rows.filter((r) => r.user_id === id);
      const p = byId.get(id) as { full_name: string; email: string | null } | undefined;
      return { id, full_name: p?.full_name ?? "", email: p?.email ?? null, role: (own.some((r) => r.role === "admin") ? "admin" : "concierge") as TeamRole, since: own[0]!.created_at, is_self: id === (context as Ctx).userId };
    });
  });

/** role = null : retirer de l'équipe (le compte redevient un compte membre ordinaire). */
export const setTeamRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "concierge"]).nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    if (data.userId === (context as Ctx).userId) return { ok: false as const, reason: "Vous ne pouvez pas modifier votre propre rôle." };
    const { data: current } = await admin.from("user_roles").select("role").eq("user_id", data.userId).in("role", ["admin", "concierge"]);
    const roles = (current ?? []).map((r: { role: string }) => r.role);
    if (!roles.length) return { ok: false as const, reason: "Ce compte ne fait pas partie de l’équipe." };
    if (roles.includes("admin") && data.role !== "admin") {
      const { count } = await admin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) return { ok: false as const, reason: "Il doit toujours rester au moins un administrateur." };
    }
    if (data.role && !roles.includes(data.role)) {
      const { error } = await admin.from("user_roles").insert({ user_id: data.userId, role: data.role });
      if (error) return { ok: false as const, reason: "Le rôle n’a pas pu être modifié." };
    }
    const remove = (["admin", "concierge"] as const).filter((r) => r !== data.role && roles.includes(r));
    if (remove.length) {
      const { error } = await admin.from("user_roles").delete().eq("user_id", data.userId).in("role", remove);
      if (error) return { ok: false as const, reason: /administrateur/.test(error.message) ? "Il doit toujours rester au moins un administrateur." : "Le rôle n’a pas pu être modifié." };
    }
    return { ok: true as const };
  });

export const inviteColleague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fullName: z.string().trim().min(2).max(80), email: z.string().trim().email().max(160), role: z.enum(["admin", "concierge"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const email = data.email.toLowerCase();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      const already = /already|exist|registered/i.test(error?.message ?? "");
      return { ok: false as const, reason: already ? "Cette adresse correspond déjà à un compte." : "La création du compte a échoué." };
    }
    const id = created.user.id;
    await admin.from("profiles").update({ full_name: data.fullName, role_label: "Équipe Art de Vie", concierge_referent: null, concierge_whatsapp: null }).eq("id", id);
    const { error: roleError } = await admin.from("user_roles").insert({ user_id: id, role: data.role });
    if (roleError) return { ok: false as const, reason: "Le compte a été créé, mais le rôle n’a pas pu être attribué." };
    const origin = originOf();
    const { error: mailError } = await admin.auth.resetPasswordForEmail(email, origin ? { redirectTo: `${origin}/reset-password` } : {});
    if (mailError) return { ok: true as const, id, mailed: false };
    return { ok: true as const, id, mailed: true };
  });

// ---------- Offres (administrateurs) ----------
export const OFFER_CATEGORIES = ["Restaurant", "Bien-être", "Culture", "Voyage"] as const;
const offerSchema = z.object({
  title: z.string().trim().min(1).max(120),
  partner: z.string().trim().min(1).max(120),
  category: z.enum(OFFER_CATEGORIES),
  place: z.string().trim().min(1).max(120),
  promo: z.string().trim().min(1).max(80),
  validity: z.string().trim().min(1).max(80),
  image_url: z.string().trim().max(300).nullable(),
});
export type OfferInput = z.infer<typeof offerSchema>;
export type AdminOffer = OfferInput & { id: string; image_key: string; published: boolean; sort_order: number; preview_url: string | null };

export const listOffersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOffer[]> => {
    const admin = await assertAdmin(context as Ctx);
    const { data, error } = await admin.from("offers").select("id, title, partner, category, place, promo, validity, image_key, image_url, published, sort_order").order("sort_order", { ascending: true });
    if (error) throw new Error("Lecture des offres impossible.");
    const rows = data ?? [];
    const paths = rows.map((o) => o.image_url).filter((p): p is string => !!p);
    const signed: Record<string, string> = {};
    if (paths.length) {
      const { data: s } = await admin.storage.from("offer-images").createSignedUrls(paths, 3600);
      for (const x of s ?? []) if (x.path && x.signedUrl) signed[x.path] = x.signedUrl;
    }
    return rows.map((o) => ({ ...o, category: o.category as OfferInput["category"], preview_url: o.image_url ? signed[o.image_url] ?? null : null }));
  });

export const createOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OfferInput) => offerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { data: last } = await admin.from("offers").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data: row, error } = await admin.from("offers").insert({ ...data, sort_order: (last?.sort_order ?? 0) + 1, published: true }).select("id").single();
    if (error) return { ok: false as const, reason: "La création de l’offre a échoué." };
    return { ok: true as const, id: row.id as string };
  });

export const updateOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OfferInput & { id: string }) => offerSchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { id, ...fields } = data;
    const { error } = await admin.from("offers").update(fields).eq("id", id);
    if (error) return { ok: false as const, reason: "La modification de l’offre a échoué." };
    return { ok: true as const };
  });

export const setOfferPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; published: boolean }) => z.object({ id: z.string().uuid(), published: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { error } = await admin.from("offers").update({ published: data.published }).eq("id", data.id);
    if (error) return { ok: false as const, reason: "L’opération a échoué." };
    return { ok: true as const };
  });

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const uploadOfferImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FormData) => {
    if (!(input instanceof FormData)) throw new Error("Format invalide.");
    const file = input.get("file");
    if (!(file instanceof File)) throw new Error("Aucun fichier.");
    return { file };
  })
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const ext = IMAGE_TYPES[data.file.type];
    if (!ext) return { ok: false as const, reason: "Formats acceptés : JPEG, PNG ou WebP." };
    if (data.file.size > 5 * 1024 * 1024) return { ok: false as const, reason: "La photo dépasse 5 Mo." };
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage.from("offer-images").upload(path, await data.file.arrayBuffer(), { contentType: data.file.type, upsert: false });
    if (error) return { ok: false as const, reason: "L’envoi de la photo a échoué." };
    const { data: s } = await admin.storage.from("offer-images").createSignedUrl(path, 3600);
    return { ok: true as const, path, previewUrl: s?.signedUrl ?? null };
  });

// ---- Lot 4.2 : montant, commission, facture d'une demande ----

type BillingInvoice = { id: string; number: string; status: string; issued_on: string; amount_cents: number };

/** Montant, formule du membre, commission et facture liée. La facture n'est détaillée que pour un administrateur. */
export const getRequestBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const { invoiceBreakdown } = await import("./billing-rules");
    const { data: request, error } = await admin.from("requests").select("id, user_id, amount_cents").eq("id", data.id).maybeSingle();
    if (error) throw new Error("Le montant n’a pas pu être chargé.");
    if (!request) return null;
    const [{ data: member }, { data: invoice }] = await Promise.all([
      admin.from("profiles").select("plan").eq("id", request.user_id).maybeSingle(),
      admin.from("invoices").select("id, number, status, issued_on, amount_cents").eq("request_id", data.id).maybeSingle(),
    ]);
    const plan: string = member?.plan ?? "Signature";
    return {
      amount_cents: request.amount_cents as number | null,
      plan,
      breakdown: request.amount_cents === null ? null : invoiceBreakdown(request.amount_cents, plan),
      invoiced: !!invoice,
      invoice: role === "admin" ? ((invoice as BillingInvoice | null) ?? null) : null,
    };
  });

export const setRequestAmount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), amountCents: z.number().int().min(0).max(100_000_000).nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: invoice } = await admin.from("invoices").select("id").eq("request_id", data.id).maybeSingle();
    if (invoice) return { ok: false as const, reason: "Une facture existe déjà pour cette demande : le montant ne peut plus être modifié." };
    const { data: row, error } = await admin.from("requests").update({ amount_cents: data.amountCents }).eq("id", data.id).select("id").maybeSingle();
    if (error || !row) return { ok: false as const, reason: "Le montant n’a pas pu être enregistré." };
    const { formatAmount } = await import("@/data/art-de-vie");
    await admin.from("request_events").insert({ request_id: data.id, actor_id: (context as Ctx).userId, kind: data.amountCents === null ? "montant retiré" : "montant renseigné", detail: data.amountCents === null ? null : formatAmount(data.amountCents) });
    return { ok: true as const };
  });

/** Crée la facture de la prestation : prestation + commission selon la formule, numéro attribué par la base. */
export const createRequestInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { invoiceBreakdown } = await import("./billing-rules");
    const { data: request } = await admin.from("requests").select("id, user_id, status, amount_cents").eq("id", data.id).maybeSingle();
    if (!request) return { ok: false as const, reason: "Demande introuvable." };
    if (request.status === "Annulée") return { ok: false as const, reason: "Une demande annulée ne peut pas être facturée." };
    if (!request.amount_cents) return { ok: false as const, reason: "Renseignez d’abord le montant de la prestation." };
    const { data: existing } = await admin.from("invoices").select("id").eq("request_id", data.id).maybeSingle();
    if (existing) return { ok: false as const, reason: "Une facture existe déjà pour cette demande." };
    const { data: member } = await admin.from("profiles").select("plan").eq("id", request.user_id).maybeSingle();
    const b = invoiceBreakdown(request.amount_cents, member?.plan ?? "Signature");
    const { data: number, error: numberError } = await admin.rpc("next_invoice_number");
    if (numberError || !number) return { ok: false as const, reason: "Le numéro de facture n’a pas pu être attribué." };
    const { data: invoice, error } = await admin.from("invoices").insert({
      user_id: request.user_id,
      request_id: request.id,
      number,
      kind: "Prestations",
      status: "En attente",
      amount_cents: b.total_cents,
      service_cents: b.service_cents,
      commission_cents: b.commission_cents,
      commission_rate: b.commission_rate,
    }).select("id, number").single();
    if (error || !invoice) return { ok: false as const, reason: error?.code === "23505" ? "Une facture existe déjà pour cette demande." : "La facture n’a pas pu être créée." };
    await admin.from("request_events").insert({ request_id: request.id, actor_id: (context as Ctx).userId, kind: "facture créée", detail: invoice.number });
    return { ok: true as const, number: invoice.number as string };
  });

// ---- Lot 4.3 : « À surveiller », préférences du membre ----

async function dashboardWatch(admin: any, role: TeamRole, rows: Array<{ id: string; title: string; status: string; created_at: string; member_name: string }>, teamIdList: string[], names: Map<string, string>) {
  const { isStaleRequest, isRenewalDue, waitingLabel, FAILED_INVOICE_STATUSES } = await import("./watch-rules");
  const staleRequests = rows.filter((r) => isStaleRequest(r)).map((r) => ({ id: r.id, title: r.title, member_name: r.member_name, waiting: waitingLabel(r.created_at) }));
  const { data: changes } = await admin.from("request_changes").select("id, request_id, kind, created_at").eq("status", "en attente").order("created_at");
  const titles = new Map(rows.map((r) => [r.id, r]));
  const { changeKindLabel } = await import("./request-actions-rules");
  const pendingChanges = ((changes ?? []) as Array<{ id: string; request_id: string; kind: string; created_at: string }>).map((c) => ({ id: c.id, request_id: c.request_id, label: changeKindLabel(c.kind), title: titles.get(c.request_id)?.title ?? "Demande", member_name: titles.get(c.request_id)?.member_name ?? "" }));
  const { data: members } = await admin.from("profiles").select("id, full_name, valid_until, disabled_at");
  const renewals = ((members ?? []) as Array<{ id: string; full_name: string; valid_until: string | null; disabled_at: string | null }>)
    .filter((m) => !m.disabled_at && !teamIdList.includes(m.id) && isRenewalDue(m.valid_until))
    .sort((a, b) => (a.valid_until ?? "").localeCompare(b.valid_until ?? ""))
    .map((m) => ({ id: m.id, full_name: m.full_name, valid_until: m.valid_until as string }));
  if (role !== "admin") return { staleRequests, renewals, pendingChanges, failedInvoices: null, receivedReferrals: null };
  const [{ data: invoices }, { data: referrals }] = await Promise.all([
    admin.from("invoices").select("id, number, user_id, amount_cents, status, issued_on").in("status", [...FAILED_INVOICE_STATUSES]).order("issued_on", { ascending: false }),
    admin.from("referrals").select("id, full_name, inviter_id, created_at").eq("status", "Invitation envoyée").order("created_at", { ascending: true }),
  ]);
  return {
    staleRequests,
    renewals,
    pendingChanges,
    failedInvoices: ((invoices ?? []) as Array<{ id: string; number: string; user_id: string; amount_cents: number; status: string }>).map((i) => ({ ...i, member_name: names.get(i.user_id) ?? "" })),
    receivedReferrals: ((referrals ?? []) as Array<{ id: string; full_name: string; inviter_id: string; created_at: string }>).map((r) => ({ id: r.id, full_name: r.full_name, inviter_name: names.get(r.inviter_id) ?? "", created_at: r.created_at })),
  };
}

const preferenceFields = {
  tables: z.string().max(2000),
  sejours: z.string().max(2000),
  transferts: z.string().max(2000),
  dates_cles: z.string().max(2000),
  calendrier: z.string().max(2000),
};
export type MemberAnswers = { tables_choix: string[]; sejours_choix: string[]; transferts_choix: string[]; dates_membre: string; member_updated_at: string | null };
export type MemberPreferences = { tables: string; sejours: string; transferts: string; dates_cles: string; calendrier: string; updated_at: string | null; updated_by_name: string | null; answers: MemberAnswers };

export const getMemberPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<MemberPreferences> => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: row, error } = await admin.from("member_preferences").select("tables, sejours, transferts, dates_cles, calendrier, updated_at, updated_by, tables_choix, sejours_choix, transferts_choix, dates_membre, member_updated_at").eq("user_id", data.id).maybeSingle();
    if (error) throw new Error("Les préférences n’ont pas pu être chargées.");
    if (!row) return { tables: "", sejours: "", transferts: "", dates_cles: "", calendrier: "", updated_at: null, updated_by_name: null, answers: { tables_choix: [], sejours_choix: [], transferts_choix: [], dates_membre: "", member_updated_at: null } };
    let updatedByName: string | null = null;
    if (row.updated_by) {
      const { data: author } = await admin.from("profiles").select("full_name").eq("id", row.updated_by).maybeSingle();
      updatedByName = author?.full_name?.trim() || "Équipe";
    }
    return {
      tables: row.tables, sejours: row.sejours, transferts: row.transferts, dates_cles: row.dates_cles, calendrier: row.calendrier, updated_at: row.updated_at, updated_by_name: updatedByName,
      answers: { tables_choix: row.tables_choix ?? [], sejours_choix: row.sejours_choix ?? [], transferts_choix: row.transferts_choix ?? [], dates_membre: row.dates_membre ?? "", member_updated_at: row.member_updated_at ?? null },
    };
  });

export const saveMemberPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), ...preferenceFields }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const ids = await teamIds(admin);
    if (ids.includes(data.id)) return { ok: false as const, reason: "Ce compte appartient à l’équipe." };
    const { id, ...fields } = data;
    const trimmed = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()]));
    const { error } = await admin.from("member_preferences").upsert({ user_id: id, ...trimmed, updated_at: new Date().toISOString(), updated_by: (context as Ctx).userId }, { onConflict: "user_id" });
    if (error) return { ok: false as const, reason: "Les préférences n’ont pas pu être enregistrées." };
    return { ok: true as const };
  });

// ---- Lot 4.3 : notifications au membre, dans l'application ----

type Tr = (fr: string, vars?: Record<string, string | number>) => string;

function statusNotice(title: string, status: string, tr: Tr): string {
  switch (status) {
    case "En cours": return tr("Votre demande « {title} » est prise en charge.", { title });
    case "Confirmée": return tr("Votre demande « {title} » est confirmée.", { title });
    case "Terminée": return tr("Votre demande « {title} » est terminée.", { title });
    case "Annulée": return tr("Votre demande « {title} » a été annulée.", { title });
    default: return tr("Votre demande « {title} » est de nouveau en attente de prise en charge.", { title });
  }
}

/**
 * Crée une notification pour le membre, s'il a laissé « Mes demandes » activé. Ne bloque jamais l'action de l'équipe.
 * Lot 6.5 : le texte est rédigé dans la langue du membre au moment de l'envoi.
 */
async function notifyMember(admin: any, requestId: string, kind: string, body: (title: string, tr: Tr) => string) {
  try {
    const { data: request } = await admin.from("requests").select("user_id, title").eq("id", requestId).maybeSingle();
    if (!request) return;
    const { data: profile } = await admin.from("profiles").select("notify_requests, notify_messages, language").eq("id", request.user_id).maybeSingle();
    // Messages de l'équipe : réglage « Messages » ; statuts et réponses : réglage « Mes demandes ».
    if (!(kind === "message" ? profile?.notify_messages : profile?.notify_requests)) return;
    await admin.from("member_notifications").insert({ user_id: request.user_id, request_id: requestId, kind, body: body(request.title, (fr, vars) => translate(profile?.language === "en" ? "en" : "fr", fr, vars)) });
  } catch (err) {
    console.error("[notifyMember] notification non créée", err);
  }
}

// ---- Lot 5.1 : fil d'échanges avec le membre ----

export type RequestMessage = { id: string; author_role: "membre" | "équipe"; author_name: string; body: string; created_at: string };

export const listRequestMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<RequestMessage[]> => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: rows, error } = await admin.from("request_messages").select("id, author_id, author_role, body, created_at").eq("request_id", data.requestId).order("created_at").order("id");
    if (error) throw new Error("Les échanges n’ont pas pu être chargés.");
    const ids = [...new Set((rows ?? []).flatMap((m) => (m.author_id ? [m.author_id] : [])))];
    const { data: authors } = ids.length ? await admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
    const names = new Map((authors ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name.trim()]));
    return (rows ?? []).map((m) => ({
      id: m.id,
      author_role: m.author_role as "membre" | "équipe",
      author_name: (m.author_id ? names.get(m.author_id) : null) || (m.author_role === "membre" ? "Le membre" : "Équipe"),
      body: m.body,
      created_at: m.created_at,
    }));
  });

export const sendTeamMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { error } = await admin.from("request_messages").insert({ request_id: data.requestId, author_id: (context as Ctx).userId, author_role: "équipe", body: data.body });
    if (error) return { ok: false as const, reason: "Le message n’a pas pu être envoyé." };
    await admin.from("request_events").insert({ request_id: data.requestId, actor_id: (context as Ctx).userId, kind: "message envoyé", detail: null });
    await notifyMember(admin, data.requestId, "message", (title, tr) => tr("Votre conciergerie vous a écrit au sujet de « {title} ».", { title }));
    return { ok: true as const };
  });

// ---- Lot 5.2 : pièces jointes ----

export type TeamRequestFile = { id: string; name: string; size: number; mime: string; visible_to_member: boolean; created_at: string; uploaded_by_name: string };

export const listRequestFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TeamRequestFile[]> => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: rows, error } = await admin.from("request_files").select("id, name, size, mime, visible_to_member, created_at, uploaded_by").eq("request_id", data.requestId).order("created_at");
    if (error) throw new Error("Les pièces jointes n’ont pas pu être chargées.");
    const ids = [...new Set((rows ?? []).flatMap((f) => (f.uploaded_by ? [f.uploaded_by] : [])))];
    const { data: authors } = ids.length ? await admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
    const names = new Map((authors ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name.trim()]));
    return (rows ?? []).map((f) => ({ id: f.id, name: f.name, size: f.size, mime: f.mime, visible_to_member: f.visible_to_member, created_at: f.created_at, uploaded_by_name: (f.uploaded_by ? names.get(f.uploaded_by) : null) || "Équipe" }));
  });

export const uploadRequestFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FormData) => {
    if (!(input instanceof FormData)) throw new Error("Format invalide.");
    const file = input.get("file");
    const requestId = z.string().uuid().parse(input.get("requestId"));
    if (!(file instanceof File)) throw new Error("Aucun fichier.");
    return { file, requestId, visible: input.get("visible") === "true" };
  })
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { fileProblem, cleanFileName, FILE_TYPES } = await import("./request-actions-rules");
    const problem = fileProblem(data.file);
    if (problem) return { ok: false as const, reason: problem };
    const { data: request } = await admin.from("requests").select("id").eq("id", data.requestId).maybeSingle();
    if (!request) return { ok: false as const, reason: "Demande introuvable." };
    const path = `${data.requestId}/${crypto.randomUUID()}.${FILE_TYPES[data.file.type]!.ext}`;
    const { error: uploadError } = await admin.storage.from("request-files").upload(path, await data.file.arrayBuffer(), { contentType: data.file.type, upsert: false });
    if (uploadError) return { ok: false as const, reason: "L’envoi du fichier a échoué." };
    const name = cleanFileName(data.file.name);
    const { error } = await admin.from("request_files").insert({ request_id: data.requestId, path, name, size: data.file.size, mime: data.file.type, uploaded_by: (context as Ctx).userId, visible_to_member: data.visible });
    if (error) {
      await admin.storage.from("request-files").remove([path]);
      return { ok: false as const, reason: "Le fichier n’a pas pu être enregistré." };
    }
    await admin.from("request_events").insert({ request_id: data.requestId, actor_id: (context as Ctx).userId, kind: "pièce jointe ajoutée", detail: `${name}${data.visible ? " · visible par le membre" : " · interne"}` });
    if (data.visible) await notifyMember(admin, data.requestId, "document", (title, tr) => tr("Un document a été ajouté à votre demande « {title} ».", { title }));
    return { ok: true as const };
  });

export const setRequestFileVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), visible: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: file } = await admin.from("request_files").select("request_id, name, visible_to_member").eq("id", data.id).maybeSingle();
    if (!file) return { ok: false as const, reason: "Fichier introuvable." };
    if (file.visible_to_member === data.visible) return { ok: true as const };
    const { error } = await admin.from("request_files").update({ visible_to_member: data.visible }).eq("id", data.id);
    if (error) return { ok: false as const, reason: "La visibilité n’a pas pu être modifiée." };
    await admin.from("request_events").insert({ request_id: file.request_id, actor_id: (context as Ctx).userId, kind: data.visible ? "document rendu visible" : "document rendu interne", detail: file.name });
    if (data.visible) await notifyMember(admin, file.request_id, "document", (title, tr) => tr("Un document a été ajouté à votre demande « {title} ».", { title }));
    return { ok: true as const };
  });

/** Lien de téléchargement signé, valable cinq minutes. */
export const getRequestFileUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: file } = await admin.from("request_files").select("path, name").eq("id", data.id).maybeSingle();
    if (!file) return { ok: false as const, reason: "Fichier introuvable." };
    const { data: signed, error } = await admin.storage.from("request-files").createSignedUrl(file.path, 300, { download: file.name });
    if (error || !signed) return { ok: false as const, reason: "Le lien de téléchargement n’a pas pu être créé." };
    return { ok: true as const, url: signed.signedUrl };
  });

// ---- Lot 5.3 : demandes de modification, avis ----

export type TeamChange = { id: string; kind: string; label: string; body: string; status: string; created_at: string; decided_at: string | null; decided_by_name: string | null };

export const listRequestChanges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TeamChange[]> => {
    const { admin } = await assertTeam(context as Ctx);
    const { changeKindLabel } = await import("./request-actions-rules");
    const { data: rows, error } = await admin.from("request_changes").select("id, kind, body, status, created_at, decided_at, decided_by").eq("request_id", data.requestId).order("created_at", { ascending: false });
    if (error) throw new Error("Les demandes de modification n’ont pas pu être chargées.");
    const ids = [...new Set((rows ?? []).flatMap((c) => (c.decided_by ? [c.decided_by] : [])))];
    const { data: authors } = ids.length ? await admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
    const names = new Map((authors ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name.trim()]));
    return (rows ?? []).map((c) => ({ id: c.id, kind: c.kind, label: changeKindLabel(c.kind), body: c.body, status: c.status, created_at: c.created_at, decided_at: c.decided_at, decided_by_name: c.decided_by ? names.get(c.decided_by) ?? "Équipe" : null }));
  });

/** Accepter ne modifie rien automatiquement : l'équipe met ensuite la demande à jour elle-même. */
export const decideRequestChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), decision: z.enum(["acceptée", "refusée"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: row, error } = await admin.from("request_changes").update({ status: data.decision, decided_by: (context as Ctx).userId, decided_at: new Date().toISOString() }).eq("id", data.id).eq("status", "en attente").select("request_id, kind").maybeSingle();
    if (error || !row) return { ok: false as const, reason: "Cette demande de modification a déjà été traitée." };
    const { changeKindLabel } = await import("./request-actions-rules");
    await admin.from("request_events").insert({ request_id: row.request_id, actor_id: (context as Ctx).userId, kind: data.decision === "acceptée" ? "modification acceptée" : "modification refusée", detail: changeKindLabel(row.kind) });
    await notifyMember(admin, row.request_id, "statut", (title, tr) => data.decision === "acceptée" ? tr("Votre demande de modification pour « {title} » est acceptée.", { title }) : tr("Votre demande de modification pour « {title} » n’a pas pu être retenue.", { title }));
    return { ok: true as const };
  });

export type TeamReview = { rating: string; comment: string; created_at: string };

export const getRequestReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TeamReview | null> => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: review } = await admin.from("request_reviews").select("rating, comment, created_at").eq("request_id", data.requestId).maybeSingle();
    return review ?? null;
  });

export const listMemberReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ memberId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: reviews } = await admin.from("request_reviews").select("request_id, rating, comment, created_at").eq("user_id", data.memberId).order("created_at", { ascending: false });
    const ids = (reviews ?? []).map((r) => r.request_id);
    const { data: requests } = ids.length ? await admin.from("requests").select("id, title").in("id", ids) : { data: [] };
    const titles = new Map((requests ?? []).map((r: { id: string; title: string }) => [r.id, r.title]));
    return (reviews ?? []).map((r) => ({ ...r, title: titles.get(r.request_id) ?? "Demande" }));
  });

// ---- Lot 6.1 : proposition à valider ----

export type TeamProposal = { id: string; status: string; created_at: string; decided_at: string | null; options: Array<{ id: string; label: string; detail: string; estimate_cents: number | null; chosen: boolean }> };

export const listRequestProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TeamProposal[]> => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: proposals, error } = await admin.from("request_proposals").select("id, status, created_at, decided_at").eq("request_id", data.requestId).order("created_at", { ascending: false });
    if (error) throw new Error("Les propositions n’ont pas pu être chargées.");
    const ids = (proposals ?? []).map((p) => p.id);
    const { data: options } = ids.length ? await admin.from("request_proposal_options").select("id, proposal_id, label, detail, estimate_cents, chosen, sort_order").in("proposal_id", ids).order("sort_order") : { data: [] };
    return (proposals ?? []).map((p) => ({ ...p, options: (options ?? []).filter((o: { proposal_id: string }) => o.proposal_id === p.id).map(({ id, label, detail, estimate_cents, chosen }: { id: string; label: string; detail: string; estimate_cents: number | null; chosen: boolean }) => ({ id, label, detail, estimate_cents, chosen })) }));
  });

export const sendProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    requestId: z.string().uuid(),
    options: z.array(z.object({ label: z.string().trim().min(1).max(160), detail: z.string().trim().max(2000), estimateCents: z.number().int().min(0).max(100_000_000).nullable() })).min(1).max(6),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: proposal, error } = await admin.from("request_proposals").insert({ request_id: data.requestId, created_by: (context as Ctx).userId }).select("id").single();
    if (error || !proposal) return { ok: false as const, reason: error?.code === "23505" ? "Une proposition attend déjà la réponse du membre." : "La proposition n’a pas pu être envoyée." };
    const { error: optionsError } = await admin.from("request_proposal_options").insert(data.options.map((o, i) => ({ proposal_id: proposal.id, label: o.label, detail: o.detail, estimate_cents: o.estimateCents, sort_order: i })));
    if (optionsError) {
      await admin.from("request_proposals").delete().eq("id", proposal.id);
      return { ok: false as const, reason: "La proposition n’a pas pu être envoyée." };
    }
    await admin.from("request_events").insert({ request_id: data.requestId, actor_id: (context as Ctx).userId, kind: "proposition envoyée", detail: `${data.options.length} option${data.options.length > 1 ? "s" : ""}` });
    await notifyMember(admin, data.requestId, "proposition", (title, tr) => data.options.length > 1 ? tr("Votre conciergerie vous propose {n} options pour « {title} ».", { n: data.options.length, title }) : tr("Votre conciergerie vous propose une option pour « {title} ».", { title }));
    return { ok: true as const };
  });

/** Retire une proposition restée sans réponse (erreur de saisie, situation changée). */
export const withdrawProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { data: row, error } = await admin.from("request_proposals").delete().eq("id", data.id).eq("status", "en attente").select("request_id").maybeSingle();
    if (error || !row) return { ok: false as const, reason: "Le membre a déjà répondu à cette proposition." };
    await admin.from("request_events").insert({ request_id: row.request_id, actor_id: (context as Ctx).userId, kind: "proposition retirée", detail: null });
    return { ok: true as const };
  });

// ---- Lot 6.3 : agenda de l'équipe ----

export type AgendaItem = {
  key: string;
  kind: "demande" | "echeance";
  date: string;
  time: string | null;
  title: string;
  status: string;
  member_id: string;
  member_name: string;
  concierge_id: string | null;
  request_id: string | null;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Prestations datées (hors annulées) et échéances récurrentes à venir, entre deux dates incluses. */
export const getAgenda = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ from: isoDate, to: isoDate }).refine((v) => v.from <= v.to).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { occurrencesBetween } = await import("./agenda-rules");
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: requests, error }, { data: rules }, { data: profiles }] = await Promise.all([
      admin.from("requests").select("id, user_id, title, status, scheduled_date, scheduled_time, concierge_id, recurring_id, created_at").gte("scheduled_date", data.from).lte("scheduled_date", data.to).neq("status", "Annulée"),
      admin.from("recurring_requests").select("id, user_id, title, rhythm, start_date, dates, end_date, paused, last_occurrence, scheduled_time").eq("paused", false),
      admin.from("profiles").select("id, full_name"),
    ]);
    if (error) throw new Error("L’agenda n’a pas pu être chargé.");
    const names = new Map((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
    const items: AgendaItem[] = (requests ?? []).map((r: any) => ({
      key: r.id, kind: "demande" as const, date: r.scheduled_date, time: r.scheduled_time ? String(r.scheduled_time).slice(0, 5) : null,
      title: r.title, status: r.status, member_id: r.user_id, member_name: names.get(r.user_id) ?? "", concierge_id: r.concierge_id ?? null, request_id: r.id,
    }));
    const ruleList = (rules ?? []) as Array<any>;
    if (ruleList.length > 0) {
      // Dernière demande de chaque série : sert de lien et donne le concierge habituel.
      const { data: lastRequests } = await admin.from("requests").select("id, recurring_id, concierge_id, scheduled_date, created_at").in("recurring_id", ruleList.map((r) => r.id)).order("created_at", { ascending: false });
      const latest = new Map<string, { id: string; concierge_id: string | null }>();
      for (const r of (lastRequests ?? []) as Array<{ id: string; recurring_id: string; concierge_id: string | null }>) if (!latest.has(r.recurring_id)) latest.set(r.recurring_id, r);
      const from = data.from > today ? data.from : today;
      for (const rule of ruleList) {
        if (from > data.to) break;
        const last = latest.get(rule.id) ?? null;
        for (const date of occurrencesBetween({ ...rule, dates: rule.dates ?? [] }, from, data.to)) {
          items.push({
            key: `${rule.id}:${date}`, kind: "echeance", date, time: rule.scheduled_time ? String(rule.scheduled_time).slice(0, 5) : null,
            title: rule.title, status: "À venir", member_id: rule.user_id, member_name: names.get(rule.user_id) ?? "", concierge_id: last?.concierge_id ?? null, request_id: last?.id ?? null,
          });
        }
      }
    }
    items.sort((a, b) => `${a.date}${a.time ?? "99"}`.localeCompare(`${b.date}${b.time ?? "99"}`) || a.title.localeCompare(b.title));
    return { items, me: (context as Ctx).userId };
  });

// ---- Lot 6.4 : relevé du mois d'un membre ----

export const getMemberStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const { statementLines, STATEMENT_STATUSES } = await import("./member-rules");
    const [{ data: member }, { data: rows, error }] = await Promise.all([
      admin.from("profiles").select("full_name, member_number, language").eq("id", data.id).maybeSingle(),
      admin.from("requests").select("id, title, status, amount_cents, scheduled_date, created_at").eq("user_id", data.id).in("status", [...STATEMENT_STATUSES]).not("amount_cents", "is", null),
    ]);
    if (error || !member) throw new Error("Le relevé n’a pas pu être chargé.");
    return { member_name: member.full_name as string, member_number: member.member_number as string, language: (member.language === "en" ? "en" : "fr") as "fr" | "en", lines: statementLines(rows ?? [], data.month) };
  });
