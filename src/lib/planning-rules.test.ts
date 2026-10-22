// @ts-ignore — runner intégré de bun, sans dépendance supplémentaire
import { expect, test } from "bun:test";
import { addMonths, creationDate, nextOccurrence, proposalBanner } from "./planning-rules";

test("bandeau de proposition au nombre réel", () => {
  expect(proposalBanner(2)).toBe("Deux options vous attendent.");
  expect(proposalBanner(3)).toBe("Trois options vous attendent.");
  expect(proposalBanner(1)).toBe("Une option vous attend.");
  expect(proposalBanner(9)).toBe("9 options vous attendent.");
});
test("mois : même jour, ramené en fin de mois", () => {
  expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
  expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
});
const base = { dates: [] as string[], end_date: null, last_occurrence: null };
test("chaque semaine : prochaine échéance après la dernière créée", () => {
  expect(nextOccurrence({ ...base, rhythm: "hebdomadaire", start_date: "2026-10-01", last_occurrence: "2026-10-22" }, "2026-10-22")).toBe("2026-10-29");
  expect(nextOccurrence({ ...base, rhythm: "hebdomadaire", start_date: "2026-11-05" }, "2026-10-22")).toBe("2026-11-05");
  expect(nextOccurrence({ ...base, rhythm: "hebdomadaire", start_date: "2026-10-01" }, "2026-10-22")).toBe("2026-10-22");
});
test("chaque mois et date de fin", () => {
  expect(nextOccurrence({ ...base, rhythm: "mensuelle", start_date: "2026-09-15", last_occurrence: "2026-10-15" }, "2026-10-22")).toBe("2026-11-15");
  expect(nextOccurrence({ ...base, rhythm: "mensuelle", start_date: "2026-09-15", last_occurrence: "2026-10-15", end_date: "2026-11-01" }, "2026-10-22")).toBeNull();
});
test("dates choisies (jours de match)", () => {
  const rule = { ...base, rhythm: "dates", start_date: null, dates: ["2026-11-20", "2026-10-30", "2026-12-04"], last_occurrence: "2026-10-30" };
  expect(nextOccurrence(rule, "2026-10-22")).toBe("2026-11-20");
  expect(nextOccurrence({ ...rule, last_occurrence: "2026-12-04" }, "2026-10-22")).toBeNull();
});
test("création sept jours avant l'échéance", () => {
  expect(creationDate("2026-11-05")).toBe("2026-10-29");
});
