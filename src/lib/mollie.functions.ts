import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { euro, mollie, mollieKey, publicBase, webhookBase, type MolliePayment } from "./mollie.server";

async function accountEnabled(context: { supabase: unknown; userId: string }): Promise<boolean> {
  const { data, error } = await (context.supabase as any).rpc("account_enabled", { _user_id: context.userId });
  return !error && data === true;
}

/**
 * Client Mollie du membre, créé une seule fois même en cas de double clic :
 * l'enregistrement est conditionnel, le second appel reprend le client déjà enregistré.
 */
async function ensureCustomer(admin: any, userId: string, profile: { full_name?: string | null; email?: string | null; mollie_customer_id?: string | null }): Promise<string> {
  if (profile.mollie_customer_id) return profile.mollie_customer_id;
  const customer = await mollie<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({ name: profile.full_name ?? "", email: profile.email ?? undefined, metadata: { user_id: userId } }),
  });
  const { data: saved } = await admin.from("profiles").update({ mollie_customer_id: customer.id }).eq("id", userId).is("mollie_customer_id", null).select("mollie_customer_id").maybeSingle();
  if (saved?.mollie_customer_id) return saved.mollie_customer_id as string;
  const { data: current } = await admin.from("profiles").select("mollie_customer_id").eq("id", userId).maybeSingle();
  return (current?.mollie_customer_id as string | null) ?? customer.id;
}

/**
 * Paiement précédent : lien encore ouvert à réutiliser, ou paiement en cours de traitement
 * (carte, virement) pendant lequel aucun second paiement ne doit être créé.
 */
async function previousPayment(paymentId: string | null | undefined): Promise<{ checkout: string | null; processing: boolean }> {
  if (!paymentId) return { checkout: null, processing: false };
  try {
    const p = await mollie<MolliePayment>(`/payments/${paymentId}`);
    if (p.status === "open") return { checkout: p._links?.checkout?.href ?? null, processing: false };
    return { checkout: null, processing: p.status === "pending" || p.status === "authorized" || p.status === "paid" };
  } catch {
    return { checkout: null, processing: false };
  }
}

/**
 * État réel du prélèvement chez Mollie : abonnement actif et mandat valide (ou en attente).
 * « inactive » si l'abonnement est arrêté ou le mandat révoqué ; « unknown » si Mollie ne répond pas.
 */
async function debitState(customerId: string, subscriptionId: string): Promise<{ state: "active" | "inactive" | "unknown"; nextPaymentDate: string | null }> {
  try {
    const sub = await mollie<{ nextPaymentDate?: string; status?: string }>(`/customers/${customerId}/subscriptions/${subscriptionId}`);
    if (sub.status !== "active" && sub.status !== "pending") return { state: "inactive", nextPaymentDate: null };
    const mandates = await mollie<{ _embedded?: { mandates?: Array<{ status: string }> } }>(`/customers/${customerId}/mandates?limit=50`);
    const usable = (mandates._embedded?.mandates ?? []).some((m) => m.status === "valid" || m.status === "pending");
    if (!usable) return { state: "inactive", nextPaymentDate: null };
    return { state: "active", nextPaymentDate: sub.status === "active" ? sub.nextPaymentDate ?? null : null };
  } catch (err) {
    if (String(err).includes("Mollie 404")) return { state: "inactive", nextPaymentDate: null };
    console.error("[debitState] état du prélèvement illisible", err);
    return { state: "unknown", nextPaymentDate: null };
  }
}

export const billingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: p } = await context.supabase
      .from("profiles")
      .select("plan, mollie_subscription_id")
      .eq("id", context.userId)
      .single();
    // État et date du prochain prélèvement relus chez Mollie : un mandat révoqué n'apparaît plus « actif ».
    let nextPaymentDate: string | null = null;
    let interrupted = false;
    const subId = p?.mollie_subscription_id;
    if (mollieKey() && subId && !subId.startsWith("en_cours:")) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prof } = await supabaseAdmin.from("profiles").select("mollie_customer_id").eq("id", context.userId).maybeSingle();
      if (prof?.mollie_customer_id) {
        const state = await debitState(prof.mollie_customer_id, subId);
        nextPaymentDate = state.nextPaymentDate;
        interrupted = state.state === "inactive";
      }
    }
    return {
      configured: !!mollieKey(),
      hasMandate: !!subId && !interrupted,
      interrupted,
      plan: p?.plan ?? null,
      nextPaymentDate,
    };
  });

