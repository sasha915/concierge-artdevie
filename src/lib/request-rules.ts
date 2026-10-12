export const OPEN_STATUSES = ["Nouvelle", "En cours", "Confirmée"] as const;

/** Une réponse vide efface la réponse et sa date ; sinon elles sont horodatées. */
export function replyUpdate(reply: string, now: Date = new Date()) {
  const text = reply.trim();
  return text ? { team_reply: text, team_reply_at: now.toISOString() } : { team_reply: null, team_reply_at: null };
}
