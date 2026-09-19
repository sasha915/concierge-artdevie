import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { adminPasswordMatches, adminSessionConfig, isAdminUnlocked, type AdminGateSession } from "./admin-gate.server";

/** Reads only the signed cookie — safe to call from a route beforeLoad (no bearer token needed). */
export const adminGateStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { unlocked: await isAdminUnlocked(), configured: Boolean(process.env["ADMIN_PASSWORD"]) };
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ password: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_PASSWORD"];
    if (!expected) {
      console.warn("accès administration refusé : secret ADMIN_PASSWORD manquant");
      return { ok: false as const, reason: "not_configured" as const };
    }
    if (!adminPasswordMatches(data.password, expected)) return { ok: false as const, reason: "invalid" as const };
    const session = await useSession<AdminGateSession>(adminSessionConfig());
    await session.update({ adminUnlocked: true });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminGateSession>(adminSessionConfig());
  await session.clear();
  return { ok: true as const };
});