export const payInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ invoiceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    if (!mollieKey()) {
      console.warn("paiement non initié : MOLLIE_API_KEY manquant");
      return { ok: false as const, reason: "mollie_not_configured" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ces lectures passent par la clé de service : un compte désactivé est refusé explicitement.
    if (!(await accountEnabled(context))) return { ok: false as const, reason: "account_disabled" };

    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("id, number, amount_cents, status, user_id, mollie_payment_id")
      .eq("id", data.invoiceId)
      .eq("user_id", context.userId)
      .single();
    if (!invoice) return { ok: false as const, reason: "invoice_not_found" };
    if (invoice.status === "Payée") return { ok: false as const, reason: "already_paid" };
    // Double clic ou retour sur la page : le lien déjà ouvert est repris.
    const previous = await previousPayment(invoice.mollie_payment_id);
    if (previous.checkout) return { ok: true as const, checkoutUrl: previous.checkout };
    if (previous.processing) return { ok: false as const, reason: "payment_processing" };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, mollie_customer_id")
      .eq("id", context.userId)
      .single();

    const customerId = await ensureCustomer(supabaseAdmin, context.userId, profile ?? {});

    const base = publicBase(getRequest());
    // Deux clics simultanés portent la même clé : Mollie renvoie le même paiement au lieu d'en créer deux.
    const payment = await mollie<MolliePayment>("/payments", {
      method: "POST",
      headers: { "Idempotency-Key": `adv-inv-${invoice.id}-${invoice.mollie_payment_id ?? "0"}` },
      body: JSON.stringify({
        amount: { currency: "EUR", value: euro(invoice.amount_cents) },
        description: `Art de Vie — ${invoice.number}`,
        redirectUrl: `${base}/membership/factures?paiement=${invoice.id}`,
        webhookUrl: `${webhookBase(getRequest())}/api/public/mollie-webhook`,
        customerId,
        metadata: { invoice_id: invoice.id, kind: "one_off" },
      }),
    });
    const { error: saveError } = await supabaseAdmin
      .from("invoices")
      .update({ mollie_payment_id: payment.id, status: "En attente" })
      .eq("id", invoice.id)
      .neq("status", "Payée");
    if (saveError) return { ok: false as const, reason: "save_failed" };

    const checkoutUrl = payment._links?.checkout?.href;
    if (!checkoutUrl) return { ok: false as const, reason: "no_checkout_url" };
    return { ok: true as const, checkoutUrl };
  });

export const activateAutoDebit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!mollieKey()) {
      console.warn("prélèvement automatique non initié : MOLLIE_API_KEY manquant");
      return { ok: false as const, reason: "mollie_not_configured" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ces lectures passent par la clé de service : un compte désactivé est refusé explicitement.
    if (!(await accountEnabled(context))) return { ok: false as const, reason: "account_disabled" };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, plan, mollie_customer_id, mollie_subscription_id")
      .eq("id", context.userId)
      .single();
    if (!profile) return { ok: false as const, reason: "profile_not_found" };
    const currentSub = profile.mollie_subscription_id as string | null;
    if (currentSub?.startsWith("en_cours:")) return { ok: false as const, reason: "payment_processing" };
    if (currentSub) {
      // Abonnement enregistré : on ne le remplace que s'il est réellement arrêté chez Mollie (mandat révoqué, abonnement annulé).
      const state = profile.mollie_customer_id ? await debitState(profile.mollie_customer_id, currentSub) : { state: "inactive" as const };
      if (state.state !== "inactive") return { ok: false as const, reason: "mandate_active" };
      try {
        await mollie(`/customers/${profile.mollie_customer_id}/subscriptions/${currentSub}`, { method: "DELETE" });
      } catch { /* déjà arrêté */ }
      await supabaseAdmin.from("profiles").update({ mollie_subscription_id: null }).eq("id", context.userId).eq("mollie_subscription_id", currentSub);
    }

    const customerId = await ensureCustomer(supabaseAdmin, context.userId, profile);

    // Double clic : un premier paiement encore ouvert est repris, un paiement en cours de traitement bloque un second.
    let latestFirst = "0";
    try {
      const recent = await mollie<{ _embedded?: { payments?: MolliePayment[] } }>(`/customers/${customerId}/payments?limit=10`);
      const firsts = (recent._embedded?.payments ?? []).filter((p) => p.sequenceType === "first" && (p.metadata as { kind?: string } | undefined)?.kind === "mandate_first");
      latestFirst = firsts[0]?.id ?? "0";
      const open = firsts.find((p) => p.status === "open");
      const href = open?._links?.checkout?.href;
      if (href) return { ok: true as const, checkoutUrl: href };
      // Payé il y a moins d'une heure : le webhook n'a peut-être pas encore créé l'abonnement.
      const justPaid = (p: MolliePayment) => p.status === "paid" && Date.now() - new Date((p as { createdAt?: string }).createdAt ?? 0).getTime() < 3_600_000;
      if (firsts.some((p) => p.status === "pending" || p.status === "authorized" || justPaid(p))) return { ok: false as const, reason: "payment_processing" };
    } catch (err) {
      console.error("[activateAutoDebit] paiements récents illisibles", err);
    }

    const { data: plan } = await supabaseAdmin.from("membership_plans").select("price_cents").eq("name", profile.plan).maybeSingle();
    if (!plan) return { ok: false as const, reason: "plan_not_found" as const };
    const base = publicBase(getRequest());
    const payment = await mollie<MolliePayment>("/payments", {
      method: "POST",
      headers: { "Idempotency-Key": `adv-first-${customerId}-${latestFirst}` },
      body: JSON.stringify({
        amount: { currency: "EUR", value: (plan.price_cents / 100).toFixed(2) },
        description: `Art de Vie — Formule ${profile.plan} (premier prélèvement)`,
        sequenceType: "first",
        customerId,
        redirectUrl: `${base}/membership/factures?abonnement=active`,
        webhookUrl: `${webhookBase(getRequest())}/api/public/mollie-webhook`,
        metadata: { user_id: context.userId, kind: "mandate_first", plan: profile.plan },
      }),
    });

    const checkoutUrl = payment._links?.checkout?.href;
    if (!checkoutUrl) return { ok: false as const, reason: "no_checkout_url" };
    return { ok: true as const, checkoutUrl };
  });
