import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ChevronLeft, Mail, UserMinus, UserPlus } from "lucide-react";
import { AdminShell, TeamStatus } from "@/components/art-de-vie/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, StatusBadge } from "@/components/art-de-vie/cards";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatShortDate, formatMonth, imageFor, initials } from "@/data/art-de-vie";
import { memberDetailQuery, memberParrainQuery, memberPaymentsQuery, memberPreferencesQuery } from "@/lib/admin-queries";
import { saveMemberPreferences, sendMemberInvite, setMemberDisabled, updateMember } from "@/lib/admin.functions";
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
          <Field label="WhatsApp du concierge"><Input value={form.conciergeWhatsapp} onChange={(e) => set("conciergeWhatsapp", e.target.value)} maxLength={30} /></Field>
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

      {notice && <p className="mt-4 rounded-2xl bg-primary/10 p-4 text-xs leading-5 text-primary">{notice}</p>}
      {error && <p className="mt-4 rounded-2xl border border-primary/25 p-4 text-xs leading-5 text-primary">{error}</p>}

      <PreferencesBlock memberId={profile.id} />

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
          {data.updated_at && <p className="mt-3 text-[12px] text-muted-foreground">Mis à jour le {formatShortDate(data.updated_at.slice(0, 10))}{data.updated_by_name ? ` par ${data.updated_by_name}` : ""}</p>}
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={start}>Modifier</Button>
        </>}
    {message && <p role="status" className={`mt-3 rounded-2xl p-3 text-xs leading-5 text-primary ${message.ok ? "bg-primary/10" : "border border-primary/25"}`}>{message.text}</p>}
  </section>;
}
