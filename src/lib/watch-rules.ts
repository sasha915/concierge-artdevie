import { todayParis } from "./billing-webhook-rules";
/** Règles du bloc « À surveiller » (lot 4.3) — pures et testées. */

/** Une demande Nouvelle sans prise en charge au-delà de ce délai est signalée. */
export const STALE_REQUEST_HOURS = 6;
/** Adhésions dont l'échéance tombe dans ce nombre de jours. */
export const RENEWAL_WINDOW_DAYS = 30;
/** Statuts de facture considérés comme un échec de paiement. */
export const FAILED_INVOICE_STATUSES = ["Échouée", "Expirée"] as const;

export function hoursSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 3_600_000);
}

export function isStaleRequest(r: { status: string; created_at: string }, now: Date = new Date()): boolean {
  return r.status === "Nouvelle" && hoursSince(r.created_at, now) >= STALE_REQUEST_HOURS;
}

/** « 7 h », « 2 j » : durée d'attente lisible. */
export function waitingLabel(iso: string, now: Date = new Date()): string {
  const h = Math.floor(hoursSince(iso, now));
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} j`;
}

/** Jour à Paris (et non en temps universel) : juste entre minuit et deux heures du matin. */
function isoDay(d: Date): string {
  return todayParis(d);
}

/** Échéance comprise entre aujourd'hui et aujourd'hui + RENEWAL_WINDOW_DAYS (incluses). */
export function isRenewalDue(validUntil: string | null | undefined, now: Date = new Date()): boolean {
  if (!validUntil) return false;
  const today = isoDay(now);
  const limit = isoDay(new Date(now.getTime() + RENEWAL_WINDOW_DAYS * 86_400_000));
  return validUntil >= today && validUntil <= limit;
}

export function isFailedInvoice(status: string): boolean {
  return (FAILED_INVOICE_STATUSES as readonly string[]).includes(status);
}

/** Raison d'une alerte WhatsApp non partie, en clair pour l'équipe. */
export function notificationFailureLabel(reason: string): string {
  const [code, status] = reason.split(":");
  switch (code) {
    case "missing_recipient": return "Aucun numéro WhatsApp";
    case "missing_WHATSAPP_API_TOKEN":
    case "missing_WHATSAPP_PHONE_NUMBER_ID": return "WhatsApp non configuré";
    case "adresse_ou_secret_absent": return "Alerte non configurée";
    case "whatsapp_api_error": return status ? `Refusée par WhatsApp (${status})` : "Refusée par WhatsApp";
    case "whatsapp_fetch_failed": return "WhatsApp injoignable";
    case "profile_not_found": return "Membre introuvable";
    default: return "Envoi impossible";
  }
}
