import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import { AdminShell } from "@/components/art-de-vie/admin-shell";
import { Title } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/data/art-de-vie";
import { adminReferralsQuery, type AdminReferral } from "@/lib/admin-queries";
import { setReferralStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/parrainages")({
  beforeLoad: ({ context }) => { if (context.teamRole !== "admin") throw redirect({ to: "/admin" }); },
  head: () => ({ meta: [
    { title: "Parrainages — Équipe Art de Vie" },
    { name: "description", content: "Suivi des parrainages entre membres de la conciergerie." },
    { property: "og:title", content: "Parrainages — Équipe Art de Vie" },
    { property: "og:description", content: "Suivi des parrainages entre membres de la conciergerie." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

const STATUSES = [
  { value: "Invitation envoyée", label: "Reçu" },
  { value: "Contacté", label: "Contacté" },
  { value: "Converti", label: "Converti" },
] as const;

const statusLabel = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? s;

const pill = "inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Page() {
  const queryClient = useQueryClient();
  const { data: referrals = [], isLoading } = useQuery(adminReferralsQuery);
  const setStatus = useServerFn(setReferralStatus);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = {
    recu: referrals.filter((r) => r.status === "Invitation envoyée").length,
    contacte: referrals.filter((r) => r.status === "Contacté").length,
    converti: referrals.filter((r) => r.status === "Converti").length,
  };

  async function changeStatus(r: AdminReferral, status: string) {
    setBusyId(r.id); setError(null);
    const res = await setStatus({ data: { id: r.id, status: status as "Invitation envoyée" | "Contacté" | "Converti" } });
    if (!res.ok) setError(res.reason);
    await queryClient.invalidateQueries({ queryKey: ["admin", "referrals"] });
    setBusyId(null);
  }

  return <AdminShell>
    <p className="eyebrow team-mention">Parrainages</p>
    <Title italic="parrainages." className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">Les </Title>

    {error && <p role="alert" className="mt-4 rounded-2xl border border-dashed border-border px-4 py-3 text-[14px]">{error}</p>}

    <div className="mt-8 grid min-w-0 gap-4 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-8">
        {isLoading ? <div className="grid gap-3"><Skeleton className="h-32 rounded-[28px] bg-primary/10" /><Skeleton className="h-32 rounded-[28px] bg-primary/10" /></div>
          : referrals.length === 0 ? <p className="team-panel rounded-[28px] p-8 text-center text-[14px] text-muted-foreground">Il n’y a aucun parrainage aujourd’hui.</p>
          : <ul className="grid gap-3">{referrals.map((r) => <li key={r.id} className="team-panel min-w-0 rounded-[28px] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-[20px] leading-tight">{r.full_name}</p>
                  <p className="mt-1 break-all text-[13px] text-muted-foreground">{r.email}{r.already_member ? " · déjà membre" : ""}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-medium">{statusLabel(r.status)}</span>
              </div>
              {r.message && <p className="mt-3 whitespace-pre-line rounded-2xl bg-primary/10 p-4 text-[13px] leading-5 text-muted-foreground">{r.message}</p>}
              <p className="mt-3 text-[12px] text-muted-foreground">
                Parrainé par {r.inviter_id ? <Link to="/admin/membres/$memberId" params={{ memberId: r.inviter_id }} className="underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{r.inviter_name || "un membre"}</Link> : (r.inviter_name || "un membre")} · {formatShortDate(r.created_at.slice(0, 10))}
                {r.converted_member_id && <> · <Link to="/admin/membres/$memberId" params={{ memberId: r.converted_member_id }} className="underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Fiche du membre créé</Link></>}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <div role="group" aria-label={`Statut du parrainage de ${r.full_name}`} className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => <button key={s.value} type="button" disabled={busyId === r.id} aria-pressed={r.status === s.value} onClick={() => changeStatus(r, s.value)}
                    className={`${pill} border text-[13px] disabled:opacity-60 ${r.status === s.value ? "border-primary bg-primary font-medium text-primary-foreground" : "border-border hover:bg-primary/10"}`}>{s.label}</button>)}
                </div>
                <a href={`mailto:${r.email}`} className={`${pill} border border-border hover:bg-primary/10`}><Mail className="size-4" />Écrire</a>
                {!r.converted_member_id && <Button asChild variant="outline" className="h-11 rounded-full"><Link to="/admin/membres" search={{ nom: r.full_name, email: r.email, parrainage: r.id }}><UserPlus className="size-4" />Créer le membre</Link></Button>}
              </div>
            </li>)}</ul>}
      </div>

      <aside className="min-w-0 lg:col-span-4">
        <section className="team-panel rounded-[28px] p-6 lg:sticky lg:top-6">
          <h2 className="eyebrow team-mention">Suivi</h2>
          <dl className="mt-4 divide-y divide-border border-y border-border">
            <div className="flex items-baseline justify-between gap-3 py-4"><dt className="text-[14px] text-muted-foreground">Reçus, à contacter</dt><dd className="font-display text-[40px] leading-none">{counts.recu}</dd></div>
            <div className="flex items-baseline justify-between gap-3 py-4"><dt className="text-[14px] text-muted-foreground">Contactés</dt><dd className="font-display text-[40px] leading-none">{counts.contacte}</dd></div>
            <div className="flex items-baseline justify-between gap-3 py-4"><dt className="text-[14px] text-muted-foreground">Convertis</dt><dd className="font-display text-[40px] leading-none">{counts.converti}</dd></div>
          </dl>
          <h2 className="eyebrow team-mention mt-8">Parcours</h2>
          <ol className="mt-4 grid gap-4 text-[14px] leading-5">
            {["Le membre recommande une personne depuis son espace.", "L’équipe la contacte et note l’avancement ici.", "Une fois le parrainage converti, la fiche du nouveau membre est créée et mentionne son parrain."].map((step, i) => <li key={step} className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-[12px]">{i + 1}</span><span className="text-muted-foreground">{step}</span></li>)}
          </ol>
        </section>
      </aside>
    </div>
  </AdminShell>;
}
