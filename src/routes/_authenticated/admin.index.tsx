import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight } from "lucide-react";
import { AdminShell, TeamStatus } from "@/components/art-de-vie/admin-shell";
import { Title } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/data/art-de-vie";
import { profileQuery } from "@/lib/adv-queries";
import { getDashboard } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [
    { title: "Tableau de bord — Équipe Art de Vie" },
    { name: "description", content: "Demandes à traiter et prochaines prestations de la conciergerie Art de Vie." },
    { property: "og:title", content: "Tableau de bord — Équipe Art de Vie" },
    { property: "og:description", content: "Demandes à traiter et prochaines prestations de la conciergerie Art de Vie." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

function elapsed(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} jours`;
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="team-panel flex min-h-[200px] flex-col justify-end rounded-card p-6">
    <p className="font-display text-[72px] leading-none">{value}</p>
    <p className="mt-2 text-[14px] text-muted-foreground">{label}</p>
  </div>;
}

function Page() {
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => fetchDashboard() });
  const { data: profile } = useQuery(profileQuery);
  const firstName = (profile?.full_name ?? "").trim().split(/\s+/)[0] ?? "";

  return <AdminShell>
    <p className="eyebrow team-mention">( Tableau de bord )</p>
    <Title italic={`${firstName || "à vous"}.`} className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">Bonjour, </Title>

    {isLoading || !data ? <div className="mt-8 grid gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[200px] rounded-card bg-primary/10" />)}</div> : <>
      <section aria-label="Chiffres" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={data.openCount} label={data.openCount > 1 ? "demandes ouvertes" : "demande ouverte"} />
        <Stat value={data.unassignedCount} label={data.unassignedCount > 1 ? "demandes à attribuer" : "demande à attribuer"} />
        <Stat value={data.activeMembers} label={data.activeMembers > 1 ? "membres actifs" : "membre actif"} />
        <div className="team-glass flex min-h-[200px] flex-col justify-end rounded-card p-6">
          <p className="eyebrow team-mention">( Dernière demande reçue )</p>
          {data.lastRequest ? <>
            <p className="mt-3 text-[24px] leading-tight">{data.lastRequest.title}</p>
            <p className="mt-2 text-[14px] text-muted-foreground">{elapsed(data.lastRequest.created_at)}</p>
          </> : <p className="mt-3 text-[14px] text-muted-foreground">Aucune demande reçue pour le moment.</p>}
        </div>
      </section>

      <Link to="/admin/demandes/nouvelle" className="team-glass mt-6 flex items-center justify-between gap-4 rounded-[28px] p-6 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0"><span className="eyebrow team-mention block">( Demande pour un membre )</span><span className="mt-2 block text-[24px] leading-tight">Créer une demande au nom d’un membre</span></span>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowUpRight className="size-4" /></span>
      </Link>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-12">
        <section className="team-panel min-w-0 rounded-[28px] p-6 lg:col-span-7">
          <h2 className="eyebrow team-mention">( À traiter )</h2>
          {data.toProcess.length === 0 ? <p className="mt-6 text-[14px] text-muted-foreground">Aucune nouvelle demande en attente.</p>
            : <ul className="mt-4">{data.toProcess.map((r) => <li key={r.id} className="border-b border-border last:border-0">
                <Link to="/admin/demandes/$requestId" params={{ requestId: r.id }} className="flex items-center gap-4 rounded-2xl py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><TeamStatus status={r.status} /><span className="text-[13px] text-muted-foreground">{r.member_name}</span></div>
                    <p className="mt-2 truncate text-[22px] leading-tight">{r.title}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{r.category}{r.scheduled_date ? ` · souhaitée le ${formatShortDate(r.scheduled_date)}` : ""} · reçue {elapsed(r.created_at)}</p>
                  </div>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowUpRight className="size-4" /></span>
                </Link>
              </li>)}</ul>}
        </section>

        <section className="team-glass min-w-0 rounded-[28px] p-6 lg:col-span-5">
          <h2 className="eyebrow team-mention">( Prochaines prestations )</h2>
          {data.upcoming.length === 0 ? <p className="mt-6 text-[14px] text-muted-foreground">Aucune prestation datée à venir.</p>
            : <ul className="mt-4">{data.upcoming.map((r) => {
                const d = new Date(`${r.scheduled_date}T00:00:00`);
                return <li key={r.id} className="border-b border-border last:border-0">
                  <Link to="/admin/demandes/$requestId" params={{ requestId: r.id }} className="flex items-center gap-4 rounded-2xl py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="w-12 shrink-0 text-center"><p className="font-display text-[30px] leading-none">{d.getDate()}</p><p className="mt-1 text-[11px] team-mention">{d.toLocaleDateString("fr-FR", { month: "short" })}</p></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-[18px]">{r.title}</p><p className="mt-1 text-[13px] text-muted-foreground">{r.member_name}{r.scheduled_time ? ` · ${r.scheduled_time}` : ""}</p></div>
                    <TeamStatus status={r.status} />
                  </Link>
                </li>;
              })}</ul>}
        </section>
      </div>
    </>}
  </AdminShell>;
}
