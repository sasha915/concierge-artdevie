import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { euro, mollie, mollieKey, publicBase, webhookBase, type MolliePayment } from "./mollie.server";

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

/** Lien de paiement encore ouvert, à réutiliser plutôt que d'en créer un second. */
async function openCheckout(paymentId: string | null | undefined): Promise<string | null> {
  if (!paymentId) return null;
  try {
    const p = await mollie<MolliePayment>(`/payments/${paymentId}`);
    return p.status === "open" ? p._links?.checkout?.href ?? null : null;
  } catch {
    return null;
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
    // Date réelle du prochain prélèvement, lue chez Mollie quand l'abonnement existe.
    let nextPaymentDate: string | null = null;
    const subId = p?.mollie_subscription_id;
    if (mollieKey() && subId && !subId.startsWith("en_cours:")) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: prof } = await supabaseAdmin.from("profiles").select("mollie_customer_id").eq("id", context.userId).maybeSingle();
        if (prof?.mollie_customer_id) {
          const sub = await mollie<{ nextPaymentDate?: string; status?: string }>(`/customers/${prof.mollie_customer_id}/subscriptions/${subId}`);
          if (sub.status === "active") nextPaymentDate = sub.nextPaymentDate ?? null;
        }
      } catch (err) {
        console.error("[billingStatus] abonnement illisible", err);
      }
    }
    return {
      configured: !!mollieKey(),
      hasMandate: !!subId,
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

    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("id, number, amount_cents, status, user_id, mollie_payment_id")
      .eq("id", data.invoiceId)
      .eq("user_id", context.userId)
      .single();
    if (!invoice) return { ok: false as const, reason: "invoice_not_found" };
    if (invoice.status === "Payée") return { ok: false as const, reason: "already_paid" };
    // Double clic ou retour sur la page : le lien déjà ouvert est repris.
    const reuse = await openCheckout(invoice.mollie_payment_id);
    if (reuse) return { ok: true as const, checkoutUrl: reuse };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, mollie_customer_id")
      .eq("id", context.userId)
      .single();

    const customerId = await ensureCustomer(supabaseAdmin, context.userId, profile ?? {});

    const base = publicBase(getRequest());
    const payment = await mollie<MolliePayment>("/payments", {
      method: "POST",
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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, plan, mollie_customer_id, mollie_subscription_id")
      .eq("id", context.userId)
      .single();
    if (!profile) return { ok: false as const, reason: "profile_not_found" };
    if (profile.mollie_subscription_id) return { ok: false as const, reason: "mandate_active" };

    const customerId = await ensureCustomer(supabaseAdmin, context.userId, profile);

    // Double clic : un premier paiement encore ouvert est repris au lieu d'en créer un second.
    try {
      const recent = await mollie<{ _embedded?: { payments?: MolliePayment[] } }>(`/customers/${customerId}/payments?limit=10`);
      const pending = (recent._embedded?.payments ?? []).find((p) => p.sequenceType === "first" && p.status === "open" && (p.metadata as { kind?: string } | undefined)?.kind === "mandate_first");
      const href = pending?._links?.checkout?.href;
      if (href) return { ok: true as const, checkoutUrl: href };
    } catch (err) {
      console.error("[activateAutoDebit] paiements récents illisibles", err);
    }

    const { data: plan } = await supabaseAdmin.from("membership_plans").select("price_cents").eq("name", profile.plan).maybeSingle();
    if (!plan) return { ok: false as const, reason: "plan_not_found" as const };
    const base = publicBase(getRequest());
    const payment = await mollie<MolliePayment>("/payments", {
      method: "POST",
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
