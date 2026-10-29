import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { AdminShell, TeamStatus } from "@/components/art-de-vie/admin-shell";
import { Title } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatShortDate, type RequestStatus } from "@/data/art-de-vie";
import { allRequestsQuery, teamSelfQuery } from "@/lib/admin-queries";
import { isStaleRequest, waitingLabel } from "@/lib/watch-rules";
import { matchesRequestFilters } from "@/lib/team-request-rules";

export const Route = createFileRoute("/_authenticated/admin/demandes/")({
  head: () => ({ meta: [
    { title: "Demandes — Équipe Art de Vie" },
    { name: "description", content: "Toutes les demandes des membres, classées par statut." },
    { property: "og:title", content: "Demandes — Équipe Art de Vie" },
    { property: "og:description", content: "Toutes les demandes des membres, classées par statut." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

const STATUSES: RequestStatus[] = ["Nouvelle", "En cours", "Confirmée", "Terminée"];
const EMPTY: Record<string, string> = {
  "Nouvelle": "Aucune nouvelle demande.",
  "En cours": "Aucune demande en cours.",
  "Confirmée": "Aucune demande confirmée.",
  "Terminée": "Aucune demande terminée pour le moment.",
};
const control = "h-11 rounded-full border border-border bg-card px-4 text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Page() {
  const { data = [], isLoading } = useQuery(allRequestsQuery);
  const { data: userId = null } = useQuery(teamSelfQuery);
  const [mine, setMine] = useState(false);
  const [unassigned, setUnassigned] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [concierge, setConcierge] = useState("");
  const categories = useMemo(() => [...new Set(data.map((r) => r.category))].sort(), [data]);
  const concierges = useMemo(() => [...new Set(data.map((r) => r.concierge))].sort(), [data]);
  const list = data.filter((r) => matchesRequestFilters(r, { search: q, category, concierge, mine, unassigned, userId }));
  const [view, setView] = useState<"colonnes" | "liste">("colonnes");
  const [showCancelled, setShowCancelled] = useState(false);

  return <AdminShell>
    <p className="eyebrow team-mention">Demandes</p>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <Title italic="demandes." className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">Les </Title>
      <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Affichage" className="team-glass inline-flex gap-1 rounded-full p-1">
        {(["colonnes", "liste"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`h-9 rounded-full px-4 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-primary/10"}`}>{v === "colonnes" ? "Colonnes" : "Liste"}</button>)}
      </div>
      <Link to="/admin/demandes/nouvelle" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="size-4" />Nouvelle demande</Link>
      </div>
    </div>

    <div className="mt-6 flex flex-wrap gap-2">
      <label className="relative min-w-0 flex-1 basis-full sm:basis-[280px]">
        <span className="sr-only">Rechercher par membre ou par titre</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une demande…" className={`${control} w-full pl-10 placeholder:text-muted-foreground`} />
      </label>
      <div className="flex basis-full flex-wrap gap-2" role="group" aria-label="Filtrer les attributions">
        <Button type="button" variant="ghost" aria-pressed={mine} disabled={!userId} onClick={() => setMine((v) => !v)} className={`h-9 text-[13px] ${mine ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "border border-border text-muted-foreground"}`}>Mes demandes</Button>
        <Button type="button" variant="ghost" aria-pressed={unassigned} onClick={() => setUnassigned((v) => !v)} className={`h-9 text-[13px] ${unassigned ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "border border-border text-muted-foreground"}`}>À attribuer</Button>
      </div>
      <div className="no-scrollbar flex w-full min-w-0 gap-2 overflow-x-auto sm:flex-wrap" role="group" aria-label="Filtrer par catégorie">
        {["", ...categories].map((c) => <button key={c || "all"} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${category === c ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>{c || "Toutes"}</button>)}
      </div>
      <div className="no-scrollbar flex w-full min-w-0 gap-2 overflow-x-auto sm:flex-wrap" role="group" aria-label="Filtrer par concierge">
        {["", ...concierges].map((c) => <button key={c || "all"} type="button" onClick={() => setConcierge(c)} aria-pressed={concierge === c} className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${concierge === c ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>{c || "Tous les concierges"}</button>)}
      </div>
    </div>

    {!isLoading && view === "liste" ? <ListView items={list} /> : isLoading ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{STATUSES.map((s) => <Skeleton key={s} className="h-[320px] rounded-[24px] bg-primary/10" />)}</div>
      : <>
      <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((status) => {
          const items = list.filter((r) => r.status === status);
          return <section key={status} aria-label={`${status} : ${items.length}`} className="team-panel min-w-0 rounded-[24px] p-4">
            <header className="flex items-center justify-between gap-2 px-1">
              <h2 className="flex items-center gap-2 text-[18px]">{status}<span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[12px] font-semibold text-primary-foreground">{items.length}</span></h2>
              <TeamStatus status={status} />
            </header>
            {items.length === 0 ? <p className="mt-4 rounded-[18px] border border-dashed border-border p-5 text-center text-[13px] text-muted-foreground">{EMPTY[status]}</p>
              : <ul className="mt-4 grid gap-3">{items.map((r) => <li key={r.id}><RequestCard r={r} /></li>)}</ul>}
          </section>;
        })}
      </div>
      <CancelledBar items={list.filter((r) => r.status === "Annulée")} open={showCancelled} onToggle={() => setShowCancelled((v) => !v)} />
      </>}
  </AdminShell>;
}

type BoardItem = ListItem & { title: string; scheduled_time?: string | null };

/** Carte d'une colonne : fond de page (#241C33) pour se détacher du panneau, rayon 18 px. */
function RequestCard({ r }: { r: BoardItem }) {
  return <Link to="/admin/demandes/$requestId" params={{ requestId: r.id }} className="block rounded-[18px] bg-background p-4 transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="eyebrow team-mention text-[10px]">{r.category}</p>{isStaleRequest(r) && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">Sans prise en charge · {waitingLabel(r.created_at)}</span>}{r.pending_change && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">Modification demandée</span>}</div>
    <p className="mt-2 break-words text-[19px] leading-tight">{r.title}</p>
    <p className="mt-2 text-[13px] text-muted-foreground">{r.member_name || "Membre"}</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[12px]">
      <span className="text-muted-foreground">{r.scheduled_date ? formatShortDate(r.scheduled_date) : "Date à définir"}{r.scheduled_time ? ` · ${r.scheduled_time.slice(0, 5).replace(":", " h ")}` : ""}</span>
      <span className="rounded-full border border-border px-2 py-0.5">{r.concierge}</span>
    </div>
  </Link>;
}

/** Demandes annulées : barre de verre repliée sous les colonnes. */
function CancelledBar({ items, open, onToggle }: { items: BoardItem[]; open: boolean; onToggle: () => void }) {
  return <section aria-label={`Annulée : ${items.length}`} className="team-glass mt-4 rounded-[24px] px-5 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[16px] text-muted-foreground">Annulée<span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-dashed border-border px-1.5 text-[12px]">{items.length}</span></h2>
      {items.length > 0 && <button type="button" aria-expanded={open} onClick={onToggle} className="inline-flex h-11 items-center rounded-full border border-border px-4 text-[13px] hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{open ? "Masquer" : "Afficher"}</button>}
    </div>
    {items.length === 0 ? <p className="mt-2 text-[13px] text-muted-foreground">Aucune demande annulée.</p>
      : !open ? <p className="mt-2 text-[13px] text-muted-foreground">{items.slice(0, 3).map((r) => r.title).join(" · ")}{items.length > 3 ? "…" : ""}</p>
      : <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{items.map((r) => <li key={r.id} className="opacity-80"><RequestCard r={r} /></li>)}</ul>}
  </section>;
}

type ListItem = Parameters<typeof matchesRequestFilters>[0] & { id: string; title: string; status: string; category: string; member_name?: string; scheduled_date: string | null; concierge: string; created_at: string; pending_change?: boolean };

/** Vue « Liste » : une ligne par demande, triée par date souhaitée. */
function ListView({ items }: { items: ListItem[] }) {
  const sorted = [...items].sort((a, b) => (a.scheduled_date ?? "9999").localeCompare(b.scheduled_date ?? "9999"));
  if (sorted.length === 0) return <p className="team-panel mt-6 rounded-[28px] p-6 text-[14px] text-muted-foreground">Aucune demande.</p>;
  return <ul className="team-panel mt-6 rounded-[28px] px-5">
    {sorted.map((r) => <li key={r.id} className="border-b border-border last:border-0">
      <Link to="/admin/demandes/$requestId" params={{ requestId: r.id }} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <span className="min-w-0"><span className="eyebrow team-mention block text-[10px]">{r.category}</span><span className="mt-1 block truncate text-[18px]">{r.title}</span><span className="mt-1 block text-[13px] text-muted-foreground lg:hidden">{r.member_name || "Membre"} · {r.scheduled_date ? formatShortDate(r.scheduled_date) : "Date à définir"}</span></span>
        <span className="hidden truncate text-[14px] text-muted-foreground lg:block">{r.member_name || "Membre"}</span>
        <span className="hidden text-[14px] text-muted-foreground lg:block">{r.scheduled_date ? formatShortDate(r.scheduled_date) : "Date à définir"}</span>
        <span className="flex items-center gap-2">{r.pending_change && <span className="hidden rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground sm:inline">Modification demandée</span>}<TeamStatus status={r.status} /></span>
      </Link>
    </li>)}
  </ul>;
}
