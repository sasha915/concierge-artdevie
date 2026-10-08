import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { EmptyState, Photo, StatusBadge } from "@/components/art-de-vie/cards";
import { Button } from "@/components/ui/button";
import { PillAction, StatusTimeline } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, imageFor } from "@/data/art-de-vie";
import { requestsQuery } from "@/lib/adv-queries";

export const Route = createFileRoute("/_authenticated/demandes/$requestId")({ head: () => ({ meta: [{ title: "Détail de la demande — Art de Vie" }, { name: "description", content: "Détails et suivi de votre demande." }, { property: "og:title", content: "Détail de la demande — Art de Vie" }, { property: "og:description", content: "Détails et suivi de votre demande." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const { requestId } = Route.useParams();
  const { data: requests = [], isLoading } = useQuery(requestsQuery);
  const item = requests.find((r) => r.id === requestId);
  if (!item) return <AppShell nav={false}><div className="mx-auto max-w-2xl pt-10">{isLoading ? <Skeleton className="h-[452px] rounded-[28px] bg-primary/10" /> : <EmptyState>Cette demande est introuvable.</EmptyState>}</div></AppShell>;
  return <AppShell nav={false}>
    <div className="mx-auto max-w-[760px]">
      <section className="relative -mx-2 -mt-3 h-[452px] overflow-hidden rounded-[28px] text-primary-foreground sm:mx-0 sm:mt-0 lg:h-[520px]"><Photo src={imageFor(item.image_key)} alt={item.title} category={item.category} className="absolute inset-0 h-full w-full"/><div className="absolute inset-x-4 top-4 flex items-center justify-between"><Button asChild variant="ghost" size="icon" className="dark-glass text-primary-foreground hover:bg-primary-deep/70"><Link to="/demandes" aria-label="Retour"><ChevronLeft/></Link></Button><span className="dark-glass rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.13em]">{item.category}</span></div><div className="absolute inset-x-5 bottom-5"><h1 className="v3-card-title max-w-[520px] text-[38px] lg:text-[46px]">{item.title}</h1><p className="mt-3 text-[13px]">{formatDate(item.scheduled_date)}{item.scheduled_time ? ` · ${item.scheduled_time.slice(0, 5).replace(":", " h ")}` : ""}</p></div></section>
      <section className="mt-3 rounded-[28px] bg-primary-deep p-5 text-primary-foreground"><div className="flex items-center justify-between gap-3"><h2 className="eyebrow text-primary-foreground">Suivi</h2><StatusBadge status={item.status} onPhoto /></div><div className="mt-5"><StatusTimeline status={item.status} dark /></div></section>
      <section className="mt-3 rounded-[28px] bg-primary/10 p-5 text-primary"><h2 className="eyebrow text-primary">Votre demande</h2><div className="mt-5 grid gap-3"><p className="rounded-[18px] bg-card p-4 text-[14px] leading-6">{item.description || "Aucune précision complémentaire n’a été indiquée."}</p><p className="rounded-[18px] bg-primary p-4 text-[14px] text-primary-foreground">Votre demande a bien été transmise.</p></div></section>
      <section className="mt-8 px-2 text-primary"><h2 className="eyebrow text-primary">Détails</h2><dl className="mt-4 divide-y divide-primary/25 border-y border-primary/25 text-[14px]"><Detail label="Date" value={formatDate(item.scheduled_date)} /><Detail label="Heure" value={item.scheduled_time?.slice(0, 5).replace(":", " h ") ?? "À définir"} />{item.guests && <Detail label={item.category === "Tables" ? "Couverts" : "Personnes"} value={String(item.guests)} />}<Detail label="Concierge" value={item.concierge} /></dl></section>
      <div className="mt-6"><PillAction asChild className="w-full"><Link to="/demandes/nouvelle">Faire une nouvelle demande</Link></PillAction></div>
    </div>
  </AppShell>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 py-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right text-[16px]">{value}</dd></div>;
}
