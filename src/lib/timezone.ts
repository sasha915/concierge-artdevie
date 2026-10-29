/**
 * Fuseau horaire de l'espace membre (29 octobre) : les horodatages (messages, demande reçue, notifications)
 * et la date du jour suivent la ville du membre ; l'heure d'une prestation reste celle du lieu, saisie telle quelle.
 * L'interface équipe reste à l'heure de Paris.
 */
export const DEFAULT_TIMEZONE = "Europe/Paris";

/** Villes proposées, présentées dans la langue du membre. */
export const TIMEZONES: ReadonlyArray<{ id: string; fr: string; en: string }> = [
  { id: "Europe/Paris", fr: "Paris", en: "Paris" },
  { id: "Europe/London", fr: "Londres", en: "London" },
  { id: "Europe/Lisbon", fr: "Lisbonne", en: "Lisbon" },
  { id: "Europe/Madrid", fr: "Madrid, Barcelone, Marbella", en: "Madrid, Barcelona, Marbella" },
  { id: "Europe/Monaco", fr: "Monaco", en: "Monaco" },
  { id: "Europe/Zurich", fr: "Genève, Zurich", en: "Geneva, Zurich" },
  { id: "Europe/Rome", fr: "Rome, Milan", en: "Rome, Milan" },
  { id: "Europe/Athens", fr: "Athènes, Mykonos", en: "Athens, Mykonos" },
  { id: "Europe/Istanbul", fr: "Istanbul", en: "Istanbul" },
  { id: "Africa/Casablanca", fr: "Marrakech, Casablanca", en: "Marrakech, Casablanca" },
  { id: "Africa/Lagos", fr: "Lagos", en: "Lagos" },
  { id: "Africa/Johannesburg", fr: "Johannesburg", en: "Johannesburg" },
  { id: "Asia/Dubai", fr: "Dubaï, Abou Dabi", en: "Dubai, Abu Dhabi" },
  { id: "Asia/Qatar", fr: "Doha", en: "Doha" },
  { id: "Asia/Riyadh", fr: "Riyad", en: "Riyadh" },
  { id: "Asia/Singapore", fr: "Singapour", en: "Singapore" },
  { id: "Asia/Hong_Kong", fr: "Hong Kong", en: "Hong Kong" },
  { id: "Asia/Tokyo", fr: "Tokyo", en: "Tokyo" },
  { id: "Australia/Sydney", fr: "Sydney", en: "Sydney" },
  { id: "America/New_York", fr: "New York, Miami", en: "New York, Miami" },
  { id: "America/Toronto", fr: "Montréal, Toronto", en: "Montreal, Toronto" },
  { id: "America/Chicago", fr: "Chicago, Houston", en: "Chicago, Houston" },
  { id: "America/Los_Angeles", fr: "Los Angeles", en: "Los Angeles" },
  { id: "America/Sao_Paulo", fr: "São Paulo", en: "São Paulo" },
];

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

let current = DEFAULT_TIMEZONE;

export function setTimeZone(tz: string | null | undefined): void {
  current = isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

export function getTimeZone(): string {
  return current;
}

/** Jour (AAAA-MM-JJ) dans le fuseau donné. */
export function todayIn(tz: string = current, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Heure et minute (minutes depuis minuit) dans le fuseau donné. */
export function minutesIn(tz: string = current, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** « 20:30 », « 20h30 », « Départ à 9h00 » → minutes depuis minuit ; null si aucune heure lisible. */
export function parseTimeOfDay(value: string | null | undefined): number | null {
  const m = /(\d{1,2})\s*[h:H]\s*(\d{2})?/.exec(value ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Date et heure souhaitées d'une demande : refusées si déjà passées dans le fuseau du membre.
 * Renvoie la raison du refus, ou null si la demande est acceptable.
 */
export function scheduleIssue(date: string | null | undefined, time: string | null | undefined, tz: string, now: Date = new Date()): "date_passee" | "heure_passee" | null {
  if (!date) return null;
  const today = todayIn(tz, now);
  if (date < today) return "date_passee";
  if (date === today) {
    const at = parseTimeOfDay(time);
    if (at !== null && at <= minutesIn(tz, now)) return "heure_passee";
  }
  return null;
}

/** Nombre de couverts ou de personnes accepté. */
export const MAX_GUESTS = 500;
export function guestsIssue(guests: number | null | undefined): "couverts_invalides" | null {
  if (guests === null || guests === undefined) return null;
  return Number.isInteger(guests) && guests >= 1 && guests <= MAX_GUESTS ? null : "couverts_invalides";
}

/** Horodatage → jour (AAAA-MM-JJ) dans le fuseau du membre, au lieu du jour en temps universel. */
export function dayOf(iso: string, tz: string = current): string {
  return todayIn(tz, new Date(iso));
}
