/**
 * Adresse de l'application pour les liens envoyés (e-mails, retour de paiement).
 * L'en-tête Origin n'est retenu que s'il désigne l'un de nos domaines ; sinon, l'adresse par défaut.
 */
export const DEFAULT_APP_ORIGIN = "https://project--41b1075b-2b17-4a5b-8120-aca5edc05f47-dev.lovable.app";

const ALLOWED = [
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/i,
  /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/i,
  /^https:\/\/([a-z0-9-]+\.)*artdevie\.co$/i,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i,
];

export function trustedOrigin(origin: string | null | undefined): string {
  const value = (origin ?? "").replace(/\/+$/, "");
  return ALLOWED.some((re) => re.test(value)) ? value : DEFAULT_APP_ORIGIN;
}
