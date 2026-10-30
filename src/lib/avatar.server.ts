import { avatarPath, avatarProblem } from "./avatar-rules";

const BUCKET = "avatars";
const LINK_SECONDS = 3600;

type Result = { ok: true } | { ok: false; reason: string };

/** Enregistre la photo d'un compte, puis efface l'ancienne. */
export async function storeAvatar(admin: any, userId: string, file: File): Promise<Result> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = avatarProblem(bytes);
  if (problem) return { ok: false, reason: problem };
  const { data: profile } = await admin.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  if (!profile) return { ok: false, reason: "Compte introuvable." };
  const path = avatarPath(userId);
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (uploadError) return { ok: false, reason: "L’envoi de la photo a échoué." };
  const { error } = await admin.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    return { ok: false, reason: "La photo n’a pas pu être enregistrée." };
  }
  if (profile.avatar_path) await admin.storage.from(BUCKET).remove([profile.avatar_path]);
  return { ok: true };
}

/** Retire la photo d'un compte : la fiche d'abord, puis tous les fichiers de son dossier. */
export async function clearAvatar(admin: any, userId: string): Promise<Result> {
  const { error } = await admin.from("profiles").update({ avatar_path: null }).eq("id", userId);
  if (error) return { ok: false, reason: "La photo n’a pas pu être retirée." };
  const { data: files } = await admin.storage.from(BUCKET).list(userId, { limit: 100 });
  const paths = (files ?? []).map((f: { name: string }) => `${userId}/${f.name}`);
  if (paths.length) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
    if (removeError) return { ok: false, reason: "La photo est retirée de la fiche, mais le fichier n’a pas pu être effacé." };
  }
  return { ok: true };
}

/** Liens temporaires (1 h) vers les photos des comptes demandés, par identifiant. */
export async function avatarUrls(admin: any, userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds)].slice(0, 500);
  if (!ids.length) return {};
  const { data: rows } = await admin.from("profiles").select("id, avatar_path").in("id", ids).not("avatar_path", "is", null);
  const byPath = new Map<string, string>((rows ?? []).map((r: { id: string; avatar_path: string }) => [r.avatar_path, r.id]));
  if (!byPath.size) return {};
  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls([...byPath.keys()], LINK_SECONDS);
  const out: Record<string, string> = {};
  for (const s of signed ?? []) {
    const id = s.path ? byPath.get(s.path) : undefined;
    if (id && s.signedUrl) out[id] = s.signedUrl;
  }
  return out;
}
