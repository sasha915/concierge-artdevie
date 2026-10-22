// @ts-ignore — runner intégré de bun, sans dépendance supplémentaire
import { expect, test } from "bun:test";
import { commissionRate, eurosInput, invoiceBreakdown, parseEuros } from "./billing-rules";

test("commission de 10 % en Essentiel, aucune en Signature", () => {
  expect(commissionRate("Essentiel")).toBe(0.1);
  expect(commissionRate("Signature")).toBe(0);
  expect(commissionRate(null)).toBe(0);
});
test("le total facturé couvre la prestation et la commission", () => {
  expect(invoiceBreakdown(125000, "Essentiel")).toEqual({ service_cents: 125000, commission_rate: 0.1, commission_cents: 12500, total_cents: 137500 });
  expect(invoiceBreakdown(125000, "Signature")).toEqual({ service_cents: 125000, commission_rate: 0, commission_cents: 0, total_cents: 125000 });
});
test("la commission est arrondie au centime", () => {
  expect(invoiceBreakdown(1005, "Essentiel").commission_cents).toBe(101);
});
test("saisie des montants en euros", () => {
  expect(parseEuros("1 250,50")).toBe(125050);
  expect(parseEuros("1250.5")).toBe(125050);
  expect(parseEuros("890 €")).toBe(89000);
  expect(parseEuros("")).toBeNull();
  expect(parseEuros("12,345")).toBeNull();
  expect(parseEuros("-5")).toBeNull();
  expect(parseEuros("abc")).toBeNull();
});
test("affichage du montant dans le champ", () => {
  expect(eurosInput(125050)).toBe("1250,50");
  expect(eurosInput(89000)).toBe("890");
  expect(eurosInput(null)).toBe("");
});
