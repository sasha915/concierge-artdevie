import { expect, test } from "bun:test";
import { isTeamEmail, teamSessionIssue } from "./team-auth-rules";

const now = new Date("2026-10-30T10:00:00Z");
const ts = now.getTime() / 1000;

test("adresse professionnelle uniquement", () => {
  expect(isTeamEmail("sasha@artdevie.co")).toBe(true);
  expect(isTeamEmail("Sasha@ArtDeVie.co ")).toBe(true);
  expect(isTeamEmail("sasha@gmail.com")).toBe(false);
  expect(isTeamEmail("x@artdevie.co.evil.com")).toBe(false);
});

test("l'espace équipe n'ouvre qu'après une connexion Google récente", () => {
  expect(teamSessionIssue({ email: "sasha@artdevie.co", amr: [{ method: "oauth", timestamp: ts - 60 }] }, now)).toBeNull();
  expect(teamSessionIssue({ email: "sasha@artdevie.co", amr: [{ method: "password", timestamp: ts - 60 }] }, now)).toBe("connexion_google_requise");
  expect(teamSessionIssue({ email: "sasha@artdevie.co", amr: [{ method: "oauth", timestamp: ts - 3600 }] }, now)).toBe("connexion_ancienne");
  expect(teamSessionIssue({ email: "sasha@gmail.com", amr: [{ method: "oauth", timestamp: ts }] }, now)).toBe("adresse_non_professionnelle");
});
