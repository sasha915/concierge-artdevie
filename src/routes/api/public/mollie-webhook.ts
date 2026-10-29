import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { mollie, mollieKey, statusLabel, webhookBase, type MolliePayment } from "@/lib/mollie.server";
import { adjustmentFor, invoiceUpdateFor, subscriptionInterval, subscriptionStartDate, toCents, todayParis } from "@/lib/billing-webhook-rules";

/**
 * Webhook Mollie (analyse du 23 octobre) :
 * - Mollie n'envoie que l'identifiant du paiement ; son état est toujours relu auprès de Mollie ;
 * - chaque rappel peut être rejoué sans effet : un paiement ne crée qu'une facture et qu'un abonnement ;
 * - en cas d'échec d'écriture, on répond 500 pour que Mollie rappelle plus tard.
 */
const done = () => new Response(null, { status: 200 });
const retry = (what: string, err?: unknown) => {
  console.error(`[mollie-webhook] ${what}`, err ?? "");
  return new Response(null, { status: 500 });
};

async function createInvoice(admin: any, args: { userId: string; amountCents: number; paymentId: string }) {
  const { error } = await admin.rpc("create_invoice", {
    _user_id: args.userId,
    _kind: "Abonnement",
    _status: "Payée",
    _amount_cents: args.amountCents,
    _mollie_payment_id: args.paymentId,
  });
  // Seul un doublon sur le paiement Mollie signifie « facture déjà créée » (rappel) ; toute autre erreur est relancée.
  if (error && !(error.code === "23505" && String(error.message ?? "").includes("invoices_mollie_payment_id_key"))) return error;
  return null;
}

