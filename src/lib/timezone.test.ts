import { expect, test } from "bun:test";
import { guestsIssue, isValidTimeZone, minutesIn, parseTimeOfDay, scheduleIssue, todayIn } from "./timezone";

// 30 octobre 2026, 03:30 à Paris = 29 octobre, 22:30 à New York.
const now = new Date("2026-10-30T02:30:00Z");

test("jour et heure dans le fuseau du membre", () => {
  expect(todayIn("Europe/Paris", now)).toBe("2026-10-30");
  expect(todayIn("America/New_York", now)).toBe("2026-10-29");
  expect(minutesIn("America/New_York", now)).toBe(22 * 60 + 30);
  expect(isValidTimeZone("America/New_York")).toBe(true);
  expect(isValidTimeZone("Mars/Olympus")).toBe(false);
});

test("heure saisie librement", () => {
  expect(parseTimeOfDay("20:30")).toBe(20 * 60 + 30);
  expect(parseTimeOfDay("Départ à 9h00")).toBe(9 * 60);
  expect(parseTimeOfDay("21h")).toBe(21 * 60);
  expect(parseTimeOfDay("en soirée")).toBeNull();
});

test("date ou heure déjà passée selon la ville du membre", () => {
  expect(scheduleIssue("2026-10-29", null, "Europe/Paris", now)).toBe("date_passee");
  expect(scheduleIssue("2026-10-29", "23:00", "America/New_York", now)).toBeNull();
  expect(scheduleIssue("2026-10-29", "21:00", "America/New_York", now)).toBe("heure_passee");
  expect(scheduleIssue(null, null, "Europe/Paris", now)).toBeNull();
});

test("couverts", () => {
  expect(guestsIssue(null)).toBeNull();
  expect(guestsIssue(4)).toBeNull();
  expect(guestsIssue(0)).toBe("couverts_invalides");
  expect(guestsIssue(2.5)).toBe("couverts_invalides");
});
