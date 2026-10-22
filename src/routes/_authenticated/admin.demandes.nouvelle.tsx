import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, Search } from "lucide-react";
import { AdminShell } from "@/components/art-de-vie/admin-shell";
import { RequestCard } from "@/components/art-de-vie/cards";
import { Title } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RequestItem } from "@/data/art-de-vie";
import { teamNamesQuery } from "@/lib/admin-queries";
import { createRequestForMember, listRequestableMembers } from "@/lib/admin.functions";
import { RHYTHMS, type Rhythm } from "@/lib/planning-rules";

export const Route = createFileRoute("/_authenticated/admin/demandes/nouvelle")({
  head: () => ({ meta: [
    { title: "Demande pour un membre — Équipe Art de Vie" },
    { name: "description", content: "Créer une demande au nom d’un membre de la conciergerie." },
    { property: "og:title", content: "Demande pour un membre — Équipe Art de Vie" },
    { property: "og:description", content: "Créer une demande au nom d’un membre de la conciergerie." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

const CATS = [
  { name: "Tables", imageKey: "entree-de-nuit" },
  { name: "Séjours", imageKey: "village-cotier" },
  { name: "Transferts", imageKey: "place-vendome" },
  { name: "Soins", imageKey: "bassin" },
  { name: "Sur mesure", imageKey: "sur-mesure" },
] as const;
type Cat = (typeof CATS)[number]["name"];
const UNASSIGNED = "À attribuer";
const select = "h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Page() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listRequestableMembers);
  const create = useServerFn(createRequestForMember);
  const { data: members = [], isLoading } = useQuery({ queryKey: ["admin", "requestable-members"], queryFn: () => fetchMembers() });
  const { data: team = [] } = useQuery(teamNamesQuery);

  const [q, setQ] = useState("");
  const [memberId, setMemberId] = useState("");
  const [category, setCategory] = useState<Cat>("Tables");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState("");
  const [description, setDescription] = useState("");
  const [conciergeId, setConcierge] = useState("");
  const [rhythm, setRhythm] = useState<"aucune" | Rhythm>("aucune");
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [nextDate, setNextDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const concierge = team.find((t) => t.id === conciergeId)?.name ?? UNASSIGNED;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => members.filter((m) => !needle || m.full_name.toLowerCase().includes(needle) || (m.email ?? "").toLowerCase().includes(needle)), [members, needle]);
  const member = members.find((m) => m.id === memberId) ?? null;
  const guestsLabel = category === "Tables" ? "Couverts" : "Personnes";

  const preview: RequestItem = {
    id: "apercu", category, status: "Nouvelle", title: title || `Demande ${category.toLowerCase()}`, description,
    scheduled_date: date || null, scheduled_time: time || null, guests: guests ? Number(guests) : null,
    concierge, image_key: CATS.find((c) => c.name === category)?.imageKey ?? "entree-de-nuit",
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId) { setError("Choisissez un membre."); return; }
    setBusy(true); setError(null);
    try {
      const res = await create({ data: { memberId, category, title, description, scheduledDate: date, scheduledTime: time, guests: guests ? Number(guests) : null, conciergeId: conciergeId || null, recurrence: rhythm === "aucune" ? null : { rhythm, dates: extraDates, endDate: endDate || null } } });
      if (!res.ok) { setError(res.reason); return; }
      await qc.invalidateQueries({ queryKey: ["admin"] });
      await navigate({ to: "/admin/demandes/$requestId", params: { requestId: res.id }, search: { cree: true } });
    } catch { setError("La demande n’a pas pu être créée."); }
    finally { setBusy(false); }
  }

  return <AdminShell>
    <Link to="/admin/demandes" className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-[14px] hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="size-4" />Demandes</Link>
    <p className="eyebrow team-mention mt-6">( Demande pour un membre )</p>
    <Title italic="demande." className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">Nouvelle </Title>

    <div className="mt-8 grid min-w-0 gap-4 lg:grid-cols-12">
      <form onSubmit={submit} className="grid min-w-0 content-start gap-4 lg:col-span-7">
        <section className="team-panel rounded-[28px] p-6">
          <h2 className="eyebrow team-mention">( Membre )</h2>
          {member ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
            <div className="min-w-0"><p className="text-[20px] leading-tight">{member.full_name}</p><p className="mt-1 break-all text-[13px] text-muted-foreground">{member.email ?? "—"} · {member.plan}</p></div>
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setMemberId("")}>Changer</Button>
          </div> : <>
            <label className="relative mt-4 block"><span className="sr-only">Rechercher un membre par nom ou e-mail</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou e-mail du membre…" className="h-12 w-full rounded-2xl bg-card pl-10 pr-4 text-[15px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <ul className="mt-3 max-h-[260px] overflow-y-auto">
              {isLoading ? <li className="p-3 text-[13px] text-muted-foreground">Recherche des membres…</li>
                : matches.length === 0 ? <li className="p-3 text-[13px] text-muted-foreground">Aucun membre ne correspond.</li>
                : matches.map((m) => <li key={m.id} className="border-b border-border last:border-0">
                    <button type="button" onClick={() => setMemberId(m.id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="min-w-0"><span className="block text-[16px]">{m.full_name || "Sans nom"}</span><span className="block break-all text-[12px] text-muted-foreground">{m.email ?? "—"}</span></span>
                      <span className="shrink-0 text-[12px] team-mention">{m.plan}</span>
                    </button>
                  </li>)}
            </ul>
          </>}
        </section>

        <section className="team-panel rounded-[28px] p-6">
          <h2 className="eyebrow team-mention">( Catégorie )</h2>
          <div role="group" aria-label="Catégorie" className="mt-4 flex flex-wrap gap-2">
            {CATS.map((c) => <button key={c.name} type="button" aria-pressed={category === c.name} onClick={() => setCategory(c.name)}
              className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${category === c.name ? "bg-primary text-primary-foreground" : "border border-border hover:bg-primary/10"}`}>
              {category === c.name && <Check className="size-4" />}{c.name}
            </button>)}
          </div>
        </section>

        <section className="team-panel grid gap-5 rounded-[28px] p-6 sm:grid-cols-3">
          <Field id="t" label="Prestation souhaitée" full><Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} placeholder="Ex. Une table avec vue" /></Field>
          <Field id="d" label="Date souhaitée"><Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field id="h" label="Heure"><Input id="h" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          <Field id="g" label={guestsLabel}><Input id="g" type="number" min="1" value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="2" /></Field>
          <Field id="p" label="Précisions" full><Textarea id="p" rows={5} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Envies, contraintes ou attentions particulières…" /></Field>
          <Field id="rec" label="Récurrence" full>
            <select id="rec" value={rhythm} onChange={(e) => setRhythm(e.target.value as "aucune" | Rhythm)} className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {RHYTHMS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {rhythm !== "aucune" && <div className="mt-3 grid gap-3">
              {!date && <p className="text-[12px]">Indiquez la date souhaitée : c’est la première échéance.</p>}
              {rhythm === "dates" && <div>
                <div className="flex gap-2"><Input type="date" aria-label="Ajouter une date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /><Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => { if (nextDate && !extraDates.includes(nextDate)) setExtraDates([...extraDates, nextDate].sort()); setNextDate(""); }}>Ajouter</Button></div>
                {extraDates.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{extraDates.map((d) => <li key={d}><button type="button" onClick={() => setExtraDates(extraDates.filter((x) => x !== d))} className="h-9 rounded-full border border-border px-3 text-[12px]" aria-label={`Retirer le ${d}`}>{new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ×</button></li>)}</ul>}
              </div>}
              <label className="text-[12px]">Date de fin (facultative)<Input type="date" className="mt-2" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
              <p className="text-[12px] text-muted-foreground">Chaque échéance crée une demande sept jours avant sa date.</p>
            </div>}
          </Field>
          <Field id="c" label="Concierge en charge" full>
            <select id="c" value={conciergeId} onChange={(e) => setConcierge(e.target.value)} className={select}>
              <option value="">{UNASSIGNED}</option>
              {team.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.role === "admin" ? "Administrateur" : "Concierge"}</option>)}
            </select>
          </Field>
        </section>

        {error && <p role="alert" className="rounded-2xl border border-dashed border-border px-4 py-3 text-[14px]">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline" className="h-12 rounded-full px-5"><Link to="/admin/demandes">Annuler</Link></Button>
          <Button type="submit" disabled={busy || !memberId} className="h-12 rounded-full px-6">{busy ? "Création…" : "Créer la demande"}</Button>
        </div>
      </form>

      <aside className="min-w-0 lg:col-span-5">
        <div className="lg:sticky lg:top-6">
          <p className="eyebrow team-mention">( Aperçu côté membre )</p>
          <div className="member-preview mt-3 rounded-[28px] p-4" inert aria-label="Aperçu de la carte vue par le membre">
            <RequestCard item={preview} featured />
            <div className="mt-4"><RequestCard item={preview} /></div>
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">{member ? `Visible aussitôt dans l’espace de ${member.full_name}.` : "Choisissez un membre pour créer la demande."}</p>
        </div>
      </aside>
    </div>
  </AdminShell>;
}

function Field({ id, label, full = false, children }: { id: string; label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? "sm:col-span-3" : undefined}><label htmlFor={id} className="eyebrow team-mention text-[10px]">( {label} )</label><div className="member-preview mt-2 rounded-2xl">{children}</div></div>;
}
