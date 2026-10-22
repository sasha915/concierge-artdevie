// @ts-ignore — runner intégré de bun, sans dépendance supplémentaire
import { expect, test } from "bun:test";
import { insertReply, matchesRequestFilters, requestHistory } from "./team-request-rules";
const date = "2026-10-22T09:49:00Z";
const event = { id: "1", kind: "statut changé", detail: "Nouvelle → En cours", created_at: date, author_name: "Équipe", actor_id: null };
test("Reçue est calculée depuis created_at sans modifier les événements", () => {
  const events = [event];
  expect(requestHistory(events, "2026-10-20T00:00:00Z")[0]).toMatchObject({ label: "Reçue", created_at: "2026-10-20T00:00:00Z" });
  expect(events.length).toBe(1);
});
test("aucun doublon lorsque reçue existe", () => {
  expect(requestHistory([{ ...event, kind: "reçue", detail: null }], date).length).toBe(1);
});
test("Prise en charge est uniquement le premier passage Nouvelle → En cours", () => {
  const rows = requestHistory([event, { ...event, id: "2", created_at: "2026-10-23T00:00:00Z" }], date);
  expect(rows[1]?.label).toBe("Prise en charge");
  expect(rows[2]?.label).toBe("Statut changé · Nouvelle → En cours");
});
test("insertion au curseur conserve tout le texte, y compris une sélection", () => {
  expect(insertReply("Bonjour membre", "cher ", 8)).toEqual({ text: "Bonjour cher membre", cursor: 13 });
});
test("sans curseur insertion à la fin", () => {
  expect(insertReply("Bonjour", " membre", null).text).toBe("Bonjour membre");
});
const row = { title: "Dîner", member_name: "Membre", category: "Tables", concierge: "Équipe", concierge_id: "self" };
const filters = { search: "dîner", category: "Tables", concierge: "Équipe", mine: true, unassigned: false, userId: "self" };
test("Mes demandes utilise concierge_id et se combine aux autres filtres", () => {
  expect(matchesRequestFilters(row, filters)).toBe(true);
  expect(matchesRequestFilters({ ...row, concierge_id: "other" }, filters)).toBe(false);
  expect(matchesRequestFilters({ ...row, category: "Soins" }, filters)).toBe(false);
});
test("À attribuer utilise exactement le nom du concierge", () => {
  expect(matchesRequestFilters({ ...row, concierge: "À attribuer" }, { ...filters, concierge: "", mine: false, unassigned: true })).toBe(true);
  expect(matchesRequestFilters(row, { ...filters, concierge: "", mine: false, unassigned: true })).toBe(false);
});