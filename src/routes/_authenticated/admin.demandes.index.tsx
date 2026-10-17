import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { AdminShell, TeamStatus } from "@/components/art-de-vie/admin-shell";
import { Title } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate, type RequestStatus } from "@/data/art-de-vie";
import { allRequestsQuery } from "@/lib/admin-queries";

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

const STATUSES: RequestStatus[] = ["Nouvelle", "En cours", "Confirmée", "Terminée", "Annulée"];
const control = "h-11 rounded-full border border-border bg-card px-4 text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Page() {
  const { data = [], isLoading } = useQuery(allRequestsQuery);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [concierge, setConcierge] = useState("");
  const categories = useMemo(() => [...new Set(data.map((r) => r.category))].sort(), [data]);
  const concierges = useMemo(() => [...new Set(data.map((r) => r.concierge))].sort(), [data]);
  const needle = q.trim().toLowerCase();
  const list = data.filter((r) =>
    (!needle || r.title.toLowerCase().includes(needle) || r.member_name.toLowerCase().includes(needle)) &&
    (!category || r.category === category) && (!concierge || r.concierge === concierge));

  return <AdminShell>
    <p className="eyebrow team-mention">( Demandes )</p>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <Title italic="demandes." className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">Les </Title>
      <Link to="/admin/demandes/nouvelle" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="size-4" />Nouvelle demande</Link>
    </div>

    <div className="mt-6 flex flex-wrap gap-2">
      <label className="relative min-w-0 flex-1 basis-full sm:basis-[280px]">
        <span className="sr-only">Rechercher par membre ou par titre</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un membre ou une demande…" className={`${control} w-full pl-10 placeholder:text-muted-foreground`} />
      </label>
      <label className="min-w-0 flex-1 sm:flex-none"><span className="sr-only">Catégorie</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${control} w-full`}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="min-w-0 flex-1 sm:flex-none"><span className="sr-only">Concierge</span>
        <select value={concierge} onChange={(e) => setConcierge(e.target.value)} className={`${control} w-full`}>
          <option value="">Tous les concierges</option>
          {concierges.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
    </div>

    {isLoading ? <div className="mt-6 grid gap-4 lg:grid-cols-5">{STATUSES.map((s) => <Skeleton key={s} className="h-[320px] rounded-[28px] bg-primary/10" />)}</div>
      : <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {STATUSES.map((status) => {
          const items = list.filter((r) => r.status === status);
          const muted = status === "Annulée";
          return <section key={status} aria-label={`${status} : ${items.length}`} className={`team-panel min-w-0 rounded-[28px] p-4 ${muted ? "opacity-70" : ""}`}>
            <header className="flex items-center justify-between gap-2 px-1">
              <h2 className="flex items-center gap-2 text-[18px]">{status}<span className="inline-flex size-6 items-center justify-center rounded-full border border-border text-[12px]">{items.length}</span></h2>
              <TeamStatus status={status} />
            </header>
            {items.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-border p-5 text-center text-[13px] text-muted-foreground">Aucune demande.</p>
              : <ul className="mt-4 grid gap-3">{items.map((r) => <li key={r.id}>
                  <Link to="/admin/demandes/$requestId" params={{ requestId: r.id }} className="block rounded-2xl bg-primary-deep/60 p-4 transition-colors hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <p className="eyebrow team-mention text-[10px]">{r.category}</p>
                    <p className="mt-2 break-words text-[19px] leading-tight">{r.title}</p>
                    <p className="mt-2 text-[13px] text-muted-foreground">{r.member_name || "Membre"}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[12px]">
                      <span className="text-muted-foreground">{r.scheduled_date ? formatShortDate(r.scheduled_date) : "Date à définir"}{r.scheduled_time ? ` · ${r.scheduled_time.slice(0, 5).replace(":", " h ")}` : ""}</span>
                      <span className="rounded-full border border-border px-2 py-0.5">{r.concierge}</span>
                    </div>
                  </Link>
                </li>)}</ul>}
          </section>;
        })}
      </div>}
  </AdminShell>;
}
