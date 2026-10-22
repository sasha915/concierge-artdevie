import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight } from "lucide-react";
import { AdminShell, TeamStatus } from "@/components/art-de-vie/admin-shell";
import { Title } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatShortDate } from "@/data/art-de-vie";
import { STALE_REQUEST_HOURS, RENEWAL_WINDOW_DAYS } from "@/lib/watch-rules";
import { profileQuery } from "@/lib/adv-queries";
import { getDashboard, takeRequest } from "@/lib/admin.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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
  const queryClient = useQueryClient();
  const take = useServerFn(takeRequest);
  const [busy, setBusy] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Bonjour");
  const [today, setToday] = useState("");
  useEffect(() => {
    setGreeting(new Date().getHours() < 18 ? "Bonjour" : "Bonsoir");
    const d = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    setToday(d.charAt(0).toUpperCase() + d.slice(1));
  }, []);

  async function takeCharge(id: string) {
    setBusy(id);
    try {
      const r = await take({ data: { id } });
      if (!r.ok) toast.error(r.reason); else toast.success("Demande prise en charge.");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch {
      toast.error("La prise en charge a échoué.");
    } finally {
      setBusy(null);
    }
  }

  return <AdminShell>
    <p className="eyebrow team-mention">{today || "Tableau de bord"}</p>
    <Title italic={`${firstName || "à vous"}.`} className="mt-3 text-primary lg:text-[clamp(52px,6vw,88px)]">{greeting}, </Title>
    {data && <p className="mt-4 flex flex-wrap gap-2 text-[14px]" aria-label="À traiter aujourd’hui">
      <span className="team-mention self-center">À traiter aujourd’hui :</span>
      <span className="rounded-full border border-primary px-3 py-1">{data.byStatus.nouvelle} nouvelle{data.byStatus.nouvelle > 1 ? "s" : ""}</span>
      <span className="rounded-full bg-primary/18 px-3 py-1">{data.byStatus.enCours} en cours</span>
      <span className="rounded-full bg-[var(--team-confirmed)] px-3 py-1 text-primary-foreground">{data.byStatus.confirmee} confirmée{data.byStatus.confirmee > 1 ? "s" : ""}</span>
    </p>}

    {isLoading || !data ? <div className="mt-8 grid gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[200px] rounded-card bg-primary/10" />)}</div> : <>
      <section aria-label="Chiffres" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={data.openCount} label={data.openCount > 1 ? "demandes ouvertes" : "demande ouverte"} />
        <Stat value={data.unassignedCount} label={data.unassignedCount > 1 ? "demandes à attribuer" : "demande à attribuer"} />
        <Stat value={data.activeMembers} label={data.activeMembers > 1 ? "membres actifs" : "membre actif"} />
        <div className="team-glass flex min-h-[200px] flex-col justify-end rounded-card p-6">
          <p className="eyebrow team-mention">Dernière demande reçue</p>
          {data.lastRequest ? <>
            <p className="mt-3 text-[24px] leading-tight">{data.lastRequest.title}</p>
            <p className="mt-2 text-[14px] text-muted-foreground">{data.lastRequest.member_name ? `${data.lastRequest.member_name} · ` : ""}{elapsed(data.lastRequest.created_at)}</p>
            {data.lastRequest.status === "Nouvelle" && <button type="button" disabled={busy === data.lastRequest.id} onClick={() => void takeCharge(data.lastRequest!.id)} className="mt-4 inline-flex h-11 w-fit items-center rounded-full bg-primary px-5 text-[14px] font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">Prendre en charge</button>}
          </> : <p className="mt-3 text-[14px] text-muted-foreground">Aucune demande reçue pour le moment.</p>}
        </div>
      </section>

      <WatchBlock watch={data.watch} />

      <Link to="/admin/demandes/nouvelle" className="team-glass mt-6 flex items-center justify-between gap-4 rounded-[28px] p-6 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0"><span className="eyebrow team-mention block">Demande pour un membre</span><span className="mt-2 block text-[24px] leading-tight">Créer une demande au nom d’un membre</span></span>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowUpRight className="size-4" /></span>
      </Link>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-12">
        <section className="team-panel min-w-0 rounded-[28px] p-6 lg:col-span-7">
          <h2 className="eyebrow team-mention">À traiter</h2>
          {data.toProcess.length === 0 ? <p className="mt-6 text-[14px] text-muted-foreground">Aucune nouvelle demande en attente.</p>
            : <ul className="mt-4">{data.toProcess.map((r) => <li key={r.id} className="flex items-center gap-3 border-b border-border last:border-0">
                <Link to="/admin/demandes/$requestId" params={{ requestId: r.id }} className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><TeamStatus status={r.status} /><span className="text-[13px] text-muted-foreground">{r.member_name}</span></div>
                    <p className="mt-2 truncate text-[22px] leading-tight">{r.title}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{r.category}{r.scheduled_date ? ` · souhaitée le ${formatShortDate(r.scheduled_date)}` : ""} · reçue {elapsed(r.created_at)}</p>
                  </div>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowUpRight className="size-4" /></span>
                </Link>
                {r.status === "Nouvelle" && <button type="button" disabled={busy === r.id} onClick={() => void takeCharge(r.id)} className="hidden h-10 shrink-0 items-center rounded-full border border-border px-4 text-[13px] font-medium hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:inline-flex">Prendre en charge</button>}
              </li>)}</ul>}
        </section>

        <section className="team-glass min-w-0 rounded-[28px] p-6 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="eyebrow team-mention">Prochaines prestations</h2>
            <Link to="/admin/agenda" className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-[13px] transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Voir l’agenda<ArrowUpRight className="size-4" /></Link>
          </div>
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

