/**
 * Adresse de l'application pour les liens envoyés (e-mails, retour de paiement, webhook Mollie).
 * L'en-tête Origin n'est retenu que s'il désigne l'adresse de production ou l'un des aperçus de CE projet Lovable ;
 * sinon, l'adresse de production (décision du 29 octobre : app.artdevie.co).
 */
export const DEFAULT_APP_ORIGIN = "https://app.artdevie.co";

const PROJECT_ID = "41b1075b-2b17-4a5b-8120-aca5edc05f47";

const ALLOWED = [
  /^https:\/\/app\.artdevie\.co$/i,
  // Aperçus Lovable de ce projet uniquement (id-preview--…, project--…-dev, …lovableproject.com).
  new RegExp(`^https:\\/\\/([a-z0-9-]+--)?${PROJECT_ID}(-dev)?\\.lovable\\.app$`, "i"),
  new RegExp(`^https:\\/\\/${PROJECT_ID}\\.lovableproject\\.com$`, "i"),
];

// Poste de développement : accepté hors production uniquement.
const DEV_ONLY = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const isProduction = typeof process !== "undefined" && process.env?.["NODE_ENV"] === "production";

export function trustedOrigin(origin: string | null | undefined): string {
  const value = (origin ?? "").replace(/\/+$/, "");
  if (ALLOWED.some((re) => re.test(value))) return value;
  if (!isProduction && DEV_ONLY.test(value)) return value;
  return DEFAULT_APP_ORIGIN;
}
