import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, Download, FileText, Paperclip, Plus, X } from "lucide-react";
import { AdminShell, TeamStatus } from "@/components/art-de-vie/admin-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatDate, formatShortDate, initials, type RequestStatus } from "@/data/art-de-vie";
import { requestDetailQuery, teamNamesQuery, requestEventsQuery, replyTemplatesQuery, requestBillingQuery, requestMessagesAdminQuery, requestFilesQuery, requestChangesQuery, requestReviewQuery, requestProposalsQuery } from "@/lib/admin-queries";
import { eurosInput, invoiceBreakdown, parseEuros, ratePercent } from "@/lib/billing-rules";
import { canInvoice, canTransition, insertReply, isOpenStatus, requestHistory } from "@/lib/team-request-rules";
import { decideRequestChange, getRequestFileUrl, resendProposal, sendProposal, setRequestFileVisibility, uploadRequestFile, withdrawProposal } from "@/lib/admin.functions";
import { FILE_TYPES, fileProblem, fileSizeLabel } from "@/lib/request-actions-rules";
import { addRequestNote, createRequestInvoice, listRequestNotes, setRequestAmount, sendTeamMessage, setRequestConcierge, updateRequestStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/demandes/$requestId")({
  validateSearch: (search: Record<string, unknown>): { cree?: boolean } => (search["cree"] === true || search["cree"] === "true" ? { cree: true } : {}),
  head: () => ({ meta: [
    { title: "Détail de la demande — Équipe Art de Vie" },
    { name: "description", content: "Statut, concierge et réponse au membre pour une demande." },
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
  const sendMessage = useServerFn(sendTeamMessage);
  const { data: messages = [], isLoading: messagesLoading, isError: messagesError } = useQuery(requestMessagesAdminQuery(requestId));
  const r = data?.request ?? null;
  const m = data?.member ?? null;

  const [reply, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
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

    <ChangeBanner requestId={r.id} busy={busy} run={run} />

    <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-12">
      <div className="grid min-w-0 content-start gap-4 lg:col-span-7">
        <section className="team-panel rounded-[28px] p-6">
          <div className="flex flex-wrap items-center gap-2"><span className="eyebrow rounded-full border border-border px-3 py-1 text-[10px]">{r.category}</span><TeamStatus status={r.status} /></div>
          <h1 className="v3-heading mt-4 break-words text-[clamp(32px,4vw,52px)] leading-[1.02]">{r.title}</h1>
          <p className="mt-3 text-[14px] text-muted-foreground">Reçue le {formatDate(r.created_at.slice(0, 10))}{r.scheduled_date ? ` · souhaitée le ${formatDate(r.scheduled_date)}` : ""}</p>
          {r.delegate_name && <p className="mt-3 inline-flex rounded-full border border-border px-3 py-1 text-[12px]">Demandée par {r.delegate_name}, proche du membre</p>}
          <p className="eyebrow team-mention mt-6">Précisions du membre</p>
          <p className="mt-3 whitespace-pre-line rounded-[18px] bg-foreground p-4 text-[15px] leading-6 text-background">{r.description || "Aucune précision complémentaire n’a été indiquée."}</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <Info label="Date souhaitée" value={formatDate(r.scheduled_date)} />
            <Info label="Heure" value={r.scheduled_time ? r.scheduled_time.slice(0, 5).replace(":", " h ") : "À définir"} />
            <Info label={guestsLabel} value={r.guests ? String(r.guests) : "—"} />
          </dl>
        </section>

        <section aria-labelledby="exchanges-title" className="team-panel rounded-[28px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="exchanges-title" className="eyebrow team-mention">Échanges avec le membre</h2>
            <span className="rounded-full border border-border px-3 py-1 text-[11px]">{r.delegate_name ? "Visible par le membre et son proche" : "Visible par le membre"}</span>
          </div>
          {messagesLoading ? <Skeleton className="mt-4 h-24 bg-primary/10" />
            : messagesError ? <p role="alert" className="mt-4 text-[13px] text-muted-foreground">Les échanges n’ont pas pu être chargés.</p>
            : messages.length === 0 ? <p className="mt-4 text-[13px] text-muted-foreground">Aucun échange pour le moment. Le membre voit « Votre demande a bien été transmise. »</p>
            : <ol className="mt-4 grid gap-3" aria-live="polite">{messages.map((msg) => {
                const fromMember = msg.author_role === "membre";
                return <li key={msg.id} className={`flex min-w-0 flex-col ${fromMember ? "items-start" : "items-end"}`}>
                  <p className={`max-w-[85%] whitespace-pre-line break-words rounded-[18px] p-4 text-[15px] leading-6 ${fromMember ? "bg-foreground text-background" : "border border-border bg-card"}`}>{msg.body}</p>
                  <p className="mt-1 px-1 text-[12px] text-muted-foreground">{msg.author_name} · {stamp(msg.created_at)}</p>
                </li>;
              })}</ol>}
          {templatesError ? <p role="alert" className="mt-4 text-[13px] text-muted-foreground">Les réponses types n’ont pas pu être chargées.</p> : !templatesLoading && <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
            {usableTemplates.map((t) => <Button key={t.id} type="button" variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal py-2 text-[13px]" onClick={() => useTemplate(t.body)}>{t.label}</Button>)}
            {teamRole === "admin" && <Button asChild variant="link" className="h-auto whitespace-normal px-0 py-1 text-[12px]"><Link to="/admin/reponses-types">Rédiger les réponses types</Link></Button>}
          </div>}
          <label htmlFor="team-reply" className="sr-only">Message au membre</label>
          <Textarea ref={replyRef} id="team-reply" value={reply} onChange={(e) => { setReplyText(e.target.value); cursorRef.current = e.target.selectionStart; }} onSelect={(e) => { cursorRef.current = e.currentTarget.selectionStart; }} maxLength={4000} rows={5} placeholder="Écrire au membre…" className="mt-4 min-h-[120px]" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="request-file" className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-5 text-[14px] font-medium hover:bg-primary/10 focus-within:ring-2 focus-within:ring-ring">
              <Paperclip className="size-4" />Joindre un fichier
            </label>
            <Button type="button" disabled={busy || !reply.trim()} onClick={() => run(async () => { const res = await sendMessage({ data: { requestId: r.id, body: reply } }); if (res.ok) { setReplyText(""); cursorRef.current = null; } return res; }, "Message envoyé au membre.")} className="h-11 rounded-full px-5">Envoyer au membre</Button>
          </div>
        </section>

        <ProposalBlock requestId={r.id} cancelled={r.status === "Annulée"} closed={!isOpenStatus(r.status)} busy={busy} run={run} />

        <FilesBlock requestId={r.id} busy={busy} run={run} />

        <section className="team-panel rounded-[28px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="eyebrow team-mention">Notes internes</h2>
            <span className="rounded-full border border-dashed border-border px-3 py-1 text-[11px]">Invisibles du membre</span>
          </div>
          {notes.length === 0 ? <p className="mt-4 text-[13px] text-muted-foreground">Aucune note pour le moment.</p>
            : <ol className="mt-4 divide-y divide-border border-y border-border">{notes.map((n) => <li key={n.id} className="py-4">
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]"><span className="font-medium">{n.author_name}</span><span className="text-muted-foreground">{stamp(n.created_at)}</span></p>
                <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-6">{n.body}</p>
              </li>)}</ol>}
          <label htmlFor="team-note" className="sr-only">Nouvelle note interne</label>
          <Textarea id="team-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} rows={3} placeholder="Ajouter une note…" className="mt-4 min-h-[96px]" />
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" disabled={busy || !note.trim()} onClick={() => run(async () => { const res = await addNote({ data: { requestId: r.id, body: note } }); if (res.ok) setNote(""); return res; }, "Note ajoutée.")} className="h-11 rounded-full px-5">Ajouter la note</Button>
          </div>
        </section>
      </div>

      <div className="grid min-w-0 content-start gap-4 lg:col-span-5">
        <section className="team-panel rounded-[28px] p-6">
          <h2 className="eyebrow team-mention">Statut</h2>
          {/* Maquette V4 : sélecteur segmenté ; l'annulation reste un bouton distinct. */}
          <div role="group" aria-label="Statut de la demande" className="team-glass mt-4 flex flex-wrap gap-1 rounded-[28px] p-1 sm:rounded-full">
            {STATUSES.filter((s) => s !== "Annulée").map((s) => {
              const active = s === r.status;
              const allowed = canTransition(r.status, s);
              return <button key={s} type="button" disabled={busy || !allowed} title={allowed ? undefined : `Passage impossible depuis « ${r.status} »`} aria-pressed={active} onClick={() => changeStatus(s)}
                className={`h-11 flex-1 whitespace-nowrap rounded-full px-3 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${active ? "bg-primary text-primary-foreground disabled:opacity-100" : "hover:bg-primary/10"}`}>
                {s}
              </button>;
            })}
          </div>
          {r.status === "Annulée"
            ? <p className="mt-3 inline-flex rounded-full border border-dashed border-border px-3 py-1 text-[12px] team-mention">Demande annulée</p>
            : <button type="button" disabled={busy || !canTransition(r.status, "Annulée")} title={canTransition(r.status, "Annulée") ? undefined : `Passage impossible depuis « ${r.status} »`} onClick={() => changeStatus("Annulée")} className="mt-3 h-11 rounded-full border border-dashed border-border px-4 text-[14px] font-medium transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">Annuler la demande</button>}
        </section>

        <section className="team-panel rounded-[28px] p-6">
          <h2 className="eyebrow team-mention">Concierge en charge</h2>
          <label htmlFor="concierge" className="sr-only">Concierge en charge</label>
          <select id="concierge" value={conciergeValue} disabled={busy} onChange={(e) => { const id = e.target.value || null; if (id === "legacy") return; const name = team.find((t) => t.id === id)?.name ?? UNASSIGNED; run(() => setConcierge({ data: { id: r.id, conciergeId: id } }), id ? `Demande attribuée à ${name}.` : "Demande remise « À attribuer »."); }}
            className="mt-4 h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">{UNASSIGNED}</option>
            {legacyName && <option value="legacy" disabled>{legacyName}</option>}
            {team.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.role === "admin" ? "Administrateur" : "Concierge"}</option>)}
          </select>
        </section>

        <BillingBlock requestId={r.id} cancelled={r.status === "Annulée"} invoiceable={canInvoice(r.status)} isAdmin={teamRole === "admin"} busy={busy} run={run} />

        {m && <section className="team-glass rounded-[28px] p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="eyebrow team-mention">Membre</h2>
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
        {r.status === "Terminée" && <ReviewPanel requestId={r.id} />}
        <section className="team-panel rounded-[28px] p-6">
          <h2 className="eyebrow team-mention">Historique</h2>
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
  return <div className="rounded-2xl border border-border p-4"><dt className="eyebrow team-mention text-[10px]">{label}</dt><dd className="mt-3 text-[20px] leading-tight">{value}</dd></div>;
}

function BillingBlock({ requestId, cancelled, invoiceable, isAdmin, busy, run }: { requestId: string; cancelled: boolean; invoiceable: boolean; isAdmin: boolean; busy: boolean; run: (action: () => Promise<{ ok: boolean; reason?: string }>, success: string) => Promise<void> }) {
  const { data: billing, isLoading, isError } = useQuery(requestBillingQuery(requestId));
  const saveAmount = useServerFn(setRequestAmount);
  const createInvoice = useServerFn(createRequestInvoice);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setValue(eurosInput(billing?.amount_cents)); setInvalid(false); }, [billing?.amount_cents]);

  if (isLoading) return <Skeleton className="h-56 rounded-[28px] bg-primary/10" />;
  if (isError || !billing) return <section className="team-panel rounded-[28px] p-6"><h2 className="eyebrow team-mention">Montant et commission</h2><p role="alert" className="mt-4 text-[13px] text-muted-foreground">Le montant n’a pas pu être chargé.</p></section>;

  const typed = parseEuros(value);
  const preview = !billing.plan ? null : typed !== null ? invoiceBreakdown(typed, billing.plan) : billing.breakdown;
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
      <h2 className="eyebrow team-mention">Montant et commission</h2>
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
      <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Formule du membre</dt><dd>{billing.plan ?? "Inconnue : corrigez la fiche avant de facturer"}</dd></div>
      <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Commission{preview ? ` (${ratePercent(preview.commission_rate)})` : ""}</dt><dd>{preview ? formatAmount(preview.commission_cents) : "—"}</dd></div>
      <div className="flex justify-between gap-4 py-3"><dt className="font-medium">Total à facturer</dt><dd className="font-display text-[24px] leading-none">{preview ? formatAmount(preview.total_cents) : "—"}</dd></div>
    </dl>
    {dirty && typed !== null && <p className="mt-3 text-[12px] text-muted-foreground">Aperçu : enregistrez le montant pour le conserver.</p>}
    {locked ? (
      billing.invoice
        ? <p className="mt-4 rounded-2xl border border-border px-4 py-3 text-[13px]">Facture {billing.invoice.number} · {formatShortDate(billing.invoice.issued_on)} · {billing.invoice.status}</p>
        : <p className="mt-4 text-[13px] text-muted-foreground">Cette demande est facturée.</p>
    ) : isAdmin ? (
      <Button type="button" disabled={busy || cancelled || !invoiceable || !billing.breakdown || dirty} title={invoiceable ? undefined : "Une demande se facture une fois confirmée ou terminée."} onClick={invoice} className="mt-4 h-11 w-full rounded-full px-5">Créer la facture</Button>
    ) : (
      <p className="mt-4 text-[13px] text-muted-foreground">La facture est créée par un administrateur.</p>
    )}
    {!locked && isAdmin && cancelled && <p className="mt-2 text-[12px] text-muted-foreground">Une demande annulée ne peut pas être facturée.</p>}
  </section>;
}

type Run = (action: () => Promise<{ ok: boolean; reason?: string }>, success: string) => Promise<void>;

/** Lot 5.3 — bandeau clair en tête du détail quand le membre a demandé une modification. */
function ChangeBanner({ requestId, busy, run }: { requestId: string; busy: boolean; run: Run }) {
  const { data: changes = [] } = useQuery(requestChangesQuery(requestId));
  const decide = useServerFn(decideRequestChange);
  const pending = changes.find((c) => c.status === "en attente");
  if (!pending) return null;
  return <section aria-label="Demande de modification" className="mt-4 rounded-[28px] bg-foreground p-6 text-background">
    <p className="eyebrow">Modification demandée par le membre · {stamp(pending.created_at)}</p>
    <p className="mt-3 text-[22px] leading-tight">{pending.label}</p>
    {pending.body && <p className="mt-2 whitespace-pre-line text-[15px] leading-6">{pending.body}</p>}
    <p className="mt-3 text-[13px] opacity-80">La demande reste inchangée tant que vous n’avez pas tranché. Accepter une annulation annule la demande ; pour les autres modifications, mettez-la ensuite à jour vous-même.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => run(() => decide({ data: { id: pending.id, decision: "acceptée" } }), "Modification acceptée. Le membre est prévenu.")} className="h-11 rounded-full bg-background px-5 text-[14px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">Accepter</button>
      <button type="button" disabled={busy} onClick={() => run(() => decide({ data: { id: pending.id, decision: "refusée" } }), "Modification refusée. Le membre est prévenu.")} className="h-11 rounded-full border border-background/40 px-5 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">Refuser</button>
    </div>
  </section>;
}

/** Lot 5.2 — pièces jointes : visibles par le membre ou internes, téléchargement par lien signé. */
function FilesBlock({ requestId, busy, run }: { requestId: string; busy: boolean; run: Run }) {
  const { data: files = [], isLoading, isError } = useQuery(requestFilesQuery(requestId));
  const upload = useServerFn(uploadRequestFile);
  const setVisibility = useServerFn(setRequestFileVisibility);
  const fileUrl = useServerFn(getRequestFileUrl);
  // Un document joint depuis l'échange avec le membre lui est destiné : visible par défaut (case à décocher pour un document interne).
  const [visible, setVisible] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const p = fileProblem(file);
    setProblem(p);
    if (p) return;
    const fd = new FormData();
    fd.append("file", file); fd.append("requestId", requestId); fd.append("visible", String(visible));
    void run(() => upload({ data: fd }), visible ? "Document ajouté et visible par le membre." : "Document interne ajouté.");
  }

  async function download(id: string) {
    const res = await fileUrl({ data: { id } });
    if (res.ok) window.location.href = res.url; else setProblem(res.reason);
  }

  return <section aria-labelledby="files-title" className="team-panel rounded-[28px] p-6">
    <h2 id="files-title" className="eyebrow team-mention">Pièces jointes</h2>
    {isLoading ? <Skeleton className="mt-4 h-16 bg-primary/10" />
      : isError ? <p role="alert" className="mt-4 text-[13px] text-muted-foreground">Les pièces jointes n’ont pas pu être chargées.</p>
      : files.length === 0 ? <p className="mt-4 text-[13px] text-muted-foreground">Aucune pièce jointe.</p>
      : <ul className="mt-4 divide-y divide-border border-y border-border">{files.map((f) => <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
          <FileText className="size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="truncate text-[15px]">{f.name}</p><p className="mt-0.5 text-[12px] text-muted-foreground">{FILE_TYPES[f.mime]?.label ?? "Fichier"} · {fileSizeLabel(f.size)} · {f.uploaded_by_name} · {stamp(f.created_at)}</p></div>
          <div role="group" aria-label={`Visibilité de ${f.name}`} className="flex gap-1">
            {[true, false].map((v) => <button key={String(v)} type="button" disabled={busy} aria-pressed={f.visible_to_member === v} onClick={() => run(() => setVisibility({ data: { id: f.id, visible: v } }), v ? "Document rendu visible par le membre." : "Document rendu interne.")}
              className={`h-9 rounded-full px-3 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${f.visible_to_member === v ? "bg-primary text-primary-foreground" : "border border-border"}`}>{v ? "Visible par le membre" : "Interne"}</button>)}
          </div>
          <Button type="button" variant="outline" size="icon" className="size-9 rounded-full" aria-label={`Télécharger ${f.name}`} onClick={() => download(f.id)}><Download className="size-4" /></Button>
        </li>)}</ul>}
    {problem && <p role="alert" className="mt-3 text-[13px]">{problem}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="size-4 accent-current" />Visible par le membre</label>
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" onChange={pick} className="sr-only" id="request-file" />
      <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()} className="h-11 rounded-full px-5"><Paperclip className="size-4" />Ajouter un fichier</Button>
      <span className="text-[12px] text-muted-foreground">PDF ou image, 10 Mo au plus</span>
    </div>
  </section>;
}

