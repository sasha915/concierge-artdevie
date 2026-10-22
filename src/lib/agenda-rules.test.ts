import { describe, expect, test } from "bun:test";
import { monthGrid, occurrencesBetween, startOfWeek, weekDays } from "./agenda-rules";

const rule = { rhythm: "hebdomadaire", start_date: "2026-10-01", dates: [] as string[], end_date: null as string | null, last_occurrence: "2026-10-15" as string | null };

describe("agenda", () => {
  test("semaine du lundi au dimanche", () => {
    expect(startOfWeek("2026-10-22")).toBe("2026-10-19");
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
    expect(weekDays("2026-10-22")[6]).toBe("2026-10-25");
  });
  test("grille du mois", () => {
    const g = monthGrid("2026-10-22");
    expect(g[0]?.[0]).toBe("2026-09-28");
    expect(g[g.length - 1]?.[6]).toBe("2026-11-01");
    expect(g.length).toBe(5);
  });
  test("échéances hebdomadaires après la dernière créée", () => {
    expect(occurrencesBetween(rule, "2026-10-01", "2026-10-31")).toEqual(["2026-10-22", "2026-10-29"]);
    expect(occurrencesBetween({ ...rule, paused: true }, "2026-10-01", "2026-10-31")).toEqual([]);
    expect(occurrencesBetween({ ...rule, end_date: "2026-10-25" }, "2026-10-01", "2026-10-31")).toEqual(["2026-10-22"]);
  });
  test("mensuelles et dates choisies", () => {
    expect(occurrencesBetween({ ...rule, rhythm: "mensuelle", start_date: "2026-01-31", last_occurrence: null }, "2026-02-01", "2026-04-30")).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(occurrencesBetween({ ...rule, rhythm: "dates", dates: ["2026-11-02", "2026-10-10", "2026-10-30"], last_occurrence: "2026-10-10" }, "2026-10-01", "2026-11-30")).toEqual(["2026-10-30", "2026-11-02"]);
  });
});
