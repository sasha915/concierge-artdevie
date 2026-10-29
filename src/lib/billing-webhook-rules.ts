// Règles du webhook Mollie, isolées pour être testées (analyse du 23 octobre).

export type InvoiceState = { status: string; mollie_payment_id: string | null; amount_cents: number };

/**
 * Faut-il appliquer le statut d'un paiement à une facture ?
 * - un paiement qui n'est plus celui de la facture (ancien lien) est ignoré ;
 * - une facture payée ne redescend jamais ;
 * - un paiement « payé » d'un montant différent n'est pas retenu.
 */
export function invoiceUpdateFor(invoice: InvoiceState, paymentId: string, newStatus: string, paidCents: number): { apply: boolean; reason?: string } {
  if (invoice.status === "Payée") return { apply: false, reason: "facture déjà payée" };
  if (newStatus === "Payée" && paidCents !== invoice.amount_cents) return { apply: false, reason: "montant différent de la facture" };
  // Un paiement encaissé l'emporte toujours, même s'il venait d'un lien plus ancien ; un échec d'ancien lien est ignoré.
  if (newStatus !== "Payée" && invoice.mollie_payment_id && invoice.mollie_payment_id !== paymentId) return { apply: false, reason: "paiement remplacé par un lien plus récent" };
  if (newStatus === invoice.status) return { apply: false, reason: "statut inchangé" };
  return { apply: true };
}

/** Intervalle Mollie d'une formule. */
export function subscriptionInterval(period: string): "12 months" | "1 month" {
  return period === "an" ? "12 months" : "1 month";
}

/**
 * Date du premier prélèvement de l'abonnement : une période après le premier paiement,
 * qui couvre déjà la période en cours (sinon le membre paierait deux fois le même jour).
 */
export function subscriptionStartDate(paidOn: string, period: string): string {
  const [y, m, d] = paidOn.split("-").map(Number) as [number, number, number];
  const months = period === "an" ? 12 : 1;
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Montant Mollie (« 1490.00 ») en centimes, sans erreur d'arrondi. */
export function toCents(value: string): number {
  const [euros = "0", cents = ""] = value.split(".");
  return Number(euros) * 100 + Number((cents + "00").slice(0, 2));
}

/** Date du jour à Paris (AAAA-MM-JJ). */
export function todayParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Statuts posés sur une facture après encaissement : remboursement depuis Mollie, ou prélèvement contesté par la banque du membre. */
export const ADJUSTED_INVOICE_STATUSES = ["Remboursée", "Remboursée en partie", "Contestée"] as const;

/**
 * Paiement encaissé puis remboursé ou contesté : statut de la facture et montant concerné.
 * Une contestation l'emporte sur un remboursement. null si le paiement n'a ni l'un ni l'autre.
 */
export function adjustmentFor(p: { status: string; amount: { value: string }; amountRefunded?: { value: string } | undefined; amountChargedBack?: { value: string } | undefined }): { status: (typeof ADJUSTED_INVOICE_STATUSES)[number]; cents: number } | null {
  if (p.status !== "paid") return null;
  const total = toCents(p.amount.value);
  const chargedBack = p.amountChargedBack ? toCents(p.amountChargedBack.value) : 0;
  if (chargedBack > 0) return { status: "Contestée", cents: chargedBack };
  const refunded = p.amountRefunded ? toCents(p.amountRefunded.value) : 0;
  if (refunded <= 0) return null;
  return { status: refunded >= total ? "Remboursée" : "Remboursée en partie", cents: refunded };
}
