import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import { AdminShell, TeamStatus } from "@/components/art-de-vie/admin-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatDate, formatShortDate, initials, type RequestStatus } from "@/data/art-de-vie";
import { requestDetailQuery, teamNamesQuery, requestEventsQuery, replyTemplatesQuery, requestBillingQuery } from "@/lib/admin-queries";
import { eurosInput, invoiceBreakdown, parseEuros, ratePercent } from "@/lib/billing-rules";
import { insertReply, requestHistory } from "@/lib/team-request-rules";
import { addRequestNote, createRequestInvoice, listRequestNotes, setRequestAmount, setRequestConcierge, setRequestReply, updateRequestStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/demandes/$requestId")({
  validateSearch: (search: Record<string, unknown>): { cree?: boolean } => (search["cree"] === true || search["cree"] === "true" ? { cree: true } : {}),
  head: () => ({ meta: [
    { title: "Détail de la demande — Équipe Art de Vie" },
    { name: "description", content: "Statut, concierge et réponse au membre pour une demande." },
    { property: "og:title", content: "Détail de la demande — Équipe Art de Vie" },
    { property: "og:description", content: "Statut, concierge et réponse au membre pour une demande." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

const STATUSES: RequestStatus[] = ["Nouvelle", "En cours", "Confirmée", "Terminée", "Annulée"];
const UNASSIGNED = "À attribuer";

function stamp(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Page() {
  const { requestId } = Route.useParams();
  const { cree } = Route.useSearch();
  const { teamRole } = Route.useRouteContext();
  const { data: events = [], isLoading: eventsLoading, isError: eventsError } = useQuery(requestEventsQuery(requestId));
  const { data: templates = [], isLoading: templatesLoading, isError: templatesError } = useQuery(replyTemplatesQuery);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<number | null>(null);
  const fetchNotes = useServerFn(listRequestNotes);
  const addNote = useServerFn(addRequestNote);
  const { data: notes = [] } = useQuery({ queryKey: ["admin", "request", requestId, "notes"], queryFn: () => fetchNotes({ data: { requestId } }) });
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(requestDetailQuery(requestId));
  const { data: team = [] } = useQuery(teamNamesQuery);
  const setStatus = useServerFn(updateRequestStatus);
  const setConcierge = useServerFn(setRequestConcierge);
  const setReply = useServerFn(setRequestReply);
  const r = data?.request ?? null;
  const m = data?.member ?? null;

  const [reply, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setReplyText(r?.team_reply ?? ""); }, [r?.id, r?.team_reply]);
  useEffect(() => { if (cree) setNotice({ ok: true, text: "Demande créée. Elle apparaît dès maintenant dans l’espace du membre." }); }, [cree]);

  async function run(action: () => Promise<{ ok: boolean; reason?: string }>, success: string) {
    setBusy(true); setNotice(null);
    try {
      const res = await action();
      setNotice(res.ok ? { ok: true, text: success } : { ok: false, text: res.reason ?? "L’opération a échoué." });
      if (res.ok) await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch { setNotice({ ok: false, text: "L’opération a échoué." }); }
    finally { setBusy(false); }
  }

  function changeStatus(status: RequestStatus) {
    if (!r || status === r.status) return;
    if (status === "Annulée" && !window.confirm("Annuler cette demande ? Le membre verra le statut « Annulée ».")) return;
    run(() => setStatus({ data: { id: r.id, status } }), `Statut passé à « ${status} ».`);
  }

  if (isLoading) return <AdminShell><Skeleton className="h-[480px] rounded-[28px] bg-primary/10" /></AdminShell>;
  if (!r) return <AdminShell><p className="team-panel rounded-[28px] p-6 text-muted-foreground">Cette demande est introuvable.</p></AdminShell>;

  const legacyName = !r.concierge_id && r.concierge !== UNASSIGNED ? r.concierge : null;
  const conciergeValue = r.concierge_id ?? (legacyName ? "legacy" : "");
  const guestsLabel = r.category === "Tables" ? "Couverts" : "Personnes";
  const history = requestHistory(events, r.created_at);
  const usableTemplates = templates.filter((t) => t.body.trim());

  function useTemplate(body: string) {
    const inserted = insertReply(reply, body, cursorRef.current);
    if (inserted.text.length > 4000) { setNotice({ ok: false, text: "La réponse ne peut pas dépasser 4 000 caractères." }); return; }
    setReplyText(inserted.text);
    cursorRef.current = inserted.cursor;
    requestAnimationFrame(() => { replyRef.current?.focus(); replyRef.current?.setSelectionRange(inserted.cursor, inserted.cursor); });
  }

  return <AdminShell>
    <Link to="/admin/demandes" className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-[14px] hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="size-4" />Demandes</Link>

    <p role="status" aria-live="polite" className={`mt-4 min-h-0 text-[14px] ${notice ? (notice.ok ? "rounded-2xl border border-border px-4 py-3" : "rounded-2xl border border-dashed border-border px-4 py-3") : ""}`}>{notice?.text}</p>

    <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-12">
      <div className="grid min-w-0 content-start gap-4 lg:col-span-7">
        <section className="team-panel rounded-[28px] p-6">
          <div className="flex flex-wrap items-center gap-2"><span className="eyebrow rounded-full border border-border px-3 py-1 text-[10px]">{r.category}</span><TeamStatus status={r.status} /></div>
          <h1 className="mt-4 break-words text-[clamp(32px,4vw,52px)] leading-[1.02]">{r.title}</h1>
          <p className="eyebrow team-mention mt-6">( Précisions du membre )</p>
          <p className="mt-3 whitespace-pre-line rounded-[18px] bg-foreground p-4 text-[15px] leading-6 text-background">{r.description || "Aucune précision complémentaire n’a été indiquée."}</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <Info label="Date souhaitée" value={formatDate(r.scheduled_date)} />
            <Info label="Heure" value={r.scheduled_time ? r.scheduled_time.slice(0, 5).replace(":", " h ") : "À définir"} />
            <Info label={guestsLabel} value={r.guests ? String(r.guests) : "—"} />
          </dl>
        </section>

        <section className="team-panel rounded-[28px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="eyebrow team-mention">( Réponse au membre )</h2>
            <span className="rounded-full border border-border px-3 py-1 text-[11px]">Visible par le membre</span>
          </div>
          {templatesError ? <p role="alert" className="mt-3 text-[13px] text-muted-foreground">Les réponses types n’ont pas pu être chargées.</p> : !templatesLoading && <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
            {usableTemplates.map((t) => <Button key={t.id} type="button" variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal py-2 text-[13px]" onClick={() => useTemplate(t.body)}>{t.label}</Button>)}
            {teamRole === "admin" && <Button asChild variant="link" className="h-auto whitespace-normal px-0 py-1 text-[12px]"><Link to="/admin/reponses-types">Rédiger les réponses types</Link></Button>}
          </div>}
          <label htmlFor="team-reply" className="sr-only">Réponse au membre</label>
          <Textarea ref={replyRef} id="team-reply" value={reply} onChange={(e) => { setReplyText(e.target.value); cursorRef.current = e.target.selectionStart; }} onSelect={(e) => { cursorRef.current = e.currentTarget.selectionStart; }} maxLength={4000} rows={6} placeholder="Écrire au membre…" className="mt-4 min-h-[140px]" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">{r.team_reply_at ? `Dernière publication le ${stamp(r.team_reply_at)}` : "Aucune réponse publiée."}</p>
            <Button type="button" disabled={busy} onClick={() => run(() => setReply({ data: { id: r.id, reply } }), reply.trim() ? "Réponse publiée." : "Réponse retirée.")} className="h-11 rounded-full px-5">Publier la réponse</Button>
          </div>
        </section>

        <section className="team-panel rounded-[28px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="eyebrow team-mention">( Notes internes )</h2>
            <span className="rounded-full border border-dashed border-border px-3 py-1 text-[11px]">Invisibles du membre</span>
          </div>
          {notes.length === 0 ? <p className="mt-4 text-[13px] text-muted-foreground">Aucune note pour le moment.</p>
            : <ol className="mt-4 divide-y divide-border border-y border-border">{notes.map((n) => <li key={n.id} className="py-4">
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]"><span className="font-medium">{n.author_name}</span><span className="text-muted-foreground">{stamp(n.created_at)}</span></p>
                <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-6">{n.body}</p>
              </li>)}</ol>}
          <label htmlFor="team-note" className="sr-only">Nouvelle note interne</label>
          <Textarea id="team-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} rows={3} placeholder="Ajouter une note pour l’équipe…" className="mt-4 min-h-[96px]" />
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" disabled={busy || !note.trim()} onClick={() => run(async () => { const res = await addNote({ data: { requestId: r.id, body: note } }); if (res.ok) setNote(""); return res; }, "Note ajoutée.")} className="h-11 rounded-full px-5">Ajouter la note</Button>
          </div>
        </section>
      </div>

      <div className="grid min-w-0 content-start gap-4 lg:col-span-5">
        <section className="team-panel rounded-[28px] p-6">
          <h2 className="eyebrow team-mention">( Statut )</h2>
          <div role="group" aria-label="Statut de la demande" className="mt-4 flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const active = s === r.status;
              return <button key={s} type="button" disabled={busy} aria-pressed={active} onClick={() => changeStatus(s)}
                className={`h-11 rounded-full px-4 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${active ? "bg-primary text-primary-foreground" : s === "Annulée" ? "border border-dashed border-border hover:bg-primary/10" : "border border-border hover:bg-primary/10"}`}>
                {s === "Annulée" ? "Annuler la demande" : s}
              </button>;
            })}
          </div>
        </section>

        <section className="team-panel rounded-[28px] p-6">
          <h2 className="eyebrow team-mention">( Concierge en charge )</h2>
          <label htmlFor="concierge" className="sr-only">Concierge en charge</label>
          <select id="concierge" value={conciergeValue} disabled={busy} onChange={(e) => { const id = e.target.value || null; if (id === "legacy") return; const name = team.find((t) => t.id === id)?.name ?? UNASSIGNED; run(() => setConcierge({ data: { id: r.id, conciergeId: id } }), id ? `Demande attribuée à ${name}.` : "Demande remise « À attribuer »."); }}
            className="mt-4 h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">{UNASSIGNED}</option>
            {legacyName && <option value="legacy" disabled>{legacyName}</option>}
            {team.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.role === "admin" ? "Administrateur" : "Concierge"}</option>)}
          </select>
        </section>

        <BillingBlock requestId={r.id} cancelled={r.status === "Annulée"} isAdmin={teamRole === "admin"} busy={busy} run={run} />

        {m && <section className="team-glass rounded-[28px] p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="eyebrow team-mention">( Membre )</h2>
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-light text-[15px] font-medium text-primary-deep">{initials(m.full_name)}</span>
          </div>
          <p className="mt-2 text-[28px] leading-tight">{m.full_name}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{m.plan} · N° {m.member_number}</p>
          <dl className="mt-4 divide-y divide-border border-y border-border text-[14px]">
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Email</dt><dd className="min-w-0 break-all text-right">{m.email ?? "—"}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Téléphone</dt><dd className="text-right">{m.phone ?? "—"}</dd></div>
          </dl>
          <Link to="/admin/membres/$memberId" params={{ memberId: m.id }} className="mt-5 inline-flex h-11 items-center gap-3 rounded-full bg-primary pl-5 pr-1.5 text-[14px] font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Fiche membre<span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground text-primary"><ArrowUpRight className="size-4" /></span>
          </Link>
        </section>}
        <section className="team-panel rounded-[28px] p-6">
          <h2 className="eyebrow team-mention">( Historique )</h2>
          {eventsLoading ? <Skeleton className="mt-4 h-28 bg-primary/10" /> : eventsError ? <p role="alert" className="mt-4 text-[13px] text-muted-foreground">L’historique n’a pas pu être chargé.</p> : <ol className="mt-4 divide-y divide-border border-y border-border">
            {history.map((e) => <li key={e.id} className="py-4">
              <p className="break-words text-[15px] font-medium">{e.label}</p>
              <p className="mt-2 flex flex-wrap justify-between gap-2 text-[12px] text-muted-foreground"><time dateTime={e.created_at}>{stamp(e.created_at)}</time><span>{e.author_name}</span></p>
            </li>)}
          </ol>}
        </section>
      </div>
    </div>
  </AdminShell>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border p-4"><dt className="eyebrow team-mention text-[10px]">( {label} )</dt><dd className="mt-3 text-[20px] leading-tight">{value}</dd></div>;
}

function BillingBlock({ requestId, cancelled, isAdmin, busy, run }: { requestId: string; cancelled: boolean; isAdmin: boolean; busy: boolean; run: (action: () => Promise<{ ok: boolean; reason?: string }>, success: string) => Promise<void> }) {
  const { data: billing, isLoading, isError } = useQuery(requestBillingQuery(requestId));
  const saveAmount = useServerFn(setRequestAmount);
  const createInvoice = useServerFn(createRequestInvoice);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setValue(eurosInput(billing?.amount_cents)); setInvalid(false); }, [billing?.amount_cents]);

  if (isLoading) return <Skeleton className="h-56 rounded-[28px] bg-primary/10" />;
  if (isError || !billing) return <section className="team-panel rounded-[28px] p-6"><h2 className="eyebrow team-mention">( Montant et commission )</h2><p role="alert" className="mt-4 text-[13px] text-muted-foreground">Le montant n’a pas pu être chargé.</p></section>;

  const typed = parseEuros(value);
  const preview = typed !== null ? invoiceBreakdown(typed, billing.plan) : billing.breakdown;
  const dirty = value.trim() !== eurosInput(billing.amount_cents);
  const locked = billing.invoiced;

  function save() {
    const cents = value.trim() ? parseEuros(value) : null;
    if (value.trim() && cents === null) { setInvalid(true); return; }
    setInvalid(false);
    run(() => saveAmount({ data: { id: requestId, amountCents: cents } }), cents === null ? "Montant retiré." : `Montant enregistré : ${formatAmount(cents)}.`);
  }

  function invoice() {
    if (!billing?.breakdown) return;
    if (!window.confirm(`Créer la facture de ${formatAmount(billing.breakdown.total_cents)} ? Elle apparaîtra aussitôt dans les factures du membre, à régler.`)) return;
    run(() => createInvoice({ data: { id: requestId } }), "Facture créée. Elle apparaît dans les factures du membre.");
  }

  return <section className="team-panel rounded-[28px] p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="eyebrow team-mention">( Montant et commission )</h2>
      <span className="rounded-full border border-dashed border-border px-3 py-1 text-[11px]">Interne</span>
    </div>
    <label htmlFor="request-amount" className="mt-4 block text-[13px] text-muted-foreground">Montant de la prestation (€)</label>
    <div className="mt-2 flex min-w-0 gap-2">
      <input id="request-amount" inputMode="decimal" autoComplete="off" value={value} disabled={busy || locked} onChange={(e) => { setValue(e.target.value); setInvalid(false); }} placeholder="Ex. 1 250,50" aria-invalid={invalid} aria-describedby={invalid ? "request-amount-error" : undefined}
        className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
      <Button type="button" variant="outline" disabled={busy || locked || !dirty} onClick={save} className="h-12 shrink-0 rounded-full px-5">Enregistrer</Button>
    </div>
    {invalid && <p id="request-amount-error" role="alert" className="mt-2 text-[13px]">Montant invalide : indiquez des euros, avec deux décimales au plus.</p>}
    <dl className="mt-5 divide-y divide-border border-y border-border text-[14px]">
      <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Prestation</dt><dd>{preview ? formatAmount(preview.service_cents) : "—"}</dd></div>
      <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Formule du membre</dt><dd>{billing.plan}</dd></div>
      <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Commission{preview ? ` (${ratePercent(preview.commission_rate)})` : ""}</dt><dd>{preview ? formatAmount(preview.commission_cents) : "—"}</dd></div>
      <div className="flex justify-between gap-4 py-3"><dt className="font-medium">Total à facturer</dt><dd className="font-display text-[24px] leading-none">{preview ? formatAmount(preview.total_cents) : "—"}</dd></div>
    </dl>
    {dirty && typed !== null && <p className="mt-3 text-[12px] text-muted-foreground">Aperçu : enregistrez le montant pour le conserver.</p>}
    {locked ? (
      billing.invoice
        ? <p className="mt-4 rounded-2xl border border-border px-4 py-3 text-[13px]">Facture {billing.invoice.number} · {formatShortDate(billing.invoice.issued_on)} · {billing.invoice.status}</p>
        : <p className="mt-4 text-[13px] text-muted-foreground">Cette demande est facturée.</p>
    ) : isAdmin ? (
      <Button type="button" disabled={busy || cancelled || !billing.breakdown || dirty} onClick={invoice} className="mt-4 h-11 w-full rounded-full px-5">Créer la facture</Button>
    ) : (
      <p className="mt-4 text-[13px] text-muted-foreground">La facture est créée par un administrateur.</p>
    )}
    {!locked && isAdmin && cancelled && <p className="mt-2 text-[12px] text-muted-foreground">Une demande annulée ne peut pas être facturée.</p>}
  </section>;
}
