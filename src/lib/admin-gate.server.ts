import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

export type AdminGateSession = { adminUnlocked?: boolean };

export function adminSessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "adv-admin-gate",
    maxAge: 60 * 60 * 2,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export function adminPasswordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function isAdminUnlocked(): Promise<boolean> {
  if (!process.env["SESSION_SECRET"]) return false;
  const session = await useSession<AdminGateSession>(adminSessionConfig());
  return session.data.adminUnlocked === true;
}

export async function requireAdminUnlocked(): Promise<void> {
  if (!(await isAdminUnlocked())) throw new Error("AdminLocked");
}
