import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminShell, teamStatusClass } from "@/components/art-de-vie/admin-shell";
import { Title } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { agendaQuery } from "@/lib/admin-queries";
import type { AgendaItem } from "@/lib/admin.functions";
import { addDays, monthGrid, startOfMonth, weekDays } from "@/lib/agenda-rules";
import { addMonths } from "@/lib/planning-rules";

export const Route = createFileRoute("/_authenticated/admin/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Équipe Art de Vie" },
      { name: "description", content: "Les prestations datées et les échéances récurrentes de la conciergerie Art de Vie, au mois ou à la semaine." },
      { property: "og:title", content: "Agenda — Équipe Art de Vie" },
      { property: "og:description", content: "Les prestations datées et les échéances récurrentes de la conciergerie Art de Vie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const WEEKDAYS_SHORT = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];
const LEGEND = ["Nouvelle", "En cours", "Confirmée", "Terminée"];
const MAX_IN_CELL = 3;

function todayIso(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function label(iso: string, opts: Intl.DateTimeFormatOptions): string {
  const text = new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { ...opts, timeZone: "UTC" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const pill = "inline-flex h-11 items-center rounded-full px-4 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Toggle<T extends string>({ value, options, onChange, name }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; name: string }) {
  return (
    <div role="group" aria-label={name} className="team-glass inline-flex flex-wrap gap-1 rounded-full p-1">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={`${pill} ${value === o.value ? "bg-primary font-medium text-primary-foreground" : "hover:bg-primary/10"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function itemClass(item: AgendaItem): string {
  return item.kind === "echeance" ? "border border-dashed border-primary/70 text-primary" : teamStatusClass(item.status);
}

function ItemLink({ item, compact = false }: { item: AgendaItem; compact?: boolean }) {
  const text = compact ? `${item.time ? `${item.time} · ` : ""}${item.title}` : item.title;
  const title = `${item.title} — ${item.member_name || "Membre"}${item.kind === "echeance" ? " · échéance récurrente à venir" : ` · ${item.status}`}`;
  const cls = `block min-w-0 px-3 text-[12px] leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compact ? "truncate rounded-full py-1" : "rounded-2xl py-2"} ${itemClass(item)}`;
  const body = compact ? text : (
    <span className="block min-w-0">
      <span className="block truncate font-medium">{text}</span>
      <span className="block truncate opacity-80">{[item.time, item.member_name || "Membre", item.kind === "echeance" ? "Échéance à venir" : item.status].filter(Boolean).join(" · ")}</span>
    </span>
  );
  if (item.request_id) {
    return <Link to="/admin/demandes/$requestId" params={{ requestId: item.request_id }} title={title} className={cls}>{body}</Link>;
  }
  return <Link to="/admin/membres/$memberId" params={{ memberId: item.member_id }} title={title} className={cls}>{body}</Link>;
}

function Page() {
  const today = todayIso();
  const [view, setView] = useState<"mois" | "semaine">("mois");
  const [scope, setScope] = useState<"equipe" | "moi">("equipe");
  const [anchor, setAnchor] = useState(today);

  const weeks = useMemo(() => monthGrid(anchor), [anchor]);
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const first = days[0] ?? anchor;
  const last = days[6] ?? anchor;
  const from = view === "mois" ? (weeks[0]?.[0] ?? anchor) : first;
  const to = view === "mois" ? (weeks[weeks.length - 1]?.[6] ?? anchor) : last;
  const { data, isLoading, isError } = useQuery({ ...agendaQuery(from, to), placeholderData: keepPreviousData });

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const item of data?.items ?? []) {
      if (scope === "moi" && item.concierge_id !== data?.me) continue;
      map.set(item.date, [...(map.get(item.date) ?? []), item]);
    }
    return map;
  }, [data, scope]);

  const month = startOfMonth(anchor);
  const heading = view === "mois"
    ? label(month, { month: "long", year: "numeric" })
    : `${label(first, { day: "numeric", month: "long" })} – ${label(last, { day: "numeric", month: "long", year: "numeric" })}`;

  function move(delta: number) {
    setAnchor((a) => (view === "mois" ? addMonths(startOfMonth(a), delta) : addDays(a, delta * 7)));
  }

  const listDays = (view === "mois" ? weeks.flat().filter((d) => d.startsWith(month.slice(0, 7))) : days).filter((d) => byDay.has(d));

  return (
    <AdminShell>
      <p className="eyebrow team-mention">Agenda</p>
      <Title italic="agenda." className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">L’</Title>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Toggle name="Vue" value={view} onChange={setView} options={[{ value: "mois", label: "Mois" }, { value: "semaine", label: "Semaine" }]} />
          <Toggle name="Prestations affichées" value={scope} onChange={setScope} options={[{ value: "equipe", label: "Toute l’équipe" }, { value: "moi", label: "Mes prestations" }]} />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label={view === "mois" ? "Mois précédent" : "Semaine précédente"} onClick={() => move(-1)}><ChevronLeft /></Button>
          <p className="min-w-[180px] text-center text-[18px]" aria-live="polite">{heading}</p>
          <Button type="button" variant="outline" size="icon" aria-label={view === "mois" ? "Mois suivant" : "Semaine suivante"} onClick={() => move(1)}><ChevronRight /></Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(today)}>Aujourd’hui</Button>
        </div>
      </div>

      <ul aria-label="Légende" className="mt-4 flex flex-wrap gap-2">
        {LEGEND.map((s) => <li key={s} className={`rounded-full px-3 py-1 text-[11px] font-medium ${teamStatusClass(s)}`}>{s}</li>)}
        <li className="rounded-full border border-dashed border-primary/70 px-3 py-1 text-[11px] font-medium">Récurrente</li>
      </ul>

      {isError ? <p role="alert" className="team-panel mt-6 rounded-[28px] p-6 text-[14px] text-muted-foreground">L’agenda n’a pas pu être chargé.</p>
        : isLoading && !data ? <Skeleton className="mt-6 h-[520px] rounded-[28px] bg-primary/10" />
        : <>
          {/* 1024 px et plus : grille */}
          <section aria-label={heading} className="team-panel mt-6 hidden rounded-[28px] p-4 lg:block">
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAYS.map((d, i) => <p key={d} className="eyebrow team-mention px-2 pb-2 text-[10px]">{view === "semaine" ? `${d} ${label(days[i] ?? first, { day: "numeric" })}` : <abbr title={d} className="no-underline">{WEEKDAYS_SHORT[i]}</abbr>}</p>)}
              {(view === "mois" ? weeks.flat() : days).map((d) => {
                const items = byDay.get(d) ?? [];
                const outside = view === "mois" && !d.startsWith(month.slice(0, 7));
                const shown = view === "mois" ? items.slice(0, MAX_IN_CELL) : items;
                return (
                  <div key={d} className={`flex min-w-0 flex-col gap-1 rounded-2xl p-2 ${view === "mois" ? "min-h-[120px]" : "min-h-[360px]"} ${d === today ? "ring-1 ring-primary" : ""} ${outside ? "opacity-45" : "team-glass"}`}>
                    {view === "mois" && <p className={`px-1 text-[13px] ${d === today ? "font-semibold" : "team-mention"}`}>{Number(d.slice(8))}</p>}
                    {shown.map((item) => <ItemLink key={item.key} item={item} compact={view === "mois"} />)}
                    {items.length > shown.length && (
                      <button type="button" onClick={() => { setAnchor(d); setView("semaine"); }} className="rounded-full px-2 py-1 text-left text-[12px] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        + {items.length - shown.length} autre{items.length - shown.length > 1 ? "s" : ""}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Moins de 1024 px : une colonne, jour par jour */}
          <section aria-label={heading} className="mt-6 lg:hidden">
            {listDays.length === 0 ? <p className="team-panel rounded-[28px] p-6 text-[14px] text-muted-foreground">Aucune prestation sur cette période.</p>
              : <ol className="grid gap-3">{listDays.map((d) => (
                  <li key={d} className="team-panel rounded-[28px] p-5">
                    <p className={`eyebrow ${d === today ? "" : "team-mention"}`}>{label(d, { weekday: "long", day: "numeric", month: "long" })}</p>
                    <ul className="mt-3 grid gap-2">{(byDay.get(d) ?? []).map((item) => <li key={item.key}><ItemLink item={item} /></li>)}</ul>
                  </li>
                ))}</ol>}
          </section>
          {listDays.length === 0 && <p className="mt-4 hidden text-[14px] text-muted-foreground lg:block">Aucune prestation sur cette période.</p>}
        </>}
    </AdminShell>
  );
}
