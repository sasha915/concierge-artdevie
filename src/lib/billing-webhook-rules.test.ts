import { describe, expect, test } from "bun:test";
import { invoiceUpdateFor, subscriptionInterval, subscriptionStartDate, toCents, todayParis, adjustmentFor } from "./billing-webhook-rules";

describe("webhook Mollie", () => {
  const invoice = { status: "En attente", mollie_payment_id: "tr_2", amount_cents: 149000 };

  test("un ancien lien expiré ne touche pas la facture, mais un ancien lien payé est retenu", () => {
    expect(invoiceUpdateFor(invoice, "tr_1", "Expirée", 149000).apply).toBe(false);
    expect(invoiceUpdateFor(invoice, "tr_2", "Payée", 149000).apply).toBe(true);
    expect(invoiceUpdateFor(invoice, "tr_1", "Payée", 149000).apply).toBe(true);
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

import { conciergeRecipients } from "./notify-concierge.server";
describe("destinataires WhatsApp", () => {
  test("concierge d'abord, numéro commun en repli, sans doublon", () => {
    expect(conciergeRecipients("+33 6 11 22 33 44", "+33 1 23 45 67 89")).toEqual(["33611223344", "33123456789"]);
    expect(conciergeRecipients(null, "+33 1 23 45 67 89")).toEqual(["33123456789"]);
    expect(conciergeRecipients("+33123456789", "+33 1 23 45 67 89")).toEqual(["33123456789"]);
    expect(conciergeRecipients("", "")).toEqual([]);
  });
});

test("paiement remboursé ou contesté après encaissement", () => {
  const paid = { status: "paid", amount: { value: "100.00" } };
  expect(adjustmentFor(paid)).toBeNull();
  expect(adjustmentFor({ ...paid, amountRefunded: { value: "100.00" } })).toEqual({ status: "Remboursée", cents: 10000 });
  expect(adjustmentFor({ ...paid, amountRefunded: { value: "30.00" } })).toEqual({ status: "Remboursée en partie", cents: 3000 });
  expect(adjustmentFor({ ...paid, amountRefunded: { value: "0.00" }, amountChargedBack: { value: "100.00" } })).toEqual({ status: "Contestée", cents: 10000 });
  expect(adjustmentFor({ status: "failed", amount: { value: "100.00" }, amountRefunded: { value: "100.00" } })).toBeNull();
});
