import { DEFAULT_APP_ORIGIN } from "./app-origin";
import {
  ALERT_AFTER_ATTEMPTS,
  CLICKUP,
  RATING_STARS,
  changedKeys,
  demandeStatus,
  ficheStatus,
  normalizeName,
  prestationTimestamp,
  retryDelayMinutes,
  type DemandeValues,
  type FicheValues,
} from "./clickup-rules";

const API = "https://api.clickup.com/api/v2";

class ClickupError extends Error {}

function token(): string | null {
  return process.env["CLICKUP_API_TOKEN"] || null;
}

async function cu<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: token() ?? "", "content-type": "application/json" },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new ClickupError(`ClickUp ${res.status} ${text.slice(0, 160)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

type CuUser = { id: number; email: string | null; username: string | null };

/** Membres de l'espace ClickUp (pour l'assignation : par e-mail, puis par nom). */
class Directory {
  private users: CuUser[] | null = null;
  async all(): Promise<CuUser[]> {
    if (this.users) return this.users;
    const data = await cu<{ teams: Array<{ id: string; members: Array<{ user: CuUser }> }> }>("/team");
    const team = data.teams.find((t) => t.id === CLICKUP.workspaceId) ?? data.teams[0];
    this.users = (team?.members ?? []).map((m) => m.user);
    return this.users;
  }
  async byEmail(email: string | null | undefined): Promise<number | null> {
    if (!email) return null;
    const e = email.trim().toLowerCase();
    return (await this.all()).find((u) => (u.email ?? "").toLowerCase() === e)?.id ?? null;
  }
  async byName(name: string | null | undefined): Promise<number | null> {
    if (!name) return null;
    const n = normalizeName(name);
    const matches = (await this.all()).filter((u) => u.username && normalizeName(u.username) === n);
    return matches.length === 1 ? matches[0]!.id : null;
  }
}

async function setField(taskId: string, fieldId: string, value: unknown, options?: Record<string, unknown>) {
  if (value === null || value === undefined) {
    await cu(`/task/${taskId}/field/${fieldId}`, { method: "DELETE" });
    return;
  }
  await cu(`/task/${taskId}/field/${fieldId}`, { method: "POST", body: { value, ...(options ? { value_options: options } : {}) } });
}

async function isTeamAccount(admin: any, userId: string): Promise<boolean> {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "concierge"]).limit(1);
  return (data ?? []).length > 0;
}

/** Fiche existante portant exactement le même nom (sans accents ni casse) et pas encore reliée à un autre membre. */
async function findExistingFiche(admin: any, name: string): Promise<string | null> {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  const found: string[] = [];
  for (let page = 0; page < 20; page++) {
    const data = await cu<{ tasks: Array<{ id: string; name: string }>; last_page?: boolean }>(`/list/${CLICKUP.lists.fiches}/task?include_closed=true&subtasks=true&archived=false&page=${page}`);
    for (const t of data.tasks) if (normalizeName(t.name) === wanted) found.push(t.id);
    if (data.last_page !== false || data.tasks.length < 100) break;
  }
  if (found.length !== 1) return null;
  const { data: taken } = await admin.from("profiles").select("id").eq("clickup_task_id", found[0]).limit(1);
  return (taken ?? []).length ? null : found[0]!;
}

function memberLink(id: string) {
  return `${DEFAULT_APP_ORIGIN}/admin/membres/${id}`;
}
function requestLink(id: string) {
  return `${DEFAULT_APP_ORIGIN}/admin/demandes/${id}`;
}

/** Fiche client d'un membre : créée ou rapprochée, puis mise à jour champ par champ. Renvoie l'identifiant de la fiche. */
export async function syncMember(admin: any, memberId: string, dir: Directory): Promise<string | null> {
  const { data: p } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, plan, member_number, member_since, valid_until, disabled_at, concierge_referent, clickup_task_id, clickup_state")
    .eq("id", memberId)
    .maybeSingle();
  if (!p) return null;
  // Comptes de l'équipe et comptes anonymisés : rien n'est envoyé à ClickUp.
  if (!p.plan || (p.full_name === "Membre supprimé" && !p.email) || (await isTeamAccount(admin, memberId))) return p.clickup_task_id ?? null;

  const values: FicheValues = {
    name: p.full_name.trim() || "Membre",
    status: ficheStatus(p.disabled_at),
    formule: CLICKUP.options.formule[p.plan] ?? null,
    concierge: p.plan === "Signature" ? await dir.byName(p.concierge_referent) : null,
  };
  let taskId: string | null = p.clickup_task_id;
  let state: Partial<FicheValues> | null = p.clickup_state;

  if (!taskId) {
    const existing = await findExistingFiche(admin, values.name);
    if (existing) {
      taskId = existing;
      state = { name: values.name }; // fiche existante : son nom n'est pas réécrit
    } else {
      const lines = [
        "Fiche créée par l'application membre.",
        "",
        `- E-mail : ${p.email ?? "—"}`,
        `- Téléphone : ${p.phone ?? "—"}`,
        `- N° de membre : ${p.member_number}`,
        `- Membre depuis le ${p.member_since} · validité ${p.valid_until}`,
        `- Fiche dans l'application : ${memberLink(p.id)}`,
      ];
      const created = await cu<{ id: string }>(`/list/${CLICKUP.lists.fiches}/task`, {
        method: "POST",
        body: {
          name: values.name,
          status: values.status,
          markdown_content: lines.join("\n"),
          custom_fields: [
            ...(values.formule ? [{ id: CLICKUP.fiche.formule, value: values.formule }] : []),
          ],
        },
      });
      taskId = created.id;
      state = { ...values, concierge: null }; // le concierge référent se pose juste après
    }
    await admin.from("profiles").update({ clickup_task_id: taskId, clickup_state: state }).eq("id", memberId);
  }

  const changed = changedKeys(values, state);
  if (changed.includes("name") || changed.includes("status")) {
    await cu(`/task/${taskId}`, { method: "PUT", body: { name: values.name, status: values.status } });
  }
  if (changed.includes("formule")) await setField(taskId, CLICKUP.fiche.formule, values.formule);
  if (changed.includes("concierge")) {
    const previous = (state?.concierge ?? null) as number | null;
    if (values.concierge || previous) {
      await setField(taskId, CLICKUP.fiche.conciergeReferent, { add: values.concierge ? [values.concierge] : [], rem: previous && previous !== values.concierge ? [previous] : [] });
    }
  }
  if (changed.length) await admin.from("profiles").update({ clickup_state: { ...(state ?? {}), ...values } }).eq("id", memberId);
  return taskId;
}