type Watch = Awaited<ReturnType<typeof getDashboard>>["watch"];

const watchLink = "flex items-center gap-4 rounded-2xl py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function WatchRow({ title, meta, signal }: { title: string; meta: string; signal: string }) {
  return <>
    <div className="min-w-0 flex-1"><p className="truncate text-[17px]">{title}</p><p className="mt-1 truncate text-[13px] text-muted-foreground">{meta}</p></div>
    <span className="shrink-0 rounded-full border border-dashed border-border px-3 py-1 text-[12px]">{signal}</span>
  </>;
}

function WatchGroup({ title, children, count }: { title: string; children: React.ReactNode; count: number }) {
  if (count === 0) return null;
  return <div className="min-w-0">
    <h3 className="flex items-center gap-2 text-[15px] font-medium">{title}<span className="inline-flex size-6 items-center justify-center rounded-full border border-border text-[12px]">{count}</span></h3>
    <ul className="mt-2">{children}</ul>
  </div>;
}

function WatchBlock({ watch }: { watch: Watch }) {
  const failed = watch.failedInvoices ?? [];
  const referrals = watch.receivedReferrals ?? [];
  const total = watch.staleRequests.length + watch.pendingChanges.length + watch.renewals.length + failed.length + referrals.length;
  return <section aria-labelledby="watch-title" className="team-panel mt-6 min-w-0 rounded-[28px] p-6">
    <h2 id="watch-title" className="eyebrow team-mention">À surveiller</h2>
    {total === 0 ? <p className="mt-4 text-[14px] text-muted-foreground">Rien à signaler pour le moment.</p>
      : <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-2">
        <WatchGroup title={`Demandes sans prise en charge depuis plus de ${STALE_REQUEST_HOURS} h`} count={watch.staleRequests.length}>
          {watch.staleRequests.map((r) => <li key={r.id} className="border-b border-border last:border-0"><Link to="/admin/demandes/$requestId" params={{ requestId: r.id }} className={watchLink}><WatchRow title={r.title} meta={r.member_name || "Membre"} signal={`En attente · ${r.waiting}`} /></Link></li>)}
        </WatchGroup>
        <WatchGroup title="Modifications demandées par les membres" count={watch.pendingChanges.length}>
          {watch.pendingChanges.map((c) => <li key={c.id} className="border-b border-border last:border-0"><Link to="/admin/demandes/$requestId" params={{ requestId: c.request_id }} className={watchLink}><WatchRow title={c.title} meta={c.member_name || "Membre"} signal={c.label} /></Link></li>)}
        </WatchGroup>
        <WatchGroup title={`Adhésions à échéance sous ${RENEWAL_WINDOW_DAYS} jours`} count={watch.renewals.length}>
          {watch.renewals.map((m) => <li key={m.id} className="border-b border-border last:border-0"><Link to="/admin/membres/$memberId" params={{ memberId: m.id }} className={watchLink}><WatchRow title={m.full_name || "Membre"} meta="Adhésion" signal={formatShortDate(m.valid_until)} /></Link></li>)}
        </WatchGroup>
        <WatchGroup title="Factures en échec de paiement" count={failed.length}>
          {failed.map((i) => <li key={i.id} className="border-b border-border last:border-0"><Link to="/admin/membres/$memberId" params={{ memberId: i.user_id }} className={watchLink}><WatchRow title={i.number} meta={`${i.member_name || "Membre"} · ${formatAmount(i.amount_cents)}`} signal={i.status} /></Link></li>)}
        </WatchGroup>
        <WatchGroup title="Parrainages reçus" count={referrals.length}>
          {referrals.map((r) => <li key={r.id} className="border-b border-border last:border-0"><Link to="/admin/parrainages" className={watchLink}><WatchRow title={r.full_name} meta={r.inviter_name ? `Recommandé par ${r.inviter_name}` : "Parrainage"} signal="Reçu" /></Link></li>)}
        </WatchGroup>
      </div>}
  </section>;
}
