import { describe, expect, test } from "bun:test";
import { invoiceUpdateFor, subscriptionInterval, subscriptionStartDate, toCents, todayParis } from "./billing-webhook-rules";

describe("webhook Mollie", () => {
  const invoice = { status: "En attente", mollie_payment_id: "tr_2", amount_cents: 149000 };

  test("un ancien lien de paiement ne touche pas la facture", () => {
    expect(invoiceUpdateFor(invoice, "tr_1", "Expirée", 149000).apply).toBe(false);
    expect(invoiceUpdateFor(invoice, "tr_2", "Payée", 149000).apply).toBe(true);
  });

  test("une facture payée ne redescend jamais", () => {
    expect(invoiceUpdateFor({ ...invoice, status: "Payée" }, "tr_2", "Échouée", 149000).apply).toBe(false);
  });

  test("un paiement d'un autre montant n'est pas retenu", () => {
    expect(invoiceUpdateFor(invoice, "tr_2", "Payée", 100).apply).toBe(false);
  });

  test("premier prélèvement de l'abonnement : une période plus tard, fin de mois comprise", () => {
    expect(subscriptionStartDate("2026-10-23", "mois")).toBe("2026-11-23");
    expect(subscriptionStartDate("2026-01-31", "mois")).toBe("2026-02-28");
    expect(subscriptionStartDate("2026-10-23", "an")).toBe("2027-10-23");
    expect(subscriptionStartDate("2028-02-29", "an")).toBe("2029-02-28");
    expect(subscriptionInterval("an")).toBe("12 months");
    expect(subscriptionInterval("mois")).toBe("1 month");
  });

  test("montants et date de Paris", () => {
    expect(toCents("1490.00")).toBe(149000);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("19.99")).toBe(1999);
    expect(todayParis(new Date("2026-10-22T22:30:00Z"))).toBe("2026-10-23");
    expect(todayParis(new Date("2026-10-22T21:30:00Z"))).toBe("2026-10-22");
  });
});
