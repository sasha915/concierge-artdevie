import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { UserPlus } from "lucide-react";
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
  ["Voir et traiter les demandes (statut, concierge, réponse, notes)", true, true],
  ["Créer une demande pour un membre", true, true],
  ["Consulter les fiches membres", true, true],
  ["Créer, modifier ou désactiver un membre", true, false],
  ["Factures et paiements", true, false],
  ["Offres", true, false],
  ["Parrainages", true, false],
  ["Gestion de l’équipe", true, false],
];

const pill = "inline-flex h-11 items-center rounded-full px-4 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const select = "h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Page() {
  const qc = useQueryClient();
  const { data: team = [], isLoading } = useQuery(teamQuery);
  const changeRole = useServerFn(setTeamRole);
  const invite = useServerFn(inviteColleague);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", role: "concierge" as TeamRole });

  async function apply(userId: string, role: TeamRole | null, name: string) {
    if (role === null && !window.confirm(`Retirer ${name} de l’équipe ? Le compte redeviendra un compte membre ordinaire.`)) return;
    setBusy(userId); setNotice(null);
    try {
      const r = await changeRole({ data: { userId, role } });
      setNotice(r.ok ? { ok: true, text: role ? `${name} est désormais ${ROLE_LABEL[role].toLowerCase()}.` : `${name} ne fait plus partie de l’équipe.` } : { ok: false, text: r.reason });
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
      <p className="eyebrow team-mention">( Équipe )</p>
      <Title italic="équipe." className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">L’</Title>
      <p className="mt-2 text-[13px] text-muted-foreground">Comptes de l’équipe, rôles et invitations.</p>
      <Button asChild variant="link" className="mt-2 px-0"><Link to="/admin/reponses-types">Rédiger les réponses types</Link></Button>
    </header>

    {notice && <p role="status" className={`mb-5 rounded-2xl p-4 text-xs leading-5 text-primary ${notice.ok ? "bg-primary/10" : "border border-primary/25"}`}>{notice.text}</p>}

    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section className="team-panel min-w-0 rounded-[28px] p-5 sm:p-6">
        <h2 className="eyebrow team-mention">( Comptes d’équipe )</h2>
        {isLoading ? <Skeleton className="mt-4 h-40 rounded-card bg-primary/10" />
          : <ul className="mt-2">
              {team.map((t) => <li key={t.id} className="grid min-w-0 gap-3 border-b border-border py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-[20px] text-primary">{t.full_name || "Sans nom"}{t.is_self ? <span className="ml-2 text-[12px] text-muted-foreground">(vous)</span> : null}</p>
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

      <form onSubmit={submit} className="team-panel min-w-0 rounded-[28px] p-5 sm:p-6">
        <h2 className="eyebrow team-mention">( Inviter un collègue )</h2>
        <div className="mt-4 grid gap-4">
          <div><Label htmlFor="col-name" className="eyebrow text-muted-foreground">Nom complet</Label><Input id="col-name" className="mt-2" required maxLength={80} value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} /></div>
          <div><Label htmlFor="col-email" className="eyebrow text-muted-foreground">Adresse email</Label><Input id="col-email" type="email" className="mt-2" required maxLength={160} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div><Label htmlFor="col-role" className="eyebrow text-muted-foreground">Rôle</Label>
            <select id="col-role" className={`${select} mt-2`} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as TeamRole }))}>
              <option value="concierge">Concierge</option><option value="admin">Administrateur</option>
            </select></div>
        </div>
        <Button type="submit" variant="primary" size="lg" className="mt-5 w-full lg:w-auto" disabled={busy === "invite"}><UserPlus />{busy === "invite" ? "Invitation…" : "Inviter"}</Button>
      </form>
    </div>

    <section className="team-panel mt-6 min-w-0 rounded-[28px] p-5 sm:p-6">
      <h2 className="eyebrow team-mention">( Ce que chaque rôle peut faire )</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-0 text-left text-[14px]">
          <thead><tr className="border-b border-border text-muted-foreground"><th scope="col" className="py-3 pr-3 font-medium">Action</th><th scope="col" className="w-28 py-3 text-center font-medium">Administrateur</th><th scope="col" className="w-24 py-3 text-center font-medium">Concierge</th></tr></thead>
          <tbody>{RIGHTS.map(([label, a, c]) => <tr key={label} className="border-b border-border last:border-0"><td className="py-3 pr-3 text-primary">{label}</td><td className="py-3 text-center">{a ? "Oui" : "—"}</td><td className="py-3 text-center">{c ? "Oui" : "—"}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  </AdminShell>;
}
