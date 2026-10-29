import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Plus } from "lucide-react";
import vendome from "@/assets/v3/place-vendome.jpg.asset.json";
import { AdminShell, TeamStatus } from "@/components/art-de-vie/admin-shell";
import { Title } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount, formatShortDate } from "@/data/art-de-vie";
import { STALE_REQUEST_HOURS, RENEWAL_WINDOW_DAYS } from "@/lib/watch-rules";
import { profileQuery } from "@/lib/adv-queries";
import { pendingDelegatesQuery } from "@/lib/admin-queries";
import { getDashboard, resolveNotificationFailure, resolvePaymentFailure, takeRequest } from "@/lib/admin.functions";
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

function Stat({ value, label, to }: { value: number; label: string; to: "/admin/demandes" | "/admin/membres" }) {
  return <Link to={to} className="team-panel flex min-h-[200px] flex-col justify-between rounded-[24px] p-6 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <span className="flex justify-end"><span className="flex size-10 items-center justify-center rounded-full border border-border"><ArrowUpRight className="size-4" /></span></span>
    <span><span className="block font-display text-[72px] leading-none">{value}</span><span className="mt-2 block text-[14px] text-muted-foreground">{label}</span></span>
  </Link>;
}

function Count({ value, label }: { value: number; label: string }) {
  return <Link to="/admin/demandes" className="flex items-baseline gap-2.5 rounded-[20px] border border-foreground/24 bg-background/55 px-5 py-3 backdrop-blur-[18px] transition-colors hover:bg-background/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <span className="font-display text-[36px] leading-10">{value}</span><span className="text-[15px] text-muted-foreground">{label}</span>
  </Link>;
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

  const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
  return <AdminShell>
    <h1 className="sr-only">Tableau de bord</h1>
    {isLoading || !data ? <div className="grid gap-4 lg:grid-cols-12"><Skeleton className="h-[460px] rounded-[28px] bg-primary/10 lg:col-span-8" /><Skeleton className="h-[460px] rounded-[28px] bg-primary/10 lg:col-span-4" /></div> : <>
      <div className="grid min-w-0 gap-4 lg:grid-cols-12">
        {/* Maquette V4 : en-tête photo « À traiter aujourd'hui. » et compteurs cliquables. */}
        <section className="relative isolate flex min-h-[420px] flex-col justify-between gap-8 overflow-hidden rounded-[28px] bg-[var(--team-panel)] p-6 lg:col-span-8 lg:min-h-[460px] lg:p-9">
          <img src={vendome.url} alt="" className="absolute inset-0 -z-20 size-full object-cover object-[center_62%]" />
          <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(36,28,51,0.55)_0%,rgba(36,28,51,0.30)_38%,rgba(36,28,51,0.95)_100%)]" />
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow text-muted-foreground">{today || "Aujourd’hui"}</p>
            <span className="rounded-full border border-foreground/24 bg-background/55 px-4 py-1.5 text-[14px] backdrop-blur-[14px]">{greeting}{firstName ? ` ${firstName}` : ""}</span>
          </div>
          <div>
            <Title as="h2" italic="aujourd’hui." className="text-[56px] leading-[0.96] text-primary lg:text-[clamp(56px,6vw,96px)]">À traiter<br /></Title>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Count value={data.byStatus.nouvelle} label={plural(data.byStatus.nouvelle, "nouvelle", "nouvelles")} />
              <Count value={data.byStatus.enCours} label="en cours" />
              <Count value={data.byStatus.confirmee} label={plural(data.byStatus.confirmee, "confirmée", "confirmées")} />
            </div>
          </div>
        </section>
        <section className="flex min-h-[260px] flex-col justify-between rounded-[28px] bg-primary p-6 text-primary-foreground lg:col-span-4">
          <p className="eyebrow text-primary-foreground/75">Dernière demande reçue</p>
          {data.lastRequest ? <div>
            <span className="inline-flex rounded-full border border-primary-foreground/60 px-3 py-1 text-[11px] font-medium">{data.lastRequest.status}</span>
            <Link to="/admin/demandes/$requestId" params={{ requestId: data.lastRequest.id }} className="mt-4 block text-[32px] leading-[1.08] tracking-[-0.04em] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{data.lastRequest.title}</Link>
            <p className="mt-2 text-[15px] opacity-80">{data.lastRequest.member_name ? `${data.lastRequest.member_name} · ` : ""}{elapsed(data.lastRequest.created_at)}</p>
            {data.lastRequest.status === "Nouvelle" && <button type="button" disabled={busy === data.lastRequest.id} onClick={() => void takeCharge(data.lastRequest!.id)} className="mt-6 inline-flex h-[52px] items-center gap-3 rounded-full bg-primary-foreground pl-6 pr-2 text-[15px] font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">Prendre en charge<span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowUpRight className="size-4" /></span></button>}
          </div> : <p className="text-[15px] opacity-80">Aucune demande reçue pour le moment.</p>}
        </section>
      </div>

      <section aria-label="Chiffres" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat to="/admin/demandes" value={data.openCount} label={plural(data.openCount, "demande ouverte", "demandes ouvertes")} />
        <Stat to="/admin/demandes" value={data.unassignedCount} label={plural(data.unassignedCount, "demande à attribuer", "demandes à attribuer")} />
        <Stat to="/admin/membres" value={data.activeMembers} label={plural(data.activeMembers, "membre actif", "membres actifs")} />
        <Link to="/admin/demandes/nouvelle" className="flex min-h-[200px] flex-col justify-between rounded-[24px] border border-dashed border-foreground/24 p-6 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus className="size-6" /></span>
          <span><span className="eyebrow team-mention block">Demande pour un membre</span><span className="mt-2 block text-[24px] leading-tight">Nouvelle demande</span></span>
        </Link>
      </section>

      <WatchBlock watch={data.watch} />

      {data.mollieMode !== undefined && <p role="status" className="team-panel mt-4 rounded-[28px] px-6 py-4 text-[14px]">
        Paiements Mollie : {data.mollieMode === "live" ? "mode réel, les paiements sont encaissés." : data.mollieMode === "test" ? "mode test, aucun paiement n’est encaissé. À passer en mode réel avant l’ouverture aux membres." : "non configurés."}
      </p>}


      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-12">
        <section className="team-panel min-w-0 rounded-[28px] p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="eyebrow team-mention">À traiter</h2><Link to="/admin/demandes" className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-[13px] transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Toutes les demandes<ArrowUpRight className="size-4" /></Link></div>
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
            <Link to="/admin/agenda" className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-[13px] transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Agenda<ArrowUpRight className="size-4" /></Link>
          </div>
          {data.upcoming.length === 0 ? <p className="mt-6 text-[14px] text-muted-foreground">Aucune prestation datée à venir.</p>
            : <ul className="mt-4">{data.upcoming.map((r) => {
                const d = new Date(`${r.scheduled_date}T00:00:00`);
                return <li key={r.id} className="border-b border-border last:border-0">
                  <Link to="/admin/demandes/$requestId" params={{ requestId: r.id }} className="flex items-center gap-4 rounded-2xl py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="w-12 shrink-0 text-center"><p className="font-display text-[30px] leading-none">{d.getDate()}</p><p className="mt-1 text-[11px] team-mention">{d.toLocaleDateString("fr-FR", { month: "short" })}</p></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-[18px]">{r.title}</p><p className="mt-1 text-[13px] text-muted-foreground">{r.member_name}{r.scheduled_time ? ` · ${r.scheduled_time.slice(0, 5).replace(":", " h ")}` : ""}</p></div>
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
  const charges = watch.failedCharges ?? [];
  const noWhatsapp = watch.signatureWithoutWhatsapp ?? [];
  const alerts = watch.failedAlerts ?? [];
  const queryClient = useQueryClient();
  const resolveAlert = useServerFn(resolveNotificationFailure);
  async function markAlertSeen(id: string) {
    const r = await resolveAlert({ data: { id } });
    if (!r.ok) toast.error(r.reason); else await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
  }
  const resolve = useServerFn(resolvePaymentFailure);
  async function markResolved(id: string) {
    const r = await resolve({ data: { id } });
    if (!r.ok) toast.error(r.reason); else await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
  }
  // Lot 5.4 : proches invités par les membres, à confirmer par l'équipe.
  const { data: delegates = [] } = useQuery(pendingDelegatesQuery);
  const total = watch.staleRequests.length + watch.pendingChanges.length + watch.renewals.length + failed.length + referrals.length + delegates.length + charges.length + noWhatsapp.length + alerts.length;
  return <section aria-labelledby="watch-title" className="team-panel mt-6 min-w-0 rounded-[28px] p-6">
    <h2 id="watch-title" className="eyebrow team-mention">À surveiller</h2>
    {total === 0 ? <p className="mt-4 text-[14px] text-muted-foreground">Rien à signaler pour le moment.</p>
      : <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-2">
        <WatchGroup title="Alertes WhatsApp non parties" count={alerts.length}>
          {alerts.map((a) => <li key={a.id} className="flex items-center gap-3 border-b border-border last:border-0">
            {a.request_id ? <Link to="/admin/demandes/$requestId" params={{ requestId: a.request_id }} className={`${watchLink} min-w-0 flex-1`}><WatchRow title={a.title} meta={`${a.kind}${a.member_name ? ` · ${a.member_name}` : ""} · ${formatShortDate(a.created_at.slice(0, 10))}`} signal={a.reason} /></Link>
              : <div className={`${watchLink} min-w-0 flex-1`}><WatchRow title={a.title} meta={a.kind} signal={a.reason} /></div>}
            <button type="button" onClick={() => void markAlertSeen(a.id)} className="shrink-0 rounded-full border border-border px-3 py-1 text-[12px] hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Traité</button>
          </li>)}
        </WatchGroup>
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
        <WatchGroup title="Prélèvements rejetés" count={charges.length}>
          {charges.map((c) => <li key={c.id} className="flex items-center gap-3 border-b border-border last:border-0">
            {c.user_id ? <Link to="/admin/membres/$memberId" params={{ memberId: c.user_id }} className={`${watchLink} min-w-0 flex-1`}><WatchRow title={c.member_name || "Membre"} meta={`${formatAmount(c.amount_cents)} · ${formatShortDate(c.created_at.slice(0, 10))}`} signal={c.status} /></Link>
              : <div className={`${watchLink} min-w-0 flex-1`}><WatchRow title="Membre inconnu" meta={formatAmount(c.amount_cents)} signal={c.status} /></div>}
            <button type="button" onClick={() => void markResolved(c.id)} className="shrink-0 rounded-full border border-border px-3 py-1 text-[12px] hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Relancé</button>
          </li>)}
        </WatchGroup>
        <WatchGroup title="Fiches Signature sans WhatsApp du concierge" count={noWhatsapp.length}>
          {noWhatsapp.map((m) => <li key={m.id} className="border-b border-border last:border-0"><Link to="/admin/membres/$memberId" params={{ memberId: m.id }} className={watchLink}><WatchRow title={m.full_name || "Membre"} meta="Demandes envoyées au numéro commun" signal="À compléter" /></Link></li>)}
        </WatchGroup>
        <WatchGroup title="Proches à confirmer" count={delegates.length}>
          {delegates.map((d) => <li key={d.id} className="border-b border-border last:border-0"><Link to="/admin/membres/$memberId" params={{ memberId: d.member_id }} className={watchLink}><WatchRow title={d.full_name} meta={d.member_name ? `Proche de ${d.member_name}` : "Proche"} signal={formatShortDate(d.invited_at.slice(0, 10))} /></Link></li>)}
        </WatchGroup>
        <WatchGroup title="Parrainages reçus" count={referrals.length}>
          {referrals.map((r) => <li key={r.id} className="border-b border-border last:border-0"><Link to="/admin/parrainages" className={watchLink}><WatchRow title={r.full_name} meta={r.inviter_name ? `Recommandé par ${r.inviter_name}` : "Parrainage"} signal="Reçu" /></Link></li>)}
        </WatchGroup>
      </div>}
  </section>;
}
