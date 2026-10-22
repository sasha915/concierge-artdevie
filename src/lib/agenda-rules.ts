/** Règles du lot 6.3 : agenda de l'équipe. Pures et testées. */
import { addMonths, type RecurringRule } from "./planning-rules";

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(isoDate: string, days: number): string {
  const d = parse(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}
/** Lundi de la semaine qui contient cette date. */
export function startOfWeek(isoDate: string): string {
  const day = (parse(isoDate).getUTCDay() + 6) % 7;
  return addDays(isoDate, -day);
}
export function startOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}
/** Semaines (lundi → dimanche) qui couvrent le mois de cette date. */
export function monthGrid(isoDate: string): string[][] {
  const first = startOfMonth(isoDate);
  const last = addDays(addMonths(first, 1), -1);
  const weeks: string[][] = [];
  for (let d = startOfWeek(first); d <= last; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  }
  return weeks;
}
export function weekDays(isoDate: string): string[] {
  const monday = startOfWeek(isoDate);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Échéances d'une série comprises entre from et to (inclus), postérieures à la dernière demande déjà créée. */
export function occurrencesBetween(rule: RecurringRule & { paused?: boolean }, from: string, to: string): string[] {
  if (rule.paused) return [];
  const after = rule.last_occurrence ?? "0000-00-00";
  const ok = (d: string) => d > after && d >= from && d <= to && (!rule.end_date || d <= rule.end_date);
  if (rule.rhythm === "dates") return [...rule.dates].sort().filter(ok);
  if (!rule.start_date) return [];
  const out: string[] = [];
  if (rule.rhythm === "hebdomadaire") {
    let d = rule.start_date;
    if (d < from) d = addDays(d, Math.floor((parse(from).getTime() - parse(d).getTime()) / (7 * 86_400_000)) * 7);
    for (; d <= to; d = addDays(d, 7)) if (ok(d)) out.push(d);
  } else if (rule.rhythm === "mensuelle") {
    for (let k = 0; k < 1200; k++) {
      const d = addMonths(rule.start_date, k);
      if (d > to) break;
      if (ok(d)) out.push(d);
    }
  }
  return out;
}
