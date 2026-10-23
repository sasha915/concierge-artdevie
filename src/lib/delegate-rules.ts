// Lot 5.4 : règles des proches autorisés, partagées par le client, le serveur et les tests.

/** Nombre maximal de proches par membre (invitations en attente et accès actifs). */
export const MAX_DELEGATES = 3;

export type DelegateStatus = "en_attente" | "actif" | "refuse" | "retire";

export const DELEGATE_STATUS_LABEL: Record<DelegateStatus, string> = {
  en_attente: "En attente de confirmation",
  actif: "Accès actif",
  refuse: "Non retenu",
  retire: "Accès retiré",
};

export function delegateStatusLabel(status: string): string {
  return DELEGATE_STATUS_LABEL[status as DelegateStatus] ?? status;
}

/** Une place est occupée par une invitation en attente ou un accès actif. */
export function openDelegates<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((r) => r.status === "en_attente" || r.status === "actif");
}

export function canInviteDelegate(rows: Array<{ status: string }>): boolean {
  return openDelegates(rows).length < MAX_DELEGATES;
}

/**
 * Écrans ouverts à un proche : l'accueil, la liste de ses demandes, la création d'une demande
 * et le suivi d'une demande. Tout le reste (Membership, factures, offres, propositions,
 * modifications, récurrences, interface équipe) lui est fermé.
 */
export function isDelegatePathAllowed(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/demandes" || path === "/demandes/nouvelle") return true;
  return /^\/demandes\/[0-9a-f-]{36}$/i.test(path);
}

/** Prénom affiché (« Demandée par Léa »). */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}
