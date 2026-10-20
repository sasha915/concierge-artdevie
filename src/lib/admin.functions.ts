import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { mollie, mollieKey, statusLabel, type MolliePayment } from "./mollie.server";

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
      admin.from("profiles").select("id, full_name, email, phone, plan, role_label, member_number, member_since, valid_until, disabled_at, concierge_referent, concierge_whatsapp").eq("id", data.id).maybeSingle(),
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
const requestCols = "id, user_id, category, status, title, description, scheduled_date, scheduled_time, guests, concierge, concierge_id, image_key, created_at, team_reply, team_reply_at";

export const listAllRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const [{ data: requests }, { data: profiles }] = await Promise.all([
      admin.from("requests").select(requestCols).order("created_at", { ascending: false }),
      admin.from("profiles").select("id, full_name, email, plan"),
    ]);
    const byId = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]));
    return (requests ?? []).map((r: { user_id: string }) => {
      const p = byId.get(r.user_id) as { full_name: string; email: string | null; plan: string } | undefined;
      return { ...r, member_name: p?.full_name ?? "", member_email: p?.email ?? null, member_plan: p?.plan ?? null };
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
    const { error } = await admin.from("requests").update({ status: data.status }).eq("id", data.id);
    if (error) return { ok: false as const, reason: "Le statut n’a pas pu être modifié." };
    return { ok: true as const };
  });

export const setRequestConcierge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), conciergeId: z.string().uuid().nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin } = await assertTeam(context as Ctx);
    const resolved = await resolveConcierge(admin, data.conciergeId);
    if (!resolved) return { ok: false as const, reason: "Ce compte ne fait pas partie de l’équipe." };
    const { error } = await admin.from("requests").update(resolved).eq("id", data.id);
    if (error) return { ok: false as const, reason: "L’attribution a échoué." };
    return { ok: true as const };
  });

export const setRequestReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), reply: z.string().max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const { replyUpdate } = await import("./request-rules");
    const { error } = await admin.from("requests").update(replyUpdate(data.reply)).eq("id", data.id);
    if (error) return { ok: false as const, reason: "La réponse n’a pas pu être enregistrée." };
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
    return {
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
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, role } = await assertTeam(context as Ctx);
    const ids = await teamIds(admin);
    if (ids.includes(data.memberId)) return { ok: false as const, reason: "Ce compte appartient à l’équipe." };
    const { data: member } = await admin.from("profiles").select("id, disabled_at").eq("id", data.memberId).maybeSingle();
    if (!member) return { ok: false as const, reason: "Membre introuvable." };
    const resolved = await resolveConcierge(admin, data.conciergeId);
    if (!resolved) return { ok: false as const, reason: "Ce compte ne fait pas partie de l’équipe." };
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
    return { ok: true as const, id: row.id as string };
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
