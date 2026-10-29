import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { AdminShell } from "@/components/art-de-vie/admin-shell";
import { Title } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/data/art-de-vie";
import { teamQuery } from "@/lib/admin-queries";
import { inviteColleague, setTeamRole, type TeamRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/equipe")({
  beforeLoad: ({ context }) => { if (context.teamRole !== "admin") throw redirect({ to: "/admin" }); },
  head: () => ({ meta: [
    { title: "Équipe — Art de Vie" },
    { name: "description", content: "Comptes de l’équipe Art de Vie et répartition des rôles." },
    { property: "og:title", content: "Équipe — Art de Vie" },
    { property: "og:description", content: "Comptes de l’équipe Art de Vie et répartition des rôles." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

const ROLE_LABEL: Record<TeamRole, string> = { admin: "Administrateur", concierge: "Concierge" };

const RIGHTS: Array<[string, boolean, boolean]> = [
  ["Voir et traiter les demandes", true, true],
  ["Créer une demande pour un membre", true, true],
  ["Échanger avec le membre et joindre des pièces", true, true],
  ["Saisir le montant d’une prestation", true, true],
  ["Envoyer une proposition chiffrée", true, true],
  ["Tenir les préférences des membres", true, true],
  ["Consulter les fiches membres", true, true],
  ["Créer, modifier ou désactiver un membre", true, false],
  ["Voir les factures et les paiements", true, false],
  ["Gérer les offres", true, false],
  ["Traiter les parrainages", true, false],
  ["Gérer l’équipe et les rôles", true, false],
];

const pill = "inline-flex h-11 items-center rounded-full px-4 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function Page() {
  const qc = useQueryClient();
  const { data: team = [], isLoading } = useQuery(teamQuery);
  const changeRole = useServerFn(setTeamRole);
  const invite = useServerFn(inviteColleague);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", role: "concierge" as TeamRole });

  async function apply(userId: string, role: TeamRole | null, name: string) {
    if (role === null && !window.confirm(`Retirer ${name} de l’équipe ? Son compte sera désactivé ; il pourra être réactivé depuis sa fiche.`)) return;
    setBusy(userId); setNotice(null);
    try {
      const r = await changeRole({ data: { userId, role } });
      setNotice(r.ok ? { ok: true, text: role ? `${name} est désormais ${ROLE_LABEL[role].toLowerCase()}.` : `${name} ne fait plus partie de l’équipe ; son compte est désactivé.` } : { ok: false, text: r.reason });
      if (r.ok) await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch { setNotice({ ok: false, text: "L’opération a échoué." }); }
    finally { setBusy(null); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("invite"); setNotice(null);
    try {
      const r = await invite({ data: form });
      if (!r.ok) { setNotice({ ok: false, text: r.reason }); return; }
      setNotice({ ok: true, text: r.mailed ? `${form.fullName} a été invité ; l’email d’accès est parti.` : `${form.fullName} a été ajouté, mais l’email d’accès n’a pas pu être envoyé.` });
      setForm({ fullName: "", email: "", role: "concierge" });
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch { setNotice({ ok: false, text: "L’invitation a échoué." }); }
    finally { setBusy(null); }
  }

  return <AdminShell>
    <header className="mb-[22px]">
      <p className="eyebrow team-mention">Équipe</p>
      <Title italic="équipe." className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">Votre </Title>
      <p className="mt-2 text-[13px] text-muted-foreground">Comptes de l’équipe, rôles et invitations.</p>
      <Button asChild variant="link" className="mt-2 px-0"><Link to="/admin/reponses-types">Rédiger les réponses types</Link></Button>
    </header>

    {notice && <p role="status" className={`mb-5 rounded-2xl p-4 text-xs leading-5 text-primary ${notice.ok ? "bg-primary/10" : "border border-primary/25"}`}>{notice.text}</p>}

    {/* Maquette V4 : comptes et droits à gauche, invitation en colonne beige à droite. */}
    <div className="grid min-w-0 gap-6 lg:grid-cols-12">
      <div className="grid min-w-0 content-start gap-6 lg:col-span-8">
      <section className="team-panel min-w-0 rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="eyebrow team-mention">Comptes de l’équipe</h2>{!isLoading && <span className="text-[13px] text-muted-foreground">{team.length} compte{team.length > 1 ? "s" : ""}</span>}</div>
        {isLoading ? <Skeleton className="mt-4 h-40 rounded-card bg-primary/10" />
          : <ul className="mt-2">
              {team.map((t) => <li key={t.id} className="grid min-w-0 gap-3 border-b border-border py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-2 text-[20px] text-primary"><span className="truncate">{t.full_name || "Sans nom"}</span>{t.is_self ? <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">Vous</span> : null}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{t.email} · depuis le {formatShortDate(t.since.slice(0, 10))}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Rôle de ${t.full_name}`}>
                  {(["admin", "concierge"] as const).map((r) => <button key={r} type="button" aria-pressed={t.role === r} disabled={t.is_self || busy === t.id || t.role === r} onClick={() => apply(t.id, r, t.full_name)}
                    className={`${pill} ${t.role === r ? "bg-primary font-medium text-primary-foreground" : "border border-border hover:bg-primary/10"}`}>{ROLE_LABEL[r]}</button>)}
                  {!t.is_self && <Button type="button" variant="outline" size="sm" disabled={busy === t.id} onClick={() => apply(t.id, null, t.full_name)}>Retirer de l’équipe</Button>}
                </div>
              </li>)}
            </ul>}
      </section>

      <section className="team-panel min-w-0 rounded-[28px] p-5 sm:p-6">
        <h2 className="eyebrow team-mention">Ce que chaque rôle peut faire</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-0 text-left text-[14px]">
            <thead><tr className="border-b border-border text-muted-foreground"><th scope="col" className="py-3 pr-3 font-medium">Action</th><th scope="col" className="w-32 py-3 text-center font-medium">Administrateur</th><th scope="col" className="w-28 py-3 text-center font-medium">Concierge</th></tr></thead>
            <tbody>{RIGHTS.map(([label, a, c]) => <tr key={label} className="border-b border-border last:border-0"><td className="py-3 pr-3 text-primary">{label}</td><td className="py-3 text-center"><Mark yes={a} /></td><td className="py-3 text-center"><Mark yes={c} /></td></tr>)}</tbody>
          </table>
        </div>
      </section>
      </div>

      <div className="min-w-0 lg:col-span-4">
      <form onSubmit={submit} className="team-beige min-w-0 rounded-[28px] p-6 lg:sticky lg:top-6">
        <p className="eyebrow">Nouveau compte</p>
        <Title as="h2" italic="collègue." className="mt-3 text-[40px] leading-none">Inviter un </Title>
        <div className="mt-6 grid gap-5">
          <div><Label htmlFor="col-name" className="eyebrow text-muted-foreground">Nom complet</Label><Input id="col-name" className="mt-2" required maxLength={80} value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} /></div>
          <div><Label htmlFor="col-email" className="eyebrow text-muted-foreground">Adresse email</Label><Input id="col-email" type="email" className="mt-2" required maxLength={160} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div role="group" aria-labelledby="col-role-label"><p id="col-role-label" className="eyebrow text-muted-foreground">Rôle</p>
            <div className="mt-2 flex flex-wrap gap-2">{(["concierge", "admin"] as const).map((r) => <button key={r} type="button" aria-pressed={form.role === r} onClick={() => setForm((f) => ({ ...f, role: r as TeamRole }))} className={`${pill} ${form.role === r ? "bg-primary font-medium text-primary-foreground" : "border border-border hover:bg-primary/10"}`}>{ROLE_LABEL[r]}</button>)}</div></div>
        </div>
        <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" disabled={busy === "invite"}><UserPlus />{busy === "invite" ? "Invitation…" : "Envoyer l’invitation"}</Button>
      </form>
      </div>
    </div>
  </AdminShell>;
}

function Mark({ yes }: { yes: boolean }) {
  return yes
    ? <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-4" aria-hidden="true" /><span className="sr-only">Oui</span></span>
    : <span className="inline-flex size-7 items-center justify-center rounded-full border border-dashed border-border"><span className="sr-only">Non</span></span>;
}

