/** Règles des lots 5.2 et 5.3 : pièces jointes, modification, avis, calendrier, renouvellement. Pures et testées. */

// ---- Pièces jointes ----
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_TYPES: Record<string, { ext: string; label: string }> = {
  "application/pdf": { ext: "pdf", label: "PDF" },
  "image/jpeg": { ext: "jpg", label: "Image" },
  "image/png": { ext: "png", label: "Image" },
  "image/webp": { ext: "webp", label: "Image" },
  "image/heic": { ext: "heic", label: "Image" },
};

export function fileProblem(file: { type: string; size: number }): string | null {
  if (!FILE_TYPES[file.type]) return "Formats acceptés : PDF ou image (JPEG, PNG, WebP, HEIC).";
  if (file.size <= 0) return "Ce fichier est vide.";
  if (file.size > MAX_FILE_BYTES) return "Le fichier dépasse 10 Mo.";
  return null;
}

export function fileSizeLabel(bytes: number, lang: "fr" | "en" = "fr"): string {
  const en = lang === "en";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ${en ? "KB" : "Ko"}`;
  return `${(bytes / (1024 * 1024)).toLocaleString(en ? "en-GB" : "fr-FR", { maximumFractionDigits: 1 })} ${en ? "MB" : "Mo"}`;
}

/** Nom affiché, sans chemin ni caractère de contrôle. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "document").slice(0, 160);
}

// ---- Demande de modification ----
export const CHANGE_KINDS = [
  { value: "date", label: "Changer la date ou l’heure" },
  { value: "couverts", label: "Changer le nombre de couverts" },
  { value: "precision", label: "Autre précision" },
  { value: "annulation", label: "Annuler la demande" },
] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number]["value"];

export function changeKindLabel(kind: string): string {
  return CHANGE_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function canRequestChange(status: string): boolean {
  return status === "Nouvelle" || status === "En cours" || status === "Confirmée";
}

// ---- Avis ----
export const REVIEW_RATINGS = ["Parfaite", "Bien", "À revoir"] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export function canReview(status: string): boolean {
  return status === "Terminée";
}

// ---- Calendrier (.ics) ----
export function canAddToCalendar(item: { status: string; scheduled_date: string | null }): boolean {
  return item.status === "Confirmée" && !!item.scheduled_date;
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);
}

function compactDate(iso: string): string {
  return iso.replace(/-/g, "");
}

/** Fuseau de Paris décrit dans le fichier : Outlook et certains agendas Android l'exigent pour lire TZID. */
const PARIS_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Paris",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Lignes de plus de 75 octets repliées (RFC 5545), sans couper un caractère accentué. */
function foldLine(line: string): string {
  const out: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += ch;
    bytes += size;
  }
  out.push(chunk);
  return out.join("\r\n ");
}

/** « 20:30 », « 20h30 », « Départ à 9h00 » → [heures, minutes] ; null si aucune heure lisible. */
function timeOf(value: string): [number, number] | null {
  const m = /(\d{1,2})\s*[h:H]\s*(\d{2})?/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  return h <= 23 && min <= 59 ? [h, min] : null;
}

/**
 * Fichier .ics d'une prestation confirmée : heure du lieu (Paris) si une heure est lisible, sinon journée entière.
 * Le bloc VTIMEZONE accompagne toujours une heure.
 */
export function buildIcs(item: { id: string; title: string; category: string; description: string; scheduled_date: string; scheduled_time: string | null }, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = compactDate(item.scheduled_date);
  const at = item.scheduled_time ? timeOf(item.scheduled_time) : null;
  let when: string[];
  if (at) {
    const [h, m] = at;
    const start = `${day}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    const endDate = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)), h + 2, m));
    const end = `${endDate.toISOString().slice(0, 10).replace(/-/g, "")}T${String(endDate.getUTCHours()).padStart(2, "0")}${String(endDate.getUTCMinutes()).padStart(2, "0")}00`;
    when = [`DTSTART;TZID=Europe/Paris:${start}`, `DTEND;TZID=Europe/Paris:${end}`];
  } else {
    const next = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)) + 1));
    when = [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`];
  }
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Art de Vie//Conciergerie//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(at ? PARIS_VTIMEZONE : []),
    "BEGIN:VEVENT",
    `UID:${item.id}@artdevie.co`,
    `DTSTAMP:${stamp}`,
    ...when,
    `SUMMARY:${icsEscape(item.title)}`,
    `DESCRIPTION:${icsEscape([`Art de Vie · ${item.category}`, item.description].filter(Boolean).join("\n"))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ---- Renouvellement ----
export function canRenew(status: string): boolean {
  return status === "Terminée";
}
