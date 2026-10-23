import { todayParis } from "./billing-webhook-rules";
/** Relevé mensuel au format PDF (lot 6.4), généré dans le navigateur. Aucun service externe. */
import { monthLabel, statementTotal, type StatementLine } from "./member-rules";
import { localeOf, translate, type Lang } from "./i18n";

const VIOLET: [number, number, number] = [59, 45, 85];
const MUTED: [number, number, number] = [120, 110, 140];
const RULE: [number, number, number] = [214, 210, 196];

/** Montant lisible par les polices standard du PDF (espaces fines remplacées). */
function euros(cents: number, lang: Lang): string {
  const value = (cents / 100).toLocaleString(localeOf(lang), { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0]/g, " ");
  return lang === "en" ? `\u20ac${value}` : `${value} \u20ac`;
}

function day(iso: string, lang: Lang): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(localeOf(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export async function downloadStatement({ lang = "fr", month, memberName, memberNumber, lines }: { lang?: Lang; month: string; memberName: string; memberNumber?: string | null; lines: StatementLine[] }) {
  const tr = (fr: string, vars?: Record<string, string>) => translate(lang, fr, vars);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 20;
  const right = 190;
  let y = 24;

  doc.setTextColor(...VIOLET);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setCharSpace(1.2);
  doc.text("ART DE VIE", left, y);
  doc.setCharSpace(0);
  doc.setTextColor(...MUTED);
  doc.text("58 avenue de Wagram, 75017 Paris", right, y, { align: "right" });

  y += 22;
  doc.setTextColor(...VIOLET);
  doc.setFontSize(26);
  const head = tr("Relevé de ");
  doc.text(head, left, y);
  const w = doc.getTextWidth(head);
  doc.setFont("times", "italic");
  doc.text(`${lang === "en" ? monthLabel(month, lang) : monthLabel(month, lang).toLowerCase()}.`, left + w, y);

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(memberNumber ? `${memberName} · ${tr("Membre n° {number}", { number: memberNumber })}` : memberName, left, y);

  y += 14;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);
  y += 7;
  doc.setFontSize(8);
  doc.setCharSpace(0.8);
  doc.text(tr("PRESTATION"), left, y);
  doc.text(tr("DATE"), 128, y);
  doc.text(tr("MONTANT"), right, y, { align: "right" });
  doc.setCharSpace(0);
  y += 4;
  doc.line(left, y, right, y);

  doc.setFontSize(11);
  doc.setTextColor(...VIOLET);
  if (lines.length === 0) {
    y += 10;
    doc.setTextColor(...MUTED);
    doc.text(tr("Aucune prestation ce mois-ci."), left, y);
  }
  for (const line of lines) {
    const title = doc.splitTextToSize(line.title, 100) as string[];
    const height = title.length * 5 + 6;
    if (y + height > 260) {
      doc.addPage();
      y = 24;
    }
    y += 8;
    doc.text(title, left, y);
    doc.text(day(line.date, lang) + (line.estimated ? ` ${tr("(estimation)")}` : ""), 128, y);
    doc.text(euros(line.amount_cents, lang), right, y, { align: "right" });
    y += (title.length - 1) * 5 + 4;
    doc.line(left, y, right, y);
  }

  y += 16;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.setCharSpace(0.8);
  doc.text(tr("TOTAL DU MOIS"), left, y);
  doc.setCharSpace(0);
  doc.setTextColor(...VIOLET);
  doc.setFont("times", "italic");
  doc.setFontSize(24);
  doc.text(euros(statementTotal(lines), lang), right, y + 1, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  if (lines.some((l) => l.estimated)) {
    doc.text(tr("Commission comprise. Les prestations pas encore facturées sont estimées ; la facture fait foi."), left, Math.min(y + 14, 274));
  }
  doc.text(tr("Ce relevé récapitule vos prestations du mois. Il ne vaut pas facture."), left, 282);
  doc.text(tr("Édité le {date}", { date: day(todayParis(), lang) }), right, 282, { align: "right" });

  doc.save(`Art-de-Vie-${lang === "en" ? "statement" : "releve"}-${month}.pdf`);
}