function ReviewPanel({ requestId }: { requestId: string }) {
  const { data: review } = useQuery(requestReviewQuery(requestId));
  return <section className="team-panel rounded-[28px] p-6">
    <h2 className="eyebrow team-mention">Avis du membre</h2>
    {review ? <>
      <p className="mt-3 font-display text-[26px] italic">{review.rating}</p>
      {review.comment && <p className="mt-2 whitespace-pre-line text-[15px] leading-6">{review.comment}</p>}
      <p className="mt-2 text-[12px] text-muted-foreground">{stamp(review.created_at)}</p>
    </> : <p className="mt-3 text-[13px] text-muted-foreground">Le membre n’a pas encore donné son avis.</p>}
  </section>;
}

type DraftOption = { label: string; detail: string; estimate: string };
const emptyOption: DraftOption = { label: "", detail: "", estimate: "" };

/** Lot 6.1 — proposition au membre : options, envoi, état de la réponse. */
function ProposalBlock({ requestId, cancelled, closed, busy, run }: { requestId: string; cancelled: boolean; closed: boolean; busy: boolean; run: Run }) {
  const { data: proposals = [], isLoading } = useQuery(requestProposalsQuery(requestId));
  const send = useServerFn(sendProposal);
  const withdraw = useServerFn(withdrawProposal);
  const resend = useServerFn(resendProposal);
  const [drafting, setDrafting] = useState(false);
  const [options, setOptions] = useState<DraftOption[]>([{ ...emptyOption }, { ...emptyOption }]);
  const [problem, setProblem] = useState<string | null>(null);
  const latest = proposals[0];
  const pending = latest?.status === "en attente" ? latest : null;

  function update(i: number, key: keyof DraftOption, value: string) {
    setOptions((list) => list.map((o, k) => (k === i ? { ...o, [key]: value } : o)));
  }

  function submit() {
    const filled = options.filter((o) => o.label.trim());
    if (filled.length === 0) { setProblem("Indiquez au moins une option."); return; }
    const parsed = filled.map((o) => ({ label: o.label.trim(), detail: o.detail.trim(), estimateCents: o.estimate.trim() ? parseEuros(o.estimate) : null }));
    if (parsed.some((o, i) => filled[i]!.estimate.trim() && o.estimateCents === null)) { setProblem("Montant estimé invalide : indiquez des euros, avec deux décimales au plus."); return; }
    setProblem(null);
    void run(async () => {
      const res = await send({ data: { requestId, options: parsed } });
      if (res.ok) { setDrafting(false); setOptions([{ ...emptyOption }, { ...emptyOption }]); }
      return res;
    }, "Proposition envoyée au membre.");
  }

  if (isLoading) return <Skeleton className="h-24 rounded-[28px] bg-primary/10" />;
  if (cancelled && !latest) return null;

  return <section aria-labelledby="proposal-title" className="team-panel rounded-[28px] p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="proposal-title" className="eyebrow team-mention">Proposition au membre</h2>
      {latest && <span className={`rounded-full px-3 py-1 text-[11px] ${latest.status === "en attente" ? "border border-dashed border-border" : latest.status === "acceptée" ? "bg-primary text-primary-foreground" : "border border-border"}`}>{latest.status === "en attente" ? "En attente de sa réponse" : latest.status === "acceptée" ? "Option choisie" : "Aucune ne convient"}</span>}
    </div>
    {latest && !drafting && <>
      <ol className="mt-4 grid gap-2">{latest.options.map((o) => <li key={o.id} className={`rounded-2xl p-4 ${o.chosen ? "bg-foreground text-background" : "border border-border"}`}>
        <p className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-[16px]">{o.label}</span>{o.estimate_cents !== null && <span className="text-[14px]">≈ {formatAmount(o.estimate_cents)}</span>}</p>
        {o.detail && <p className="mt-1 whitespace-pre-line text-[13px] opacity-80">{o.detail}</p>}
      </li>)}</ol>
      <p className="mt-3 text-[12px] text-muted-foreground">Envoyée le {stamp(latest.created_at)}{latest.decided_at ? ` · réponse le ${stamp(latest.decided_at)}` : ""}</p>
    </>}
    {pending && !drafting && <div className="mt-4 flex flex-wrap gap-2">
      <Button type="button" variant="soft" disabled={busy} className="h-11 rounded-full px-5" onClick={() => void run(() => resend({ data: { id: pending.id } }), "Proposition renvoyée au membre.")}>Renvoyer la proposition</Button>
      <Button type="button" variant="outline" disabled={busy} className="h-11 rounded-full px-5" onClick={() => { if (window.confirm("Retirer cette proposition ? Le membre ne la verra plus.")) void run(() => withdraw({ data: { id: pending.id } }), "Proposition retirée."); }}>Retirer la proposition</Button>
    </div>}
    {!pending && !cancelled && !closed && !drafting && <Button type="button" variant="outline" className="mt-4 h-11 rounded-full px-5" onClick={() => setDrafting(true)}>{latest ? "Nouvelle proposition" : "Préparer une proposition"}</Button>}
    {drafting && <div className="mt-4 grid gap-3">
      {options.map((o, i) => <fieldset key={i} className="grid gap-2 rounded-2xl border border-border p-4">
        <legend className="px-1 text-[12px] text-muted-foreground">Option {i + 1}</legend>
        <div className="flex gap-2"><input aria-label={`Intitulé de l’option ${i + 1}`} value={o.label} maxLength={160} onChange={(e) => update(i, "label", e.target.value)} placeholder="Intitulé" className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 text-[15px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {options.length > 1 && <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 rounded-full" aria-label={`Retirer l’option ${i + 1}`} onClick={() => setOptions((list) => list.filter((_, k) => k !== i))}><X className="size-4" /></Button>}</div>
        <Textarea aria-label={`Détail de l’option ${i + 1}`} value={o.detail} maxLength={2000} rows={2} onChange={(e) => update(i, "detail", e.target.value)} placeholder="Détail" className="min-h-[64px]" />
        <input aria-label={`Montant estimé de l’option ${i + 1} en euros`} inputMode="decimal" value={o.estimate} onChange={(e) => update(i, "estimate", e.target.value)} placeholder="Montant estimé (€), facultatif" className="h-11 rounded-2xl border border-border bg-card px-4 text-[15px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </fieldset>)}
      {problem && <p role="alert" className="text-[13px]">{problem}</p>}
      <div className="flex flex-wrap gap-2">
        {options.length < 6 && <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={() => setOptions((list) => [...list, { ...emptyOption }])}><Plus className="size-4" />Ajouter une option</Button>}
        <Button type="button" disabled={busy} className="h-11 rounded-full px-5" onClick={submit}>Envoyer la proposition</Button>
        <Button type="button" variant="link" className="h-11" onClick={() => { setDrafting(false); setProblem(null); }}>Annuler</Button>
      </div>
    </div>}
  </section>;
}
