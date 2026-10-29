/**
 * Accès de l'équipe (29 octobre) : uniquement par le compte Google Workspace professionnel (@artdevie.co).
 * Règles pures, partagées par le serveur et l'écran « Accès équipe ».
 */
export const TEAM_EMAIL_DOMAIN = "artdevie.co";
/** Une connexion Google ouvre l'espace équipe si elle date de moins de ce délai. */
export const TEAM_SIGNIN_FRESH_MINUTES = 15;

export function isTeamEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase().endsWith(`@${TEAM_EMAIL_DOMAIN}`);
}

type Claims = { email?: unknown; amr?: unknown };

/**
 * Raison du refus, ou null si la session vient d'une connexion Google récente avec une adresse @artdevie.co.
 * Une session ouverte par mot de passe n'ouvre jamais l'espace équipe.
 */
export function teamSessionIssue(claims: Claims, now: Date = new Date()): "adresse_non_professionnelle" | "connexion_google_requise" | "connexion_ancienne" | null {
  if (!isTeamEmail(typeof claims.email === "string" ? claims.email : null)) return "adresse_non_professionnelle";
  const amr = Array.isArray(claims.amr) ? (claims.amr as Array<{ method?: string; timestamp?: number }>) : [];
  const google = amr.filter((a) => a.method === "oauth" || a.method === "id_token" || a.method === "sso/saml");
  if (google.length === 0) return "connexion_google_requise";
  const latest = Math.max(...google.map((a) => Number(a.timestamp ?? 0)));
  if (now.getTime() / 1000 - latest > TEAM_SIGNIN_FRESH_MINUTES * 60) return "connexion_ancienne";
  return null;
}
