/** Règles du lot 6.4 : questionnaire d'accueil et relevé mensuel. Pures et testées. */

// ---- Questionnaire « Faisons connaissance. » (aucune question de santé) ----
export const WELCOME_STEPS = [
  {
    key: "tables_choix",
    eyebrow: "À table",
    question: "Quelles tables vous ressemblent ?",
    options: ["Tables gastronomiques", "Adresses de quartier", "Cuisine japonaise", "Cuisine italienne", "Cuisine méditerranéenne", "Terrasses et toits", "Salons privés", "Tables animées, en musique"],
  },
  {
    key: "sejours_choix",
    eyebrow: "En voyage",
    question: "Comment aimez-vous séjourner ?",
    options: ["Palaces et grands hôtels", "Hôtels de charme", "Villas et maisons privées", "Bord de mer", "Montagne", "Grandes villes", "Week-ends courts", "Longs séjours"],
  },
  {
    key: "transferts_choix",
    eyebrow: "En déplacement",
    question: "Comment préférez-vous vous déplacer ?",
    options: ["Chauffeur privé", "Berline", "Van pour un groupe", "Accueil à l’aéroport", "Train en première classe", "Aviation privée", "Hélicoptère", "En toute discrétion"],
  },
] as const;

export type WelcomeKey = (typeof WELCOME_STEPS)[number]["key"];
export type WelcomeAnswers = Record<WelcomeKey, string[]> & { dates_membre: string };

export const EMPTY_ANSWERS: WelcomeAnswers = { tables_choix: [], sejours_choix: [], transferts_choix: [], dates_membre: "" };

/** Ne garde que les options proposées, sans doublon, dans l'ordre de la liste. */
export function cleanChoices(key: WelcomeKey, values: string[]): string[] {
  const options = WELCOME_STEPS.find((s) => s.key === key)?.options ?? [];
  return options.filter((o) => values.includes(o));
}

// ---- Relevé ----
export const STATEMENT_STATUSES = ["Confirmée", "Terminée"] as const;

export type StatementSource = { id: string; title: string; status: string; amount_cents: number | null; scheduled_date: string | null; created_at: string };
export type StatementLine = { id: string; title: string; date: string; amount_cents: number };

/** Date retenue pour le relevé : celle de la prestation, sinon celle de la demande. */
export function statementDate(r: StatementSource): string {
  return r.scheduled_date ?? r.created_at.slice(0, 10);
}

/** Prestations Confirmées ou Terminées, dotées d'un montant, datées du mois (AAAA-MM). */
export function statementLines(rows: StatementSource[], month: string): StatementLine[] {
  return rows
    .filter((r) => (STATEMENT_STATUSES as readonly string[]).includes(r.status) && r.amount_cents !== null && statementDate(r).startsWith(month))
    .map((r) => ({ id: r.id, title: r.title, date: statementDate(r), amount_cents: r.amount_cents as number }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function statementTotal(lines: StatementLine[]): number {
  return lines.reduce((sum, l) => sum + l.amount_cents, 0);
}

/** « 2026-10 » → « 2026-09 » / « 2026-11 ». */
export function shiftMonth(month: string, delta: number): string {
  const [y = 1970, m = 1] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  const label = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
