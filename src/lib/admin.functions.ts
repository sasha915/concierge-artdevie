import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || data !== true) throw new Error("Forbidden");
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
