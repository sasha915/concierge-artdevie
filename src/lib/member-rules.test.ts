import { describe, expect, test } from "bun:test";
import { cleanChoices, monthLabel, shiftMonth, statementLines, statementTotal } from "./member-rules";

const base = { title: "x", created_at: "2026-10-02T10:00:00Z" };

describe("questionnaire", () => {
  test("seules les options proposées sont gardées", () => {
    expect(cleanChoices("tables_choix", ["Cuisine italienne", "Inventée", "Tables gastronomiques", "Cuisine italienne"])).toEqual(["Tables gastronomiques", "Cuisine italienne"]);
  });
});

describe("relevé", () => {
  const rows = [
    { ...base, id: "a", status: "Terminée", amount_cents: 12000, scheduled_date: "2026-10-20" },
    { ...base, id: "b", status: "Confirmée", amount_cents: 5050, scheduled_date: null },
    { ...base, id: "c", status: "En cours", amount_cents: 9999, scheduled_date: "2026-10-05" },
    { ...base, id: "d", status: "Terminée", amount_cents: null, scheduled_date: "2026-10-05" },
    { ...base, id: "e", status: "Terminée", amount_cents: 700, scheduled_date: "2026-11-01" },
    { ...base, id: "f", status: "Annulée", amount_cents: 700, scheduled_date: "2026-10-01" },
  ];
  test("lignes du mois, triées par date", () => {
    expect(statementLines(rows, "2026-10").map((l) => l.id)).toEqual(["b", "a"]);
    expect(statementTotal(statementLines(rows, "2026-10"))).toBe(17050);
    expect(statementLines(rows, "2026-09")).toEqual([]);
  });
  test("facture retenue quand elle existe, commission ajoutée sinon (estimation)", () => {
    const withInvoice = [
      { ...base, id: "g", status: "Terminée", amount_cents: 10000, scheduled_date: "2026-10-10", invoice: [{ amount_cents: 11000, status: "Payée" }] },
      { ...base, id: "h", status: "Confirmée", amount_cents: 10000, scheduled_date: "2026-10-11", invoice: [] },
    ];
    const lines = statementLines(withInvoice, "2026-10", "Essentiel");
    expect(lines.map((l) => [l.id, l.amount_cents, l.estimated])).toEqual([["g", 11000, false], ["h", 11000, true]]);
    expect(statementLines(withInvoice, "2026-10", "Signature")[1]?.amount_cents).toBe(10000);
  });
  test("mois voisins et libellé", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthLabel("2026-10")).toBe("Octobre 2026");
  });
});
