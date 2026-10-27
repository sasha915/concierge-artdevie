import { describe, expect, test } from "bun:test";
import { orderForDisplay, todayInParis } from "./request-order";

describe("ordre d'affichage des demandes", () => {
  const r = (title: string, status: string, scheduled_date: string | null) => ({ title, status, scheduled_date, created_at: "2026-09-18T10:00:00Z" });

  test("les prochaines demandes actives d'abord, les annulées en dernier", () => {
    const list = [
      r("transfert annulé", "Annulée", "2026-08-31"),
      r("opéra", "Terminée", "2026-09-10"),
      r("girafe", "Confirmée", "2026-09-25"),
      r("soin", "Nouvelle", "2026-10-01"),
      r("déjeuner", "Nouvelle", "2026-11-20"),
      r("dîner", "Confirmée", "2026-10-30"),
      r("sans date", "En cours", null),
      r("week-end", "Terminée", "2026-10-03"),
    ];
    expect(orderForDisplay(list, "2026-10-27").map((x) => x.title)).toEqual([
      "dîner", "déjeuner", "sans date", "soin", "girafe", "week-end", "opéra", "transfert annulé",
    ]);
  });

  test("le jour même compte comme à venir", () => {
    expect(orderForDisplay([r("hier", "Nouvelle", "2026-10-26"), r("aujourd'hui", "Nouvelle", "2026-10-27")], "2026-10-27")[0]?.title).toBe("aujourd'hui");
  });

  test("date de Paris", () => {
    expect(todayInParis(new Date("2026-10-26T23:30:00Z"))).toBe("2026-10-27");
  });
});
