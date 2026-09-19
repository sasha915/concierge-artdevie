import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { euro, mollie, mollieKey, publicBase, type MolliePayment } from "./mollie.server";

export const billingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: p } = await context.supabase
      .from("profiles")
      .select("plan, mollie_subscription_id")
      .eq("id", context.userId)
      .single();
    return {
      configured: !!mollieKey(),
      hasMandate: !!p?.mollie_subscription_id,
      plan: p?.plan ?? "Signature",
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
      .select("id, number, amount_cents, status, user_id")
      .eq("id", data.invoiceId)
      .eq("user_id", context.userId)
      .single();
    if (!invoice) return { ok: false as const, reason: "invoice_not_found" };
    if (invoice.status === "Payée") return { ok: false as const, reason: "already_paid" };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, mollie_customer_id")
      .eq("id", context.userId)
      .single();

    let customerId = profile?.mollie_customer_id ?? null;
    if (!customerId) {
      const customer = await mollie<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({ name: profile?.full_name ?? "", email: profile?.email ?? undefined }),
      });
      customerId = customer.id;
      await supabaseAdmin.from("profiles").update({ mollie_customer_id: customerId }).eq("id", context.userId);
    }

    const base = publicBase(getRequest());
    const payment = await mollie<MolliePayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: { currency: "EUR", value: euro(invoice.amount_cents) },
        description: `Art de Vie — ${invoice.number}`,
        redirectUrl: `${base}/membership/factures?paiement=${invoice.id}`,
        webhookUrl: `${base}/api/public/mollie-webhook`,
        customerId,
        metadata: { invoice_id: invoice.id, kind: "one_off" },
      }),
    });
    await supabaseAdmin
      .from("invoices")
      .update({ mollie_payment_id: payment.id, status: "En attente" })
      .eq("id", invoice.id);

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

    let customerId = profile.mollie_customer_id;
    if (!customerId) {
      const customer = await mollie<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({ name: profile.full_name, email: profile.email ?? undefined }),
      });
      customerId = customer.id;
      await supabaseAdmin.from("profiles").update({ mollie_customer_id: customerId }).eq("id", context.userId);
    }

    const essentiel = profile.plan === "Essentiel";
    const base = publicBase(getRequest());
    const payment = await mollie<MolliePayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: { currency: "EUR", value: essentiel ? "890.00" : "1490.00" },
        description: `Art de Vie — Formule ${profile.plan} (premier prélèvement)`,
        sequenceType: "first",
        customerId,
        redirectUrl: `${base}/membership/factures?abonnement=active`,
        webhookUrl: `${base}/api/public/mollie-webhook`,
        metadata: { user_id: context.userId, kind: "mandate_first", plan: profile.plan },
      }),
    });

    const checkoutUrl = payment._links?.checkout?.href;
    if (!checkoutUrl) return { ok: false as const, reason: "no_checkout_url" };
    return { ok: true as const, checkoutUrl };
  });
