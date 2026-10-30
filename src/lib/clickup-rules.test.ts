import { describe, expect, test } from "bun:test";
import { changedKeys, demandeStatus, ficheStatus, normalizeName, parseClickupTaskId, prestationTimestamp, retryDelayMinutes } from "./clickup-rules";

describe("liaison ClickUp", () => {
  test("statuts des demandes", () => {
    expect(demandeStatus("Nouvelle", false)).toBe("demande reçue");
    expect(demandeStatus("En cours", false)).toBe("en préparation");
    expect(demandeStatus("En cours", true)).toBe("proposition envoyée");
    expect(demandeStatus("Confirmée", false)).toBe("confirmé");
    expect(demandeStatus("Terminée", false)).toBe("livré");
    expect(demandeStatus("Annulée", true)).toBe("clôturé");
  });
  test("statut de fiche", () => {
    expect(ficheStatus(null)).toBe("actif");
    expect(ficheStatus("2026-10-30T00:00:00Z")).toBe("ancien client");
  });
  test("rapprochement des noms", () => {
    expect(normalizeName("  Nadir  HIFI ")).toBe(normalizeName("nadir hifi"));
    expect(normalizeName("Édouard Lenoir")).toBe("edouard lenoir");
    expect(normalizeName("T.J. Shorts")).toBe("t j shorts");
  });
  test("lien ou identifiant de tâche", () => {
    expect(parseClickupTaskId("https://app.clickup.com/t/1242djkh8xq")).toBe("1242djkh8xq");
    expect(parseClickupTaskId("https://app.clickup.com/t/90151723327/86c9w38j3")).toBe("86c9w38j3");
    expect(parseClickupTaskId("86c9w38j3")).toBe("86c9w38j3");
    expect(parseClickupTaskId("pas un lien !")).toBeNull();
  });
  test("date de prestation à l'heure de Paris", () => {
    // 20 h 30 à Paris le 7 novembre (UTC+1) = 19 h 30 UTC
    expect(prestationTimestamp("2026-11-07", "20:30")).toEqual({ value: Date.UTC(2026, 10, 7, 19, 30), time: true });
    // été (UTC+2)
    expect(prestationTimestamp("2026-07-01", "20h")).toEqual({ value: Date.UTC(2026, 6, 1, 18, 0), time: true });
    expect(prestationTimestamp("2026-11-07", null)).toEqual({ value: Date.UTC(2026, 10, 7, 12, 0), time: false });
    expect(prestationTimestamp(null, "20:30")).toBeNull();
  });
  test("seuls les champs changés sont réécrits", () => {
    expect(changedKeys({ a: 1, b: "x" }, null)).toEqual(["a", "b"]);
    expect(changedKeys({ a: 1, b: "x" }, { a: 1, b: "y" })).toEqual(["b"]);
    expect(changedKeys({ a: 1, b: null }, { a: 1 })).toEqual(["b"]);
    expect(changedKeys({ d: { value: 1, time: true } }, { d: { value: 1, time: true } })).toEqual([]);
  });
  test("attente entre deux essais", () => {
    expect([1, 2, 3, 7, 20].map(retryDelayMinutes)).toEqual([1, 2, 4, 60, 60]);
  });
});
