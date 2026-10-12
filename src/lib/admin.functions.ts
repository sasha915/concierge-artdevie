import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { mollie, mollieKey, statusLabel, type MolliePayment } from "./mollie.server";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Forbidden");
  const { requireAdminUnlocked } = await import("./admin-gate.server");
  await requireAdminUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
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
    const admin = await assertAdmin(context as Ctx);
    const [{ data: profiles }, { data: requests }, { data: invoices }] = await Promise.all([
      admin.from("profiles").select("id, full_name, email, phone, plan, role_label, member_number, member_since, valid_until, disabled_at, concierge_referent, concierge_whatsapp").order("member_since", { ascending: false }),
      admin.from("requests").select("user_id"),
      admin.from("invoices").select("user_id"),
    ]);
    const countBy = (rows: { user_id: string }[] | null) =>
      (rows ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.user_id]: (acc[r.user_id] ?? 0) + 1 }), {});
    const rc = countBy(requests as { user_id: string }[] | null);
    const ic = countBy(invoices as { user_id: string }[] | null);
    return (profiles ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      requests_count: rc[p['id'] as string] ?? 0,
      invoices_count: ic[p['id'] as string] ?? 0,
    }));
  });

export const getMemberDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const [{ data: profile }, { data: requests }, { data: invoices }] = await Promise.all([
      admin.from("profiles").select("id, full_name, email, phone, plan, role_label, member_number, member_since, valid_until, disabled_at, concierge_referent, concierge_whatsapp").eq("id", data.id).maybeSingle(),
      admin.from("requests").select("id, category, status, title, description, scheduled_date, scheduled_time, concierge, image_key").eq("user_id", data.id).order("created_at", { ascending: false }),
      admin.from("invoices").select("id, number, kind, issued_on, amount_cents, status").eq("user_id", data.id).order("issued_on", { ascending: false }),
    ]);
    return { profile: profile ?? null, requests: requests ?? [], invoices: invoices ?? [] };
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
const requestCols = "id, user_id, category, status, title, description, scheduled_date, scheduled_time, guests, concierge, image_key, created_at, team_reply, team_reply_at";

export const listAllRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as Ctx);
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
    const admin = await assertAdmin(context as Ctx);
    const { data: request } = await admin.from("requests").select(requestCols).eq("id", data.id).maybeSingle();
    if (!request) return { request: null, member: null };
    const { data: member } = await admin
      .from("profiles")
      .select("id, full_name, email, phone, plan, role_label, member_number, member_since, valid_until, disabled_at, concierge_referent")
      .eq("id", request.user_id)
      .maybeSingle();
    return { request, member: member ?? null };
  });

export const updateRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), status: requestStatus }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { error } = await admin.from("requests").update({ status: data.status }).eq("id", data.id);
    if (error) return { ok: false as const, reason: "Le statut n’a pas pu être modifié." };
    return { ok: true as const };
  });

export const setRequestConcierge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), concierge: z.string().trim().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { error } = await admin.from("requests").update({ concierge: data.concierge }).eq("id", data.id);
    if (error) return { ok: false as const, reason: "L’attribution a échoué." };
    return { ok: true as const };
  });

export const setRequestReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), reply: z.string().max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { replyUpdate } = await import("./request-rules");
    const { error } = await admin.from("requests").update(replyUpdate(data.reply)).eq("id", data.id);
    if (error) return { ok: false as const, reason: "La réponse n’a pas pu être enregistrée." };
    return { ok: true as const };
  });

async function adminIds(admin: any): Promise<string[]> {
  const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  return (data ?? []).map((r: { user_id: string }) => r.user_id);
}

export const listTeamNames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as Ctx);
    const ids = await adminIds(admin);
    if (!ids.length) return [] as string[];
    const { data } = await admin.from("profiles").select("full_name").in("id", ids);
    return [...new Set((data ?? []).map((p: { full_name: string }) => p.full_name.trim()).filter(Boolean))].sort() as string[];
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as Ctx);
    const today = new Date().toISOString().slice(0, 10);
    const ids = await adminIds(admin);
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
