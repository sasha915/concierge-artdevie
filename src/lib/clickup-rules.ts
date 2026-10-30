/**
 * Liaison ClickUp (30 octobre, décision de Sasha) : l'application est la source de vérité ; elle crée et tient à jour
 * Conciergerie > Fiches clients (une fiche par membre) et Conciergerie > Demandes Clients (une tâche par demande).
 * Seuls les champs dont la valeur a changé dans l'app sont réécrits : ce que l'équipe saisit dans ClickUp
 * (allergies, coût prestataire, motif de clôture, notes…) n'est jamais écrasé.
 */

export const CLICKUP = {
  workspaceId: "90151723327",
  lists: { fiches: "1200750000004753", demandes: "901517729805" },
  fiche: {
    formule: "b49259a9-3d3c-4ea8-9761-ec5b11c80992",
    conciergeReferent: "08f50bf7-6cce-4917-852d-91811e6a4d8b",
  },
  demande: {
    canal: "012f1760-b97a-4f30-896a-134dccfc5a6f",
    typePrestation: "46e28114-dc5f-4da5-a728-b3fea6b7a33e",
    datePrestation: "889a1f61-8cc1-4508-896a-a17ec6bc409a",
    ficheClient: "e6b8ade3-31c4-4a13-9688-eb9e839fee28",
    formule: "b49259a9-3d3c-4ea8-9761-ec5b11c80992",
    montantSigne: "6bf5b4cb-c57e-401f-9c5b-476100cbe8e0",
    montantPaye: "cf61c293-b3d6-4b59-bb21-d6e79e30803b",
    statutPaiement: "9ef2a5ef-bfa9-4d54-8bed-695d8e1a0f54",
    noteSatisfaction: "22e897fe-208f-41e1-8a97-39058fa39cb9",
    commentaires: "0eaa0ba0-0dd2-447a-929d-ea7cb2800333",
  },
  options: {
    formule: { Essentiel: "51911450-8343-431d-8091-f50ac9201bbf", Signature: "be1b477e-11bf-456d-9644-d94592c5c4b7" } as Record<string, string>,
    canalApplication: "3e68dec8-1595-4708-946f-c491d7916b61",
    typePrestation: {
      Tables: "c3333fcb-8114-4e67-957c-85f690e9ca08",
      Culture: "c3333fcb-8114-4e67-957c-85f690e9ca08",
      "Séjours": "afe6533a-c14e-42e8-8c52-175d5c7fc6c0",
      Transferts: "d5542b06-732f-4c42-bad5-0d6a08867f93",
      Soins: "a73c18c7-9c67-41c8-88a9-2ae513a2b43b",
      "Sur mesure": "a73c18c7-9c67-41c8-88a9-2ae513a2b43b",
    } as Record<string, string>,
    paiement: { nonPaye: "5b39ba88-3287-4e91-8bed-65b5166eb524", paye: "2cdd5e78-9b83-4160-aa35-c5b59c74931c" },
  },
} as const;

/** Statut de la demande dans l'app → statut de la liste Demandes Clients. */
export function demandeStatus(status: string, proposalPending: boolean): string {
  switch (status) {
    case "Nouvelle": return "demande reçue";
    case "En cours": return proposalPending ? "proposition envoyée" : "en préparation";
    case "Confirmée": return "confirmé";
    case "Terminée": return "livré";
    case "Annulée": return "clôturé";
    default: return "demande reçue";
  }
}

/** Fiche client : désactivé → « ancien client », sinon « actif » (« en pause » reste un choix manuel dans ClickUp). */
export function ficheStatus(disabledAt: string | null): string {
  return disabledAt ? "ancien client" : "actif";
}

export const RATING_STARS: Record<string, number> = { Parfaite: 5, Bien: 4, "À revoir": 2 };

/** Comparaison de noms sans accents, casse ni espaces multiples (rapprochement avec une fiche existante). */
export function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Identifiant de tâche à partir d'un identifiant ou d'un lien ClickUp (…/t/86c9w38j3 ou …/t/90151723327/86c9w38j3). */
export function parseClickupTaskId(input: string): string | null {
  const s = input.trim();
  const fromUrl = /\/t\/(?:\d+\/)?([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/.exec(s)?.[1];
  const id = fromUrl ?? s;
  return /^[A-Za-z0-9_-]{6,40}$/.test(id) ? id : null;
}

/** Date de prestation : jour et heure du lieu, envoyés à midi UTC si l'heure n'est pas lisible (le jour reste juste partout). */
export function prestationTimestamp(date: string | null, time: string | null): { value: number; time: boolean } | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const m = /(\d{1,2})\s*[h:H]\s*(\d{2})?/.exec(time ?? "");
  const h = m ? Number(m[1]) : NaN;
  const min = m?.[2] ? Number(m[2]) : 0;
  if (m && h <= 23 && min <= 59) {
    // Heure du lieu, lue comme heure de Paris (fuseau de travail de l'équipe dans ClickUp).
    const utcGuess = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h, min);
    return { value: utcGuess - parisOffsetMinutes(utcGuess) * 60000, time: true };
  }
  return { value: Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), 12, 0), time: false };
}

function parisOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - utcMs) / 60000);
}

/** Valeurs suivies d'une demande ; seules celles qui diffèrent du dernier envoi sont réécrites. */
export type DemandeValues = {
  name: string;
  status: string;
  description: string;
  type: string | null;
  date: { value: number; time: boolean } | null;
  formule: string | null;
  montantSigne: number | null;
  montantPaye: number | null;
  paiement: string | null;
  note: number | null;
  commentaire: string | null;
  assignee: number | null;
  fiche: string | null;
};

export type FicheValues = {
  name: string;
  status: string;
  formule: string | null;
  concierge: number | null;
};

/** Champs à réécrire : ceux qui n'ont jamais été envoyés ou dont la valeur a changé depuis le dernier envoi. */
export function changedKeys<T extends Record<string, unknown>>(next: T, previous: Partial<T> | null | undefined): Array<keyof T> {
  const prev = (previous ?? {}) as Partial<T>;
  return (Object.keys(next) as Array<keyof T>).filter((k) => !(k in prev) || JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
}

/** Attente avant un nouvel essai : 1, 2, 4… minutes, plafonnée à une heure. */
export function retryDelayMinutes(attempts: number): number {
  return Math.min(60, 2 ** Math.max(0, attempts - 1));
}

/** Nombre d'échecs à partir duquel l'équipe est prévenue dans « À surveiller ». */
export const ALERT_AFTER_ATTEMPTS = 6;
