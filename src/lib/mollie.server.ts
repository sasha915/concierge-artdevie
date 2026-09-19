// Helpers Mollie (API REST directe). À n'importer que côté serveur.
const API = "https://api.mollie.com/v2";

export type MolliePayment = {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  sequenceType?: string;
  customerId?: string;
  subscriptionId?: string;
  mandateId?: string;
  metadata?: Record<string, unknown>;
  _links?: { checkout?: { href: string } };
};

export function mollieKey(): string | null {
  return process.env["MOLLIE_API_KEY"] || null;
}

export async function mollie<T>(path: string, init?: RequestInit): Promise<T> {
  const key = mollieKey();
  if (!key) throw new Error("MOLLIE_API_KEY manquant");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Mollie ${res.status} ${path}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export const euro = (cents: number) => (cents / 100).toFixed(2);

export function publicBase(request: Request): string {
  return request.headers.get("origin") ?? new URL(request.url).origin;
}

// Statuts Mollie → libellé affiché en facturation
export const statusLabel: Record<string, string> = {
  paid: "Payée",
  open: "En attente",
  pending: "En attente",
  authorized: "En attente",
  canceled: "Échouée",
  failed: "Échouée",
  expired: "Expirée",
};
