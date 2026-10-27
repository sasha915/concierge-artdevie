/**
 * Ordre d'affichage des demandes du membre (maquette V4) :
 * 1. demandes actives (Nouvelle, En cours, Confirmée) : les prochaines d'abord, par date croissante,
 *    puis celles sans date, puis celles dont la date est passée (la plus récente d'abord) ;
 * 2. demandes terminées, la plus récente d'abord ;
 * 3. demandes annulées, en dernier.
 * La première demande active est celle que l'accueil et « Mes demandes » mettent en avant.
 */
type Sortable = { status: string; scheduled_date: string | null; created_at?: string };

const ACTIVE = new Set(["Nouvelle", "En cours", "Confirmée"]);

export function isActiveRequest(r: Pick<Sortable, "status">): boolean {
  return ACTIVE.has(r.status);
}

function rank(r: Sortable, today: string): number {
  if (isActiveRequest(r)) {
    if (!r.scheduled_date) return 1;
    return r.scheduled_date >= today ? 0 : 2;
  }
  return r.status === "Annulée" ? 4 : 3;
}

export function orderForDisplay<T extends Sortable>(requests: readonly T[], today: string): T[] {
  return [...requests].sort((a, b) => {
    const ra = rank(a, today);
    const rb = rank(b, today);
    if (ra !== rb) return ra - rb;
    const da = a.scheduled_date ?? a.created_at?.slice(0, 10) ?? "";
    const db = b.scheduled_date ?? b.created_at?.slice(0, 10) ?? "";
    // Prochaines demandes : la plus proche d'abord ; passées, terminées, annulées : la plus récente d'abord.
    return ra === 0 || ra === 1 ? da.localeCompare(db) : db.localeCompare(da);
  });
}

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function todayInParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
