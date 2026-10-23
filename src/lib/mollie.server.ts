// Helpers Mollie (API REST directe). À n'importer que côté serveur.
const API = "https://api.mollie.com/v2";

export type MolliePayment = {
  id: string;
  status: string;
  amount: { value: string; currency: string };
  description?: string;
  createdAt?: string;
  method?: string | null;
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

import { DEFAULT_APP_ORIGIN, trustedOrigin } from "./app-origin";

/** Adresse de retour après paiement : seulement l'un de nos domaines. */
export function publicBase(request: Request): string {
  return trustedOrigin(request.headers.get("origin") ?? new URL(request.url).origin);
}

// Mollie doit pouvoir joindre le webhook : en local, on pointe vers l'URL publique stable du projet.
export function webhookBase(request: Request): string {
  const base = publicBase(request);
  return /^https?:\/\/(localhost|127\.0\.0\.1)/.test(base) ? DEFAULT_APP_ORIGIN : base;
}

/** Mode du compte Mollie, d'après le préfixe de la clé. */
export function mollieMode(): "test" | "live" | null {
  const key = mollieKey();
  if (!key) return null;
  return key.startsWith("live_") ? "live" : "test";
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