export const Route = createFileRoute("/api/public/mollie-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!mollieKey()) {
          console.warn("webhook Mollie ignoré : MOLLIE_API_KEY manquant");
          return done();
        }
        const parsed = z
          .object({ id: z.string().regex(/^tr_[A-Za-z0-9]+$/).max(64) })
          .safeParse(Object.fromEntries(await request.formData().catch(() => new FormData())));
        if (!parsed.success) return done();

        let payment: MolliePayment;
        try {
          payment = await mollie<MolliePayment>(`/payments/${parsed.data.id}`);
        } catch (err) {
          // Paiement inconnu de Mollie : rien à faire. Autre erreur : Mollie rappellera.
          if (String(err).includes("Mollie 404")) return done();
          return retry("paiement illisible", err);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;
        const status = statusLabel[payment.status] ?? "En attente";
        const paidCents = toCents(payment.amount.value);
        const meta = (payment.metadata ?? {}) as { invoice_id?: string; user_id?: string; kind?: string; plan?: string };

        // 0) Paiement encaissé puis remboursé (depuis Mollie) ou contesté (prélèvement SEPA rejeté par la banque) :
        //    la facture change de statut et l'équipe est alertée (« À surveiller »).
        const adjustment = adjustmentFor(payment);
        if (adjustment) {
          const { data: inv, error: invError } = await admin.from("invoices").select("id, user_id, status").eq("mollie_payment_id", payment.id).maybeSingle();
          if (invError) return retry("facture illisible", invError);
          if (inv) {
            if (inv.status !== adjustment.status) {
              const { error: updError } = await admin.from("invoices").update({ status: adjustment.status }).eq("id", inv.id);
              if (updError) return retry("statut de facture non mis à jour", updError);
            }
            const { data: known } = await admin.from("payment_failures").select("status, amount_cents").eq("mollie_payment_id", payment.id).maybeSingle();
            if (!known || known.status !== adjustment.status || known.amount_cents !== adjustment.cents) {
              const { error: watchError } = await admin.from("payment_failures").upsert(
                { user_id: inv.user_id, mollie_payment_id: payment.id, amount_cents: adjustment.cents, status: adjustment.status, resolved_at: null },
                { onConflict: "mollie_payment_id" },
              );
              if (watchError) return retry("remboursement ou contestation non enregistré", watchError);
            }
            return done();
          }
        }

        // 1) Paiement ponctuel d'une facture existante.
        if (meta.invoice_id) {
          const { data: invoice, error } = await admin.from("invoices").select("id, status, mollie_payment_id, amount_cents").eq("id", meta.invoice_id).maybeSingle();
          if (error) return retry("facture illisible", error);
          if (!invoice) return done();
          const decision = invoiceUpdateFor(invoice, payment.id, status, paidCents);
          if (!decision.apply) {
            if (decision.reason === "montant différent de la facture") console.error("[mollie-webhook] montant inattendu", payment.id, paidCents, invoice.amount_cents);
            return done();
          }
          const { error: updateError } = await admin
            .from("invoices")
            .update({ status, mollie_payment_id: payment.id })
            .eq("id", invoice.id)
            .neq("status", "Payée");
          if (updateError) return retry("mise à jour de facture impossible", updateError);
          return done();
        }

        // 2) Premier paiement réussi : abonnement récurrent, qui démarre une période plus tard.
        if (meta.kind === "mandate_first" && meta.user_id && payment.status === "paid" && payment.customerId) {
          const { data: plan, error: planError } = await admin.from("membership_plans").select("name, price_cents, period").eq("name", meta.plan ?? "").maybeSingle();
          if (planError || !plan) return retry("formule introuvable", planError ?? meta.plan);

          // Membre désactivé entre-temps : aucun abonnement ; l'équipe est alertée pour rembourser ce premier paiement.
          const { data: owner } = await admin.from("profiles").select("disabled_at").eq("id", meta.user_id).maybeSingle();
          if (owner?.disabled_at) {
            const { error: flagError } = await admin.from("payment_failures").upsert(
              { user_id: meta.user_id, mollie_payment_id: payment.id, amount_cents: paidCents, status: "Payé, compte désactivé" },
              { onConflict: "mollie_payment_id", ignoreDuplicates: true },
            );
            if (flagError) return retry("paiement d'un compte désactivé non signalé", flagError);
            return done();
          }

          // Réservation : un seul rappel crée l'abonnement, les suivants n'y touchent plus.
          const claim = `en_cours:${payment.id}`;
          const { data: claimed, error: claimError } = await admin
            .from("profiles")
            .update({ mollie_subscription_id: claim })
            .eq("id", meta.user_id)
            .is("mollie_subscription_id", null)
            .select("id")
            .maybeSingle();
          if (claimError) return retry("réservation de l'abonnement impossible", claimError);

          // Rappel après un essai interrompu : la réservation de ce même paiement est reprise.
          let resume = false;
          if (!claimed) {
            const { data: current } = await admin.from("profiles").select("mollie_subscription_id").eq("id", meta.user_id).maybeSingle();
            resume = current?.mollie_subscription_id === claim;
          }

          if (claimed || resume) {
            try {
              // Un abonnement déjà créé chez Mollie pour ce membre est retenu au lieu d'en créer un second.
              const existing = await mollie<{ _embedded?: { subscriptions?: Array<{ id: string; status: string; metadata?: { user_id?: string } }> } }>(`/customers/${payment.customerId}/subscriptions?limit=50`);
              const found = (existing._embedded?.subscriptions ?? []).find((s) => s.metadata?.user_id === meta.user_id && (s.status === "active" || s.status === "pending"));
              // Sans adresse de rappel, Mollie ne prévient pas l'application des échéances mensuelles (payées ou rejetées).
              const webhookUrl = `${webhookBase(request)}/api/public/mollie-webhook`;
              if (found) {
                await mollie(`/customers/${payment.customerId}/subscriptions/${found.id}`, { method: "PATCH", body: JSON.stringify({ webhookUrl }) });
              }
              const sub = found ?? await mollie<{ id: string }>(`/customers/${payment.customerId}/subscriptions`, {
                method: "POST",
                headers: { "Idempotency-Key": `adv-sub-${payment.id}` },
                body: JSON.stringify({
                  amount: { currency: "EUR", value: (plan.price_cents / 100).toFixed(2) },
                  interval: subscriptionInterval(plan.period),
                  startDate: subscriptionStartDate(todayParis(), plan.period),
                  description: `Art de Vie — Formule ${plan.name}`,
                  webhookUrl,
                  metadata: { user_id: meta.user_id, kind: "subscription_charge" },
                }),
              });
              const { error: saveError } = await admin.from("profiles").update({ mollie_subscription_id: sub.id }).eq("id", meta.user_id).eq("mollie_subscription_id", claim);
              if (saveError) console.error("[mollie-webhook] abonnement créé mais non enregistré", sub.id, saveError);
              // Désactivation survenue pendant la création : l'abonnement est aussitôt arrêté.
              const { data: after } = await admin.from("profiles").select("disabled_at").eq("id", meta.user_id).maybeSingle();
              if (after?.disabled_at) {
                await mollie(`/customers/${payment.customerId}/subscriptions/${sub.id}`, { method: "DELETE" }).catch((e: unknown) => console.error("[mollie-webhook] abonnement d'un compte désactivé non arrêté", sub.id, e));
                await admin.from("profiles").update({ mollie_subscription_id: null }).eq("id", meta.user_id).eq("mollie_subscription_id", sub.id);
              }
            } catch (err) {
              await admin.from("profiles").update({ mollie_subscription_id: null }).eq("id", meta.user_id).eq("mollie_subscription_id", claim);
              return retry("création de l'abonnement impossible", err);
            }
          }
          const invoiceError = await createInvoice(admin, { userId: meta.user_id, amountCents: paidCents, paymentId: payment.id });
          if (invoiceError) return retry("facture du premier paiement non créée", invoiceError);
          return done();
        }

        // 3 bis) Échéance d'abonnement rejetée : gardée pour l'équipe (« À surveiller »), sans facture.
        if (payment.subscriptionId && ["failed", "expired", "canceled"].includes(payment.status) && payment.customerId) {
          let userId = meta.user_id ?? null;
          if (!userId) {
            const { data: p } = await admin.from("profiles").select("id").eq("mollie_customer_id", payment.customerId).maybeSingle();
            userId = p?.id ?? null;
          }
          const { error } = await admin.from("payment_failures").upsert(
            { user_id: userId, mollie_payment_id: payment.id, amount_cents: paidCents, status },
            { onConflict: "mollie_payment_id", ignoreDuplicates: true },
          );
          if (error) return retry("échec de prélèvement non enregistré", error);
          return done();
        }

        // 3) Échéance d'abonnement prélevée : une facture par paiement.
        if (payment.subscriptionId && payment.status === "paid" && payment.customerId) {
          let userId = meta.user_id ?? null;
          if (!userId) {
            const { data: p, error } = await admin.from("profiles").select("id").eq("mollie_customer_id", payment.customerId).maybeSingle();
            if (error) return retry("membre illisible", error);
            userId = p?.id ?? null;
          }
          if (!userId) {
            console.error("[mollie-webhook] échéance sans membre", payment.id);
            return done();
          }
          const invoiceError = await createInvoice(admin, { userId, amountCents: paidCents, paymentId: payment.id });
          if (invoiceError) return retry("facture d'échéance non créée", invoiceError);
        }
        return done();
      },
    },
  },
});
