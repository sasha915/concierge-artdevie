import { useSession } from "@tanstack/react-start/server";

/** La session d'équipe est liée au compte qui l'a ouverte. */
export type AdminGateSession = { adminUnlocked?: boolean; userId?: string };

/** Tentatives d'identification tolérées par compte sur la fenêtre, avant blocage temporaire. */
export const GATE_MAX_ATTEMPTS = 5;
export const GATE_WINDOW_MINUTES = 15;

export function adminSessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "adv-admin-gate",
    maxAge: 60 * 60 * 2,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

/** Sans identifiant, indique seulement si un verrou est ouvert dans ce navigateur (affichage). */
export async function isAdminUnlocked(userId?: string): Promise<boolean> {
  if (!process.env["SESSION_SECRET"]) return false;
  const session = await useSession<AdminGateSession>(adminSessionConfig());
  if (session.data.adminUnlocked !== true) return false;
  return userId ? session.data.userId === userId : true;
}

export async function requireAdminUnlocked(userId: string): Promise<void> {
  if (!(await isAdminUnlocked(userId))) throw new Error("AdminLocked");
}
