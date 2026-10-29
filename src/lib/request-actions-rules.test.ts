// @ts-ignore — runner intégré de bun, sans dépendance supplémentaire
import { expect, test } from "bun:test";
import { buildIcs, canAddToCalendar, canRequestChange, canReview, cleanFileName, fileProblem, fileSizeLabel } from "./request-actions-rules";

test("pièces jointes : PDF et images de 10 Mo au plus", () => {
  expect(fileProblem({ type: "application/pdf", size: 1000 })).toBeNull();
  expect(fileProblem({ type: "image/png", size: 10 * 1024 * 1024 })).toBeNull();
  expect(fileProblem({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).toBe("Le fichier dépasse 10 Mo.");
  expect(fileProblem({ type: "application/zip", size: 1000 })).not.toBeNull();
  expect(fileProblem({ type: "application/pdf", size: 0 })).toBe("Ce fichier est vide.");
});
test("nom et taille affichés", () => {
  expect(cleanFileName("C:\\\\dossier\\\\billet.pdf")).toBe("billet.pdf");
  expect(cleanFileName("../../x.pdf")).toBe("x.pdf");
  expect(fileSizeLabel(2048)).toBe("2 Ko");
  expect(fileSizeLabel(1572864)).toBe("1,5 Mo");
});
test("modification possible sur Nouvelle, En cours et Confirmée seulement", () => {
  expect(["Nouvelle", "En cours", "Confirmée"].every(canRequestChange)).toBe(true);
  expect(canRequestChange("Terminée")).toBe(false);
  expect(canRequestChange("Annulée")).toBe(false);
});
test("avis seulement sur une demande terminée", () => {
  expect(canReview("Terminée")).toBe(true);
  expect(canReview("Confirmée")).toBe(false);
});
test("calendrier : demande confirmée et datée", () => {
  expect(canAddToCalendar({ status: "Confirmée", scheduled_date: "2026-11-02" })).toBe(true);
  expect(canAddToCalendar({ status: "Confirmée", scheduled_date: null })).toBe(false);
  expect(canAddToCalendar({ status: "En cours", scheduled_date: "2026-11-02" })).toBe(false);
});
test("fichier .ics avec heure, en heure de Paris, deux heures par défaut", () => {
  const ics = buildIcs({ id: "abc", title: "Dîner, Hôtel Costes", category: "Tables", description: "Table calme", scheduled_date: "2026-11-02", scheduled_time: "20:30:00" }, new Date("2026-10-22T10:00:00Z"));
  expect(ics).toContain("DTSTART;TZID=Europe/Paris:20261102T203000");
  expect(ics).toContain("DTEND;TZID=Europe/Paris:20261102T223000");
  expect(ics).toContain("SUMMARY:Dîner\\, Hôtel Costes");
  expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
});
test("fichier .ics sans heure : journée entière", () => {
  const ics = buildIcs({ id: "abc", title: "Séjour", category: "Séjours", description: "", scheduled_date: "2026-12-31", scheduled_time: null });
  expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
  expect(ics).toContain("DTEND;VALUE=DATE:20270101");
});

test("fichier .ics lisible par Outlook : fuseau décrit, heure saisie librement, lignes repliées", () => {
  const ics = buildIcs({ id: "abc", title: "Transfert", category: "Transferts", description: "x".repeat(200), scheduled_date: "2026-11-02", scheduled_time: "Départ à 9h00" }, new Date("2026-10-22T10:00:00Z"));
  expect(ics).toContain("BEGIN:VTIMEZONE\r\nTZID:Europe/Paris");
  expect(ics).toContain("DTSTART;TZID=Europe/Paris:20261102T090000");
  expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  const allDay = buildIcs({ id: "abc", title: "Séjour", category: "Séjours", description: "", scheduled_date: "2026-12-31", scheduled_time: "en soirée" });
  expect(allDay).toContain("DTSTART;VALUE=DATE:20261231");
  expect(allDay).not.toContain("VTIMEZONE");
});
