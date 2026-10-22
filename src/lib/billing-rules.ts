/** Règles de facturation d'une prestation (lot 4.2) — pures, testées, partagées serveur et écran. */

export const COMMISSION_RATES: Record<string, number> = { Essentiel: 0.1, Signature: 0 };

export function commissionRate(plan: string | null | undefined): number {
  return COMMISSION_RATES[plan ?? ""] ?? 0;
}

export type Breakdown = { service_cents: number; commission_rate: number; commission_cents: number; total_cents: number };

/** Prestation + commission selon la formule ; la commission est arrondie au centime. */
export function invoiceBreakdown(serviceCents: number, plan: string | null | undefined): Breakdown {
  const rate = commissionRate(plan);
  const commission = Math.round(serviceCents * rate);
  return { service_cents: serviceCents, commission_rate: rate, commission_cents: commission, total_cents: serviceCents + commission };
}

/** « 1 250,50 », « 1250.5 », « 1 250 € » → 125050 centimes ; null si vide ou invalide. */
export function parseEuros(input: string): number | null {
  const cleaned = input.replace(/[\s  €]/g, "").replace(",", ".");
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return Number.isSafeInteger(cents) && cents <= 100_000_000 ? cents : null;
}

/** Valeur à afficher dans le champ de saisie, sans symbole : 125050 → « 1250,50 ». */
export function eurosInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
}

export function ratePercent(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}
