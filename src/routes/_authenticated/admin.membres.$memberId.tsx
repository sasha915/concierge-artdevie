import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ChevronLeft, Download, Mail, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AdminShell, TeamStatus } from "@/components/art-de-vie/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, StatusBadge } from "@/components/art-de-vie/cards";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatShortDate, formatMonth, imageFor, initials } from "@/data/art-de-vie";
import { memberDelegatesQuery, memberDetailQuery, memberParrainQuery, memberPaymentsQuery, memberPreferencesQuery, memberReviewsQuery } from "@/lib/admin-queries";
import { approveDelegate, refuseDelegate, revokeDelegateTeam, getMemberStatement, saveMemberPreferences, setMemberLanguage, sendMemberInvite, setMemberDisabled, updateMember, type MemberAnswers as Answers } from "@/lib/admin.functions";
import { monthLabel, shiftMonth, WELCOME_STEPS } from "@/lib/member-rules";
import { delegateStatusLabel } from "@/lib/delegate-rules";
import { Textarea } from "@/components/ui/textarea";
import { Field, PlanSelect } from "./admin.membres.index";

export const Route = createFileRoute("/_authenticated/admin/membres/$memberId")({ head: () => ({ meta: [{ title: "Fiche membre — Art de Vie" }, { name: "description", content: "Détail d’un membre, ses demandes et ses factures." }, { property: "og:title", content: "Fiche membre — Art de Vie" }, { property: "og:description", content: "Détail d’un membre, ses demandes et ses factures." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const { memberId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(memberDetailQuery(memberId));
  const { teamRole } = Route.useRouteContext();
  const isAdmin = teamRole === "admin";
  const { data: paymentsData } = useQuery({ ...memberPaymentsQuery(memberId), enabled: isAdmin });
  const { data: parrain } = useQuery(memberParrainQuery(memberId));
  const save = useServerFn(updateMember);
  const invite = useServerFn(sendMemberInvite);
  const toggle = useServerFn(setMemberDisabled);
  const profile = data?.profile ?? null;

  const [form, setForm] = useState({ fullName: "", phone: "", plan: "Signature", roleLabel: "", conciergeReferent: "", conciergeWhatsapp: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.full_name ?? "",
      phone: profile.phone ?? "",
      plan: profile.plan,
      roleLabel: profile.role_label ?? "",
      conciergeReferent: profile.concierge_referent ?? "",
      conciergeWhatsapp: profile.concierge_whatsapp ?? "",
    });
  }, [profile]);

  function set(key: keyof typeof form, value: string) { setForm((f) => ({ ...f, [key]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await save({ data: { id: memberId, ...form, plan: form.plan as "Essentiel" | "Signature" } });
      if (!r.ok) { setError(r.reason); return; }
      setNotice("Les informations ont été enregistrées.");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch { setError("L’enregistrement a échoué."); } finally { setBusy(false); }
  }

  async function sendInvite() {
    if (!profile?.email) return;
    setError(null); setNotice(null);
    const r = await invite({ data: { email: profile.email } });
    if (r.ok) setNotice(`Email d’invitation envoyé à ${profile.email}.`); else setError(r.reason);
  }

  async function toggleDisabled() {
    if (!profile) return;
    setError(null); setNotice(null);
    const r = await toggle({ data: { id: profile.id, disabled: !profile.disabled_at } });
    if (!r.ok) { setError(r.reason); return; }
    setNotice(profile.disabled_at ? "Le membre a été réactivé." : "Le membre a été désactivé.");
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
  }

  return <AdminShell>
    <header className="mb-7 flex items-center gap-4">
      <Button asChild variant="icon" size="icon" aria-label="Retour"><Link to="/admin/membres"><ChevronLeft /></Link></Button>
      {isLoading ? <Skeleton className="h-12 min-w-0 flex-1 rounded-[16px] bg-primary/10"/> : <h1 className="v3-heading min-w-0 flex-1 truncate text-[38px] text-primary lg:text-[46px]">{profile?.full_name || "Membre introuvable"}</h1>}
    </header>

    {!profile && !isLoading ? <EmptyState>Ce membre est introuvable.</EmptyState> : null}

    {profile && <>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="min-w-0">
        <section aria-label="Carte du membre" className="team-panel rounded-card border border-gold p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"><span className="font-display text-xl">Art de Vie</span><span className="grid size-11 shrink-0 place-items-center rounded-full border border-border text-sm">{initials(profile.full_name)}</span></div>
          <p className="mt-8 font-display text-[30px]">{profile.plan}</p>
          <p className="mt-2 break-words text-xs text-muted-foreground">{profile.member_number}</p>
          <p className="mt-1 text-sm">{profile.full_name}</p>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs text-muted-foreground"><p>Membre depuis<br /><span className="text-primary">{formatMonth(profile.member_since)}</span></p><p className="text-right">Validité<br /><span className="text-primary">{formatMonth(profile.valid_until)}</span></p></div>
        </section>
      {isAdmin && <form className="team-panel mt-5 min-w-0 rounded-card p-5 sm:p-7" onSubmit={submit}>
        <h2 className="eyebrow team-mention">Informations</h2>
        <div className="mt-5 grid min-w-0 gap-5">
          <Field label="Nom complet"><Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required maxLength={80} /></Field>
          <Field label="Téléphone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} /></Field>
          <Field label="Formule"><PlanSelect value={form.plan} onChange={(v) => set("plan", v)} /></Field>
          <Field label="Rôle affiché"><Input value={form.roleLabel} onChange={(e) => set("roleLabel", e.target.value)} maxLength={60} /></Field>
          <Field label="Concierge référent"><Input value={form.conciergeReferent} onChange={(e) => set("conciergeReferent", e.target.value)} maxLength={60} /></Field>
          <Field label={form.plan === "Signature" ? "WhatsApp du concierge (obligatoire en Signature)" : "WhatsApp du concierge"}><Input type="tel" value={form.conciergeWhatsapp} onChange={(e) => set("conciergeWhatsapp", e.target.value)} required={form.plan === "Signature"} pattern={form.plan === "Signature" ? "[+0-9 ().-]{8,30}" : undefined} maxLength={30} /></Field>
        </div>
        <Button type="submit" variant="primary" size="lg" className="mt-5 w-full lg:w-auto" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
      </form>}
      </aside>
      <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={profile.disabled_at ? "rounded-full border border-primary/25 px-3 py-1 text-[10px] font-semibold text-muted-foreground" : "rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary"}>{profile.disabled_at ? "Désactivé" : "Actif"}</span>
        <span className="text-[12px] text-muted-foreground">{profile.plan} · {profile.member_number}</span>
      </div>
      {parrain && <p className="mt-3 text-[13px] text-muted-foreground">Parrainé par <Link to="/admin/membres/$memberId" params={{ memberId: parrain.id }} className="underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{parrain.full_name}</Link></p>}
      <dl className="mt-4 grid min-w-0 gap-3 text-sm"><div><dt className="eyebrow team-mention">Adresse email</dt><dd className="mt-1 break-all">{profile.email || "—"}</dd></div>{profile.phone && <div><dt className="eyebrow team-mention">Téléphone</dt><dd className="mt-1">{profile.phone}</dd></div>}</dl>
      {isAdmin && <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="soft" size="sm" onClick={sendInvite}><Mail />Envoyer l’invitation</Button>
        <Button variant="outline" size="sm" onClick={toggleDisabled}>{profile.disabled_at ? <UserPlus /> : <UserMinus />}{profile.disabled_at ? "Réactiver" : "Désactiver"}</Button>
      </div>}

      <LanguageField memberId={profile.id} language={(profile as { language?: string }).language === "en" ? "en" : "fr"} />
      <StatementButton memberId={profile.id} />

      {notice && <p className="mt-4 rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">{notice}</p>}
      {error && <p className="mt-4 rounded-2xl border border-primary/25 p-4 text-xs leading-5 text-primary">{error}</p>}

      <PreferencesBlock memberId={profile.id} />
      <ReviewsBlock memberId={profile.id} />
      <DelegatesBlock memberId={profile.id} isAdmin={isAdmin} />

      <div className="mt-6 grid min-w-0 gap-5">
        <section className="team-panel min-w-0 rounded-card p-5">
          <h2 className="eyebrow text-primary-light">Ses demandes</h2>
          {(data?.requests ?? []).length === 0 ? <p className="mt-3 rounded-card bg-card p-5 text-[13px] text-muted-foreground">Aucune demande.</p>
            : <div className="mt-3">
                {(data?.requests ?? []).map((r) => <div key={r.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-4 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-3">{imageFor(r.image_key) && <img src={imageFor(r.image_key)} alt="" className="h-16 w-12 shrink-0 rounded-lg object-cover" />}<p className="min-w-0 break-words text-[18px] text-primary">{r.title}</p></div>
                    <p className="mt-1 text-[12px] text-muted-foreground">{r.category} · {formatShortDate(r.scheduled_date)}</p>
                    {r.description ? <p className="mt-1 text-[12px] leading-5 text-muted-foreground line-clamp-2">{r.description}</p> : null}
                  </div>
                  <TeamStatus status={r.status} />
                </div>)}
              </div>}
        </section>
        {isAdmin && <section className="team-panel min-w-0 rounded-card p-5">
          <h2 className="eyebrow text-primary-light">Ses factures</h2>
          {(data?.invoices ?? []).length === 0 ? <p className="mt-3 rounded-card bg-card p-5 text-[13px] text-muted-foreground">Aucune facture.</p>
            : <div className="mt-3 overflow-hidden rounded-card bg-card">
                {(data?.invoices ?? []).map((i) => <div key={i.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-primary">{i.number}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{i.kind} · {formatShortDate(i.issued_on)}</p>
                  </div>
                  <span className="text-sm font-medium text-primary">{formatAmount(i.amount_cents)}</span>
                  <span className="col-start-2 justify-self-end rounded-full bg-primary px-[13px] py-[5px] text-[11px] font-medium text-primary-foreground">{i.status}</span>
                </div>)}
              </div>}
        </section>}
      </div>

      {isAdmin && <section className="team-panel mt-5 min-w-0 rounded-card p-5">
        <h2 className="eyebrow text-primary-light">Paiements Mollie</h2>
        {paymentsData && !paymentsData.configured
          ? <p className="mt-3 rounded-card bg-card p-5 text-[13px] text-muted-foreground">Le paiement en ligne n'est pas encore configuré.</p>
          : (paymentsData?.payments ?? []).length === 0
            ? <p className="mt-3 rounded-card bg-card p-5 text-[13px] text-muted-foreground">Aucun paiement enregistré chez Mollie pour ce membre.</p>
            : <div className="mt-3 overflow-hidden rounded-card bg-card">
                {(paymentsData?.payments ?? []).map((p) => <div key={p.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-primary">{p.description}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{formatShortDate(p.date)}{p.recurring ? " · Prélèvement automatique" : ""}</p>
                  </div>
                  <span className="text-sm font-medium text-primary">{formatAmount(p.amountCents)}</span>
                  <span className={p.status === "Payée"
                    ? "rounded-full bg-primary px-[13px] py-[5px] text-[11px] font-medium text-primary-foreground"
                    : "rounded-full border border-primary/25 px-[13px] py-[5px] text-[11px] font-medium text-muted-foreground"}>{p.status}</span>
                </div>)}
              </div>}
      </section>}
      </div>
      </div>
    </>}
  </AdminShell>;
}

const PREFERENCE_FIELDS = [
  { key: "tables", label: "À table" },
  { key: "sejours", label: "Séjours" },
  { key: "transferts", label: "Transferts" },
  { key: "dates_cles", label: "Dates clés" },
  { key: "calendrier", label: "Calendrier" },
] as const;
type PreferenceKey = (typeof PREFERENCE_FIELDS)[number]["key"];
type PreferenceForm = Record<PreferenceKey, string>;

function PreferencesBlock({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery(memberPreferencesQuery(memberId));
  const save = useServerFn(saveMemberPreferences);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const empty: PreferenceForm = { tables: "", sejours: "", transferts: "", dates_cles: "", calendrier: "" };
  const [form, setForm] = useState<PreferenceForm>(empty);

  function start() {
    if (!data) return;
    setForm({ tables: data.tables, sejours: data.sejours, transferts: data.transferts, dates_cles: data.dates_cles, calendrier: data.calendrier });
    setMessage(null);
    setEditing(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const r = await save({ data: { id: memberId, ...form } });
      if (!r.ok) { setMessage({ ok: false, text: r.reason }); return; }
      setEditing(false);
      setMessage({ ok: true, text: "Les préférences ont été enregistrées." });
      await queryClient.invalidateQueries({ queryKey: ["admin", "member", memberId, "preferences"] });
    } catch { setMessage({ ok: false, text: "L’enregistrement a échoué." }); } finally { setBusy(false); }
  }

  const filled = data ? PREFERENCE_FIELDS.filter((f) => data[f.key].trim()) : [];

  return <section aria-labelledby="preferences-title" className="team-panel mt-6 min-w-0 rounded-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="preferences-title" className="eyebrow text-primary-light">Préférences et habitudes</h2>
      <span className="rounded-full border border-dashed border-border px-3 py-1 text-[11px]">Interne</span>
    </div>
    <p className="mt-2 text-[12px] text-muted-foreground">Aucune donnée de santé n’est consignée dans cette fiche.</p>
    {isLoading ? <Skeleton className="mt-4 h-24 bg-primary/10" />
      : isError || !data ? <p role="alert" className="mt-4 text-[13px] text-muted-foreground">Les préférences n’ont pas pu être chargées.</p>
      : editing ? <form onSubmit={submit} className="mt-4 grid min-w-0 gap-4">
          {PREFERENCE_FIELDS.map((f) => <div key={f.key} className="min-w-0">
            <label htmlFor={`pref-${f.key}`} className="eyebrow text-muted-foreground">{f.label}</label>
            <Textarea id={`pref-${f.key}`} value={form[f.key]} maxLength={2000} rows={2} onChange={(e) => setForm((v) => ({ ...v, [f.key]: e.target.value }))} className="mt-2 min-h-[64px]" />
          </div>)}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </form>
      : <>
          {filled.length === 0 ? <p className="mt-4 text-[13px] text-muted-foreground">Aucune préférence consignée.</p>
            : <dl className="mt-4 grid min-w-0 gap-3 text-sm">{filled.map((f) => <div key={f.key} className="min-w-0"><dt className="eyebrow team-mention">{f.label}</dt><dd className="mt-1 whitespace-pre-line break-words">{data[f.key]}</dd></div>)}</dl>}
          <MemberAnswers answers={data.answers} />
          {data.updated_at && <p className="mt-3 text-[12px] text-muted-foreground">Mis à jour le {formatShortDate(data.updated_at.slice(0, 10))}{data.updated_by_name ? ` par ${data.updated_by_name}` : ""}</p>}
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={start}>Modifier</Button>
        </>}
    {message && <p role="status" className={`mt-3 rounded-2xl p-3 text-xs leading-5 text-primary ${message.ok ? "bg-primary/10" : "border border-primary/25"}`}>{message.text}</p>}
  </section>;
}

function ReviewsBlock({ memberId }: { memberId: string }) {
  const { data: reviews = [] } = useQuery(memberReviewsQuery(memberId));
  return <section aria-labelledby="reviews-title" className="team-panel mt-5 min-w-0 rounded-card p-5">
    <h2 id="reviews-title" className="eyebrow text-primary-light">Avis après prestation</h2>
    {reviews.length === 0 ? <p className="mt-3 text-[13px] text-muted-foreground">Aucun avis pour le moment.</p>
      : <ul className="mt-3 divide-y divide-border">{reviews.map((r) => <li key={r.request_id} className="py-3">
          <Link to="/admin/demandes/$requestId" params={{ requestId: r.request_id }} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-[15px]">{r.title}</span><span className="font-display text-[18px] italic">{r.rating}</span></p>
            {r.comment && <p className="mt-1 whitespace-pre-line text-[13px] text-muted-foreground">{r.comment}</p>}
            <p className="mt-1 text-[12px] text-muted-foreground">{formatShortDate(r.created_at.slice(0, 10))}</p>
          </Link>
        </li>)}</ul>}
  </section>;
}

/**
 * Lot 5.4 : proches autorisés du membre. Avant de confirmer, l'équipe vérifie l'identité du proche
 * auprès du membre ; la confirmation (administrateurs) crée son accès et lui envoie le lien de mot de passe.
 */
function DelegatesBlock({ memberId, isAdmin }: { memberId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { data: delegates = [], isLoading } = useQuery(memberDelegatesQuery(memberId));
  const approve = useServerFn(approveDelegate);
  const refuse = useServerFn(refuseDelegate);
  const revoke = useServerFn(revokeDelegateTeam);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, action: "approve" | "refuse" | "revoke") {
    setBusy(id);
    try {
      const res = action === "approve" ? await approve({ data: { id } }) : action === "refuse" ? await refuse({ data: { id } }) : await revoke({ data: { id } });
      if (!res.ok) { toast.error(res.reason); return; }
      toast.success(action === "approve"
        ? ("mailed" in res && res.mailed === false ? "Accès ouvert ; l'email n'a pas pu partir, renvoyez-le depuis la connexion." : "Accès ouvert : le proche reçoit un email pour choisir son mot de passe.")
        : action === "refuse" ? "Invitation non retenue." : "Accès retiré.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "member", memberId, "delegates"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "delegates", "pending"] });
    } catch {
      toast.error("L'opération a échoué.");
    } finally {
      setBusy(null);
    }
  }

  return <section aria-labelledby="delegates-title" className="team-panel mt-5 min-w-0 rounded-card p-5">
    <h2 id="delegates-title" className="eyebrow text-primary-light">Proches autorisés</h2>
    <p className="mt-2 text-[13px] text-muted-foreground">Avant de confirmer, vérifiez auprès du membre l'identité de son proche. Un proche fait des demandes au nom du membre et ne voit que celles-ci.</p>
    {isLoading ? null : delegates.length === 0 ? <p className="mt-3 text-[13px] text-muted-foreground">Aucun proche invité.</p>
      : <ul className="mt-3 divide-y divide-border">{delegates.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px]">{d.full_name}{d.relation ? <span className="text-muted-foreground"> · {d.relation}</span> : null}</p>
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{d.email} · invité le {formatShortDate(d.invited_at.slice(0, 10))}</p>
          </div>
          <span className="rounded-full border border-primary/25 px-3 py-1 text-[11px] font-medium">{delegateStatusLabel(d.status)}</span>
          {d.status === "en_attente" && <div className="flex gap-2">
            {isAdmin && <Button type="button" size="sm" disabled={busy === d.id} onClick={() => void run(d.id, "approve")}>Confirmer l'accès</Button>}
            <Button type="button" size="sm" variant="outline" disabled={busy === d.id} onClick={() => void run(d.id, "refuse")}>Ne pas retenir</Button>
          </div>}
          {d.status === "actif" && <Button type="button" size="sm" variant="outline" disabled={busy === d.id} onClick={() => void run(d.id, "revoke")}>Retirer l'accès</Button>}
        </li>)}</ul>}
    {!isAdmin && delegates.some((d) => d.status === "en_attente") && <p className="mt-3 text-[12px] text-muted-foreground">La confirmation est réservée aux administrateurs.</p>}
  </section>;
}

/** Lot 6.4 : réponses du membre au questionnaire « Faisons connaissance. », en lecture seule. */
function MemberAnswers({ answers }: { answers: Answers }) {
  const groups = WELCOME_STEPS.map((step) => ({ label: step.eyebrow, values: answers[step.key] })).filter((g) => g.values.length > 0);
  const hasDates = answers.dates_membre.trim().length > 0;
  return <div className="mt-5 border-t border-border pt-4">
    <h3 className="eyebrow team-mention">Réponses du membre</h3>
    {groups.length === 0 && !hasDates ? <p className="mt-2 text-[13px] text-muted-foreground">Le membre n’a pas encore répondu au questionnaire d’accueil.</p>
      : <dl className="mt-3 grid min-w-0 gap-3 text-sm">
          {groups.map((g) => <div key={g.label} className="min-w-0"><dt className="eyebrow team-mention">{g.label}</dt><dd className="mt-2 flex flex-wrap gap-1.5">{g.values.map((v) => <span key={v} className="rounded-full border border-border px-3 py-1 text-[12px]">{v}</span>)}</dd></div>)}
          {hasDates && <div className="min-w-0"><dt className="eyebrow team-mention">Dates à retenir</dt><dd className="mt-1 whitespace-pre-line break-words">{answers.dates_membre}</dd></div>}
        </dl>}
    {answers.member_updated_at && <p className="mt-3 text-[12px] text-muted-foreground">Répondu le {formatShortDate(answers.member_updated_at.slice(0, 10))}</p>}
  </div>;
}

/** Lot 6.4 : « Relevé du mois », même document que celui du membre. */
function StatementButton({ memberId }: { memberId: string }) {
  const current = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(current);
  const [busy, setBusy] = useState(false);
  const fetchStatement = useServerFn(getMemberStatement);
  const options = Array.from({ length: 12 }, (_, i) => shiftMonth(current, -i));

  async function download() {
    setBusy(true);
    try {
      const data = await fetchStatement({ data: { id: memberId, month } });
      const { downloadStatement } = await import("@/lib/statement-pdf");
      await downloadStatement({ lang: data.language, month, memberName: data.member_name, memberNumber: data.member_number, lines: data.lines });
    } catch {
      toast.error("Le relevé n’a pas pu être préparé.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4 flex flex-wrap items-center gap-2">
    <label htmlFor="statement-month" className="sr-only">Mois du relevé</label>
    <select id="statement-month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-11 rounded-full border border-border bg-transparent px-4 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {options.map((m) => <option key={m} value={m} className="text-black">{monthLabel(m)}</option>)}
    </select>
    <Button type="button" variant="soft" size="sm" disabled={busy} onClick={() => void download()}><Download />Relevé du mois</Button>
  </div>;
}

/** Lot 6.5 : langue de l'espace membre, visible et modifiable par l'équipe. */
function LanguageField({ memberId, language }: { memberId: string; language: "fr" | "en" }) {
  const queryClient = useQueryClient();
  const save = useServerFn(setMemberLanguage);
  const [busy, setBusy] = useState(false);

  async function change(next: "fr" | "en") {
    if (next === language) return;
    setBusy(true);
    try {
      const r = await save({ data: { id: memberId, language: next } });
      if (!r.ok) { toast.error(r.reason); return; }
      toast.success("La langue du membre a été enregistrée.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "member", memberId] });
    } catch {
      toast.error("La langue n’a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4 flex flex-wrap items-center gap-3">
    <label htmlFor="member-language" className="eyebrow team-mention">Langue de l’application</label>
    <select id="member-language" value={language} disabled={busy} onChange={(e) => void change(e.target.value as "fr" | "en")} className="h-11 rounded-full border border-border bg-transparent px-4 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <option value="fr" className="text-black">Français</option>
      <option value="en" className="text-black">English</option>
    </select>
  </div>;
}
