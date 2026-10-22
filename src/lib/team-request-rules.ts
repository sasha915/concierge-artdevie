export type HistoryEvent = { id: string; kind: string; detail: string | null; created_at: string; author_name: string; actor_id: string | null };

export function requestHistory(events: HistoryEvent[], createdAt: string): Array<HistoryEvent & { label: string }> {
  const rows = events.some((e) => e.kind === "reçue") ? [...events] : [{ id: "received-fallback", kind: "reçue", detail: null, created_at: createdAt, author_name: "Le membre", actor_id: null }, ...events];
  let handled = false;
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at)).map((e) => {
    const firstHandling = !handled && e.kind === "statut changé" && e.detail === "Nouvelle → En cours";
    if (firstHandling) handled = true;
    const label = firstHandling ? "Prise en charge" : e.kind === "attribuée" ? `Attribuée · ${e.detail || "À attribuer"}` : e.kind === "statut changé" ? `Statut changé · ${e.detail ?? ""}` : e.kind.charAt(0).toUpperCase() + e.kind.slice(1) + (e.detail ? ` · ${e.detail}` : "");
    return { ...e, label };
  });
}

export function insertReply(text: string, body: string, cursor: number | null) {
  const position = cursor === null ? text.length : Math.max(0, Math.min(cursor, text.length));
  return { text: text.slice(0, position) + body + text.slice(position), cursor: position + body.length };
}

export function matchesRequestFilters(r: { title: string; member_name: string; category: string; concierge: string; concierge_id?: string | null }, f: { search: string; category: string; concierge: string; mine: boolean; unassigned: boolean; userId: string | null }) {
  const needle = f.search.trim().toLocaleLowerCase("fr");
  return (!needle || `${r.title} ${r.member_name}`.toLocaleLowerCase("fr").includes(needle)) && (!f.category || r.category === f.category) && (!f.concierge || r.concierge === f.concierge) && (!f.mine || (f.userId !== null && r.concierge_id === f.userId)) && (!f.unassigned || r.concierge === "À attribuer");
}