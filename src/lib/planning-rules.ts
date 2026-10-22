/** Règles des lots 6.1 et 6.2 : proposition à valider, demandes récurrentes. Pures et testées. */

// ---- Proposition ----
const NUMBERS = ["Zéro", "Une", "Deux", "Trois", "Quatre", "Cinq", "Six"];

/** « Deux options vous attendent. » — nombre réel, en toutes lettres jusqu'à six. */
export function proposalBanner(count: number): string {
  if (count <= 1) return "Une option vous attend.";
  return `${NUMBERS[count] ?? String(count)} options vous attendent.`;
}

export const MAX_PROPOSAL_OPTIONS = 6;

// ---- Récurrence ----
export const RHYTHMS = [
  { value: "aucune", label: "Une seule fois" },
  { value: "hebdomadaire", label: "Chaque semaine" },
  { value: "mensuelle", label: "Chaque mois" },
  { value: "dates", label: "À des dates choisies" },
] as const;
export type Rhythm = "hebdomadaire" | "mensuelle" | "dates";

export function rhythmLabel(r: string): string {
  return RHYTHMS.find((x) => x.value === r)?.label ?? r;
}

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(isoDate: string, days: number): string {
  const d = parse(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}
/** Même jour du mois, ramené au dernier jour du mois si besoin — comme en base (31 janvier → 28 ou 29 février). */
export function addMonths(isoDate: string, months: number): string {
  const d = parse(isoDate);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return iso(target);
}

export type RecurringRule = { rhythm: string; start_date: string | null; dates: string[]; end_date: string | null; last_occurrence: string | null };

/** Prochaine échéance non encore créée, à partir d'aujourd'hui ; null si la série est terminée. */
export function nextOccurrence(rule: RecurringRule, today: string): string | null {
  const after = rule.last_occurrence && rule.last_occurrence >= today ? rule.last_occurrence : addDays(today, -1);
  let candidate: string | null = null;
  if (rule.rhythm === "dates") {
    candidate = [...rule.dates].sort().find((d) => d > after) ?? null;
  } else if (rule.start_date) {
    if (rule.rhythm === "hebdomadaire") {
      let d = rule.start_date;
      if (d <= after) {
        const weeks = Math.floor((parse(after).getTime() - parse(d).getTime()) / (7 * 86_400_000)) + 1;
        d = addDays(d, weeks * 7);
      }
      candidate = d;
    } else if (rule.rhythm === "mensuelle") {
      for (let k = 0; k < 1200; k++) {
        const d = addMonths(rule.start_date, k);
        if (d > after) { candidate = d; break; }
      }
    }
  }
  if (candidate && rule.end_date && candidate > rule.end_date) return null;
  return candidate;
}

/** Date à laquelle la demande de cette échéance sera créée (sept jours avant). */
export function creationDate(occurrence: string): string {
  return addDays(occurrence, -7);
}

/** Surtitre d'une série : « Chaque mardi », « Chaque mois », « À des dates choisies » (clé de traduction + jour). */
export function rhythmEyebrow(rule: { rhythm: string; start_date: string | null }): { key: string; day?: number } {
  if (rule.rhythm === "hebdomadaire" && rule.start_date) return { key: "Chaque {day}", day: new Date(`${rule.start_date}T12:00:00Z`).getUTCDay() };
  return { key: rhythmLabel(rule.rhythm) };
}

/** Titre de l'avis selon la catégorie : « Comment s'est passée votre soirée ? ». Paire début|fin italique. */
export const REVIEW_TITLES: Record<string, [string, string]> = {
  Tables: ["Comment s’est passée votre", "soirée ?"],
  "Séjours": ["Comment s’est passé votre", "séjour ?"],
  Transferts: ["Comment s’est passé votre", "trajet ?"],
  Soins: ["Comment s’est passé votre", "soin ?"],
};
export const DEFAULT_REVIEW_TITLE: [string, string] = ["Comment s’est passée votre", "prestation ?"];
