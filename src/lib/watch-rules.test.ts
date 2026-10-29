// @ts-ignore — runner intégré de bun, sans dépendance supplémentaire
import { expect, test } from "bun:test";
import { isFailedInvoice, isRenewalDue, isStaleRequest, notificationFailureLabel, waitingLabel } from "./watch-rules";

const now = new Date("2026-10-22T18:00:00Z");
test("une demande Nouvelle est signalée à partir de six heures", () => {
  expect(isStaleRequest({ status: "Nouvelle", created_at: "2026-10-22T12:00:00Z" }, now)).toBe(true);
  expect(isStaleRequest({ status: "Nouvelle", created_at: "2026-10-22T12:30:00Z" }, now)).toBe(false);
  expect(isStaleRequest({ status: "En cours", created_at: "2026-10-20T12:00:00Z" }, now)).toBe(false);
});
test("durée d'attente lisible", () => {
  expect(waitingLabel("2026-10-22T11:00:00Z", now)).toBe("7 h");
  expect(waitingLabel("2026-10-19T18:00:00Z", now)).toBe("3 j");
});
test("échéance d'adhésion dans les trente jours", () => {
  expect(isRenewalDue("2026-10-22", now)).toBe(true);
  expect(isRenewalDue("2026-11-21", now)).toBe(true);
  expect(isRenewalDue("2026-11-22", now)).toBe(false);
  expect(isRenewalDue("2026-10-21", now)).toBe(false);
  expect(isRenewalDue(null, now)).toBe(false);
});
test("factures en échec de paiement", () => {
  expect(isFailedInvoice("Échouée")).toBe(true);
  expect(isFailedInvoice("Expirée")).toBe(true);
  expect(isFailedInvoice("En attente")).toBe(false);
  expect(isFailedInvoice("Payée")).toBe(false);
});

test("raison d'une alerte WhatsApp non partie, en clair", () => {
  expect(notificationFailureLabel("missing_recipient")).toBe("Aucun numéro WhatsApp");
  expect(notificationFailureLabel("missing_WHATSAPP_API_TOKEN")).toBe("WhatsApp non configuré");
  expect(notificationFailureLabel("whatsapp_api_error:470")).toBe("Refusée par WhatsApp (470)");
  expect(notificationFailureLabel("adresse_ou_secret_absent")).toBe("Alerte non configurée");
  expect(notificationFailureLabel("inconnu")).toBe("Envoi impossible");
});