/** Tâche « Demandes Clients » d'une demande : créée puis mise à jour champ par champ. */
export async function syncRequest(admin: any, requestId: string, dir: Directory): Promise<void> {
  const { data: r } = await admin
    .from("requests")
    .select("id, user_id, category, status, title, description, scheduled_date, scheduled_time, guests, concierge_id, amount_cents, delegate_record, clickup_task_id, clickup_state")
    .eq("id", requestId)
    .maybeSingle();
  if (!r) return;
  const { data: member } = await admin.from("profiles").select("id, full_name, email, plan, clickup_task_id").eq("id", r.user_id).maybeSingle();
  if (!member || (member.full_name === "Membre supprimé" && !member.email)) return;

  const fiche = member.clickup_task_id ?? (await syncMember(admin, member.id, dir));
  const [{ data: proposals }, { data: invoices }, { data: review }, concierge, delegate] = await Promise.all([
    admin.from("request_proposals").select("id").eq("request_id", r.id).eq("status", "en attente").limit(1),
    admin.from("invoices").select("status, amount_cents").eq("request_id", r.id),
    admin.from("request_reviews").select("rating, comment").eq("request_id", r.id).maybeSingle(),
    r.concierge_id ? admin.from("profiles").select("email").eq("id", r.concierge_id).maybeSingle() : Promise.resolve({ data: null }),
    r.delegate_record ? admin.from("member_delegates").select("full_name").eq("id", r.delegate_record).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const paid = ((invoices ?? []) as Array<{ status: string; amount_cents: number }>).filter((i) => i.status === "Payée");
  const paidCents = paid.reduce((s, i) => s + i.amount_cents, 0);

  const details = [
    `Demande faite dans l'application par ${member.full_name}${delegate.data?.full_name ? `, pour le compte de son proche ${delegate.data.full_name}` : ""}.`,
    "",
    r.description?.trim() || "(sans précision)",
    "",
    `- Catégorie : ${r.category}`,
    ...(r.scheduled_date ? [`- Date souhaitée : ${r.scheduled_date}${r.scheduled_time ? ` à ${r.scheduled_time} (heure du lieu)` : ""}`] : []),
    ...(r.guests ? [`- Personnes : ${r.guests}`] : []),
    `- Dans l'application : ${requestLink(r.id)}`,
  ];
  const values: DemandeValues = {
    name: r.title,
    status: demandeStatus(r.status, (proposals ?? []).length > 0),
    description: details.join("\n"),
    type: CLICKUP.options.typePrestation[r.category] ?? null,
    date: prestationTimestamp(r.scheduled_date, r.scheduled_time),
    formule: CLICKUP.options.formule[member.plan ?? ""] ?? null,
    montantSigne: r.amount_cents === null || r.amount_cents === undefined ? null : r.amount_cents / 100,
    montantPaye: paid.length ? paidCents / 100 : null,
    paiement: (invoices ?? []).length ? (paid.length ? CLICKUP.options.paiement.paye : CLICKUP.options.paiement.nonPaye) : null,
    note: review.data?.rating ? RATING_STARS[review.data.rating] ?? null : null,
    commentaire: review.data?.comment?.trim() || null,
    assignee: await dir.byEmail(concierge.data?.email),
    fiche: fiche ?? null,
  };

  let taskId: string | null = r.clickup_task_id;
  let state: Partial<DemandeValues> | null = r.clickup_state;
  if (!taskId) {
    const fields: Array<{ id: string; value: unknown; value_options?: Record<string, unknown> }> = [{ id: CLICKUP.demande.canal, value: CLICKUP.options.canalApplication }];
    if (values.type) fields.push({ id: CLICKUP.demande.typePrestation, value: values.type });
    if (values.date) fields.push({ id: CLICKUP.demande.datePrestation, value: values.date.value, value_options: { time: values.date.time } });
    if (values.formule) fields.push({ id: CLICKUP.demande.formule, value: values.formule });
    if (values.montantSigne !== null) fields.push({ id: CLICKUP.demande.montantSigne, value: values.montantSigne });
    if (values.montantPaye !== null) fields.push({ id: CLICKUP.demande.montantPaye, value: values.montantPaye });
    if (values.paiement) fields.push({ id: CLICKUP.demande.statutPaiement, value: values.paiement });
    if (values.note) fields.push({ id: CLICKUP.demande.noteSatisfaction, value: values.note });
    if (values.commentaire) fields.push({ id: CLICKUP.demande.commentaires, value: values.commentaire });
    const created = await cu<{ id: string }>(`/list/${CLICKUP.lists.demandes}/task`, {
      method: "POST",
      body: { name: values.name, status: values.status, markdown_content: values.description, assignees: values.assignee ? [values.assignee] : [], custom_fields: fields },
    });
    taskId = created.id;
    state = { ...values, fiche: null }; // la relation à la fiche se pose juste après
    await admin.from("requests").update({ clickup_task_id: taskId, clickup_state: state }).eq("id", r.id);
  }

  const changed = changedKeys(values, state);
  const put: Record<string, unknown> = {};
  if (changed.includes("name")) put["name"] = values.name;
  if (changed.includes("status")) put["status"] = values.status;
  if (changed.includes("description")) put["markdown_content"] = values.description;
  if (changed.includes("assignee")) {
    const previous = (state?.assignee ?? null) as number | null;
    put["assignees"] = { add: values.assignee ? [values.assignee] : [], rem: previous && previous !== values.assignee ? [previous] : [] };
  }
  if (Object.keys(put).length) await cu(`/task/${taskId}`, { method: "PUT", body: put });
  if (changed.includes("type")) await setField(taskId, CLICKUP.demande.typePrestation, values.type);
  if (changed.includes("date")) await setField(taskId, CLICKUP.demande.datePrestation, values.date?.value ?? null, values.date ? { time: values.date.time } : undefined);
  if (changed.includes("formule")) await setField(taskId, CLICKUP.demande.formule, values.formule);
  if (changed.includes("montantSigne")) await setField(taskId, CLICKUP.demande.montantSigne, values.montantSigne);
  if (changed.includes("montantPaye")) await setField(taskId, CLICKUP.demande.montantPaye, values.montantPaye);
  if (changed.includes("paiement")) await setField(taskId, CLICKUP.demande.statutPaiement, values.paiement);
  if (changed.includes("note")) await setField(taskId, CLICKUP.demande.noteSatisfaction, values.note);
  if (changed.includes("commentaire")) await setField(taskId, CLICKUP.demande.commentaires, values.commentaire);
  if (changed.includes("fiche")) {
    const previous = (state?.fiche ?? null) as string | null;
    if (values.fiche || previous) {
      await setField(taskId, CLICKUP.demande.ficheClient, { add: values.fiche ? [values.fiche] : [], rem: previous && previous !== values.fiche ? [previous] : [] });
    }
  }
  if (changed.length) await admin.from("requests").update({ clickup_state: { ...(state ?? {}), ...values } }).eq("id", r.id);
}

type OutboxRow = { kind: "membre" | "demande"; ref_id: string; version: number; attempts: number };

/** Vide la file des changements à envoyer (fiches avant demandes), dans la limite de temps donnée. */
export async function processClickupOutbox(admin: any, budgetMs = 45000): Promise<{ skipped?: string; done: number; failed: number }> {
  if (!token()) return { skipped: "missing_CLICKUP_API_TOKEN", done: 0, failed: 0 };
  const started = Date.now();
  const dir = new Directory();
  let done = 0;
  let failed = 0;
  const { data: rows } = await admin
    .from("clickup_outbox")
    .select("kind, ref_id, version, attempts")
    .lte("next_attempt_at", new Date().toISOString())
    .order("kind", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(40);
  for (const row of (rows ?? []) as OutboxRow[]) {
    if (Date.now() - started > budgetMs) break;
    try {
      if (row.kind === "membre") await syncMember(admin, row.ref_id, dir);
      else await syncRequest(admin, row.ref_id, dir);
      await admin.from("clickup_outbox").delete().eq("kind", row.kind).eq("ref_id", row.ref_id).eq("version", row.version);
      done++;
    } catch (err) {
      failed++;
      const attempts = row.attempts + 1;
      const message = String(err instanceof Error ? err.message : err).slice(0, 300);
      await admin
        .from("clickup_outbox")
        .update({ attempts, last_error: message, next_attempt_at: new Date(Date.now() + retryDelayMinutes(attempts) * 60000).toISOString() })
        .eq("kind", row.kind)
        .eq("ref_id", row.ref_id)
        .eq("version", row.version);
      if (attempts === ALERT_AFTER_ATTEMPTS) {
        const status = /ClickUp (\d{3})/.exec(message)?.[1];
        await admin.from("notification_failures").insert({
          kind: "clickup",
          request_id: row.kind === "demande" ? row.ref_id : null,
          user_id: row.kind === "membre" ? row.ref_id : null,
          reason: status ? `clickup_error:${status}` : "clickup_unreachable",
        });
      }
    }
  }
  return { done, failed };
}
