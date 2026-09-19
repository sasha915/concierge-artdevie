import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { mollie, mollieKey, statusLabel, type MolliePayment } from "@/lib/mollie.server";

export const Route = createFileRoute("/api/public/mollie-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Mollie n'envoie que l'id du paiement ; on vérifie toujours son état réel côté API.
        if (!mollieKey()) {
          console.warn("webhook Mollie ignoré : MOLLIE_API_KEY manquant");
          return new Response(null, { status: 200 });
        }
        const parsed = z
          .object({ id: z.string().min(3).max(64) })
          .safeParse(Object.fromEntries(await request.formData().catch(() => new FormData())));
        if (!parsed.success) return new Response(null, { status: 200 });

        let payment: MolliePayment;
        try {
          payment = await mollie<MolliePayment>(`/payments/${parsed.data.id}`);
        } catch (err) {
          console.error("[mollie-webhook] paiement illisible", err);
          return new Response(null, { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const status = statusLabel[payment.status] ?? "En attente";
        const meta = (payment.metadata ?? {}) as { invoice_id?: string; user_id?: string; kind?: string; plan?: string };

        // 1) Paiement ponctuel lié à une facture existante
        if (meta.invoice_id) {
          await supabaseAdmin
            .from("invoices")
            .update({ status, mollie_payment_id: payment.id })
            .eq("id", meta.invoice_id);
          return new Response(null, { status: 200 });
        }

        // 2) Premier paiement réussi → créer l'abonnement récurrent
        if (meta.kind === "mandate_first" && meta.user_id && payment.status === "paid" && payment.customerId) {
          const essentiel = meta.plan === "Essentiel";
          const sub = await mollie<{ id: string }>(`/customers/${payment.customerId}/subscriptions`, {
            method: "POST",
            body: JSON.stringify({
              amount: { currency: "EUR", value: essentiel ? "890.00" : "1490.00" },
              interval: essentiel ? "12 months" : "1 month",
              description: `Art de Vie — Formule ${essentiel ? "Essentiel" : "Signature"}`,
              metadata: { user_id: meta.user_id, kind: "subscription_charge" },
            }),
          });
          await supabaseAdmin.from("profiles").update({ mollie_subscription_id: sub.id }).eq("id", meta.user_id);

          const { count } = await supabaseAdmin
            .from("invoices")
            .select("id", { count: "exact", head: true });
          await supabaseAdmin.from("invoices").insert({
            user_id: meta.user_id,
            number: `ADV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`,
            kind: "Abonnement",
            amount_cents: Math.round(parseFloat(payment.amount.value) * 100),
            status: "Payée",
            mollie_payment_id: payment.id,
          });
          return new Response(null, { status: 200 });
        }

        // 3) Échéance d'abonnement prélevée automatiquement → nouvelle facture
        if (payment.subscriptionId && payment.status === "paid" && payment.customerId) {
          let userId = meta.user_id ?? null;
          if (!userId) {
            const { data: p } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("mollie_customer_id", payment.customerId)
              .maybeSingle();
            userId = p?.id ?? null;
          }
          if (userId) {
            const { count } = await supabaseAdmin.from("invoices").select("id", { count: "exact", head: true });
            await supabaseAdmin.from("invoices").insert({
              user_id: userId,
              number: `ADV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`,
              kind: "Abonnement",
              amount_cents: Math.round(parseFloat(payment.amount.value) * 100),
              status: "Payée",
              mollie_payment_id: payment.id,
            });
          }
        }
        return new Response(null, { status: 200 });
      },
    },
  },
});
