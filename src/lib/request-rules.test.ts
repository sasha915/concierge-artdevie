import { expect, test } from "bun:test";
import { replyUpdate } from "./request-rules";

test("une réponse vide efface team_reply et team_reply_at", () => {
  expect(replyUpdate("   ")).toEqual({ team_reply: null, team_reply_at: null });
});

test("une réponse non vide est enregistrée avec sa date", () => {
  const now = new Date("2026-10-12T10:00:00Z");
  expect(replyUpdate(" Bonjour ", now)).toEqual({ team_reply: "Bonjour", team_reply_at: "2026-10-12T10:00:00.000Z" });
});
