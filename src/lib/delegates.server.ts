// Lot 5.4 : proches autorisés, logique serveur partagée. À n'importer que côté serveur.

export type Delegation = {
  id: string;
  memberId: string;
  fullName: string;
  memberName: string;
  language: "fr" | "en";
  /** Fuseau du membre : le proche lit les horodatages à la même heure que lui. */
  timezone: string;
};

/**
 * Délégation active du compte appelant : accès confirmé par l'équipe, non retiré,
 * membre non désactivé. Toute fonction de proche commence par cette vérification.
 */
export async function delegationOf(admin: any, userId: string): Promise<Delegation | null> {
  const { data: row } = await admin
    .from("member_delegates")
    .select("id, member_id, full_name")
    .eq("delegate_id", userId)
    .eq("status", "actif")
    .maybeSingle();
  if (!row) return null;
  const { data: member } = await admin.from("profiles").select("full_name, disabled_at, language, timezone").eq("id", row.member_id).maybeSingle();
  if (!member || member.disabled_at) return null;
  return { id: row.id, memberId: row.member_id, fullName: row.full_name, memberName: member.full_name ?? "", language: member.language === "en" ? "en" : "fr", timezone: member.timezone ?? "Europe/Paris" };
}

/** Retire un accès : effet immédiat (les fonctions de proche vérifient le statut à chaque appel) et connexion bloquée. */
export async function revokeDelegation(admin: any, row: { id: string; status: string; delegate_id: string | null }, actorId: string) {
  if (row.status !== "en_attente" && row.status !== "actif") return { ok: false as const, reason: "Cet accès n’est plus ouvert." };
  const { data: updated, error } = await admin
    .from("member_delegates")
    .update({ status: "retire", revoked_at: new Date().toISOString(), revoked_by: actorId })
    .eq("id", row.id)
    .in("status", ["en_attente", "actif"])
    .select("id")
    .maybeSingle();
  if (error || !updated) return { ok: false as const, reason: "L’accès n’a pas pu être retiré." };
  if (row.delegate_id) {
    const { data: other } = await admin.from("member_delegates").select("id").eq("delegate_id", row.delegate_id).eq("status", "actif").limit(1);
    if (!other?.length) {
      const { error: banError } = await admin.auth.admin.updateUserById(row.delegate_id, { ban_duration: "876000h" });
      if (banError) console.error("[revokeDelegation] connexion non bloquée", banError.message);
    }
  }
  return { ok: true as const };
}

/** Noms des proches pour l'affichage (« Demandée par … ») : par compte et par délégation. */
export async function delegateNames(admin: any, opts: { authorIds?: string[]; recordIds?: string[] }) {
  const byAuthor = new Map<string, string>();
  const byRecord = new Map<string, string>();
  const authorIds = [...new Set(opts.authorIds ?? [])];
  const recordIds = [...new Set(opts.recordIds ?? [])];
  if (authorIds.length) {
    const { data } = await admin.from("member_delegates").select("delegate_id, full_name").in("delegate_id", authorIds);
    for (const d of data ?? []) if (d.delegate_id) byAuthor.set(d.delegate_id, d.full_name);
  }
  if (recordIds.length) {
    const { data } = await admin.from("member_delegates").select("id, full_name").in("id", recordIds);
    for (const d of data ?? []) byRecord.set(d.id, d.full_name);
  }
  return { byAuthor, byRecord };
}
