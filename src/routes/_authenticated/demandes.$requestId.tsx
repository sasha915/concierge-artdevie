import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, Clock3, UserRound } from "lucide-react";
import { AppShell, Logo } from "@/components/art-de-vie/app-shell";
import { EmptyState, Photo, StatusBadge } from "@/components/art-de-vie/cards";
import { Button } from "@/components/ui/button";
import { formatDate, imageFor } from "@/data/art-de-vie";
import { requestsQuery } from "@/lib/adv-queries";

export const Route = createFileRoute("/_authenticated/demandes/$requestId")({ head: () => ({ meta: [{ title: "Détail de la demande — Art de Vie" }, { name: "description", content: "Détails et suivi de votre demande." }, { property: "og:title", content: "Détail de la demande — Art de Vie" }, { property: "og:description", content: "Détails et suivi de votre demande." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });

function Page() {
  const { requestId } = Route.useParams();
  const { data: requests = [], isLoading } = useQuery(requestsQuery);
  const item = requests.find((r) => r.id === requestId);
  if (!item) return <AppShell nav={false}><div className="mx-auto max-w-2xl pt-10"><EmptyState>{isLoading ? "Chargement…" : "Cette demande est introuvable."}</EmptyState></div></AppShell>;
  return <AppShell nav={false}>
    <section className="relative -mx-5 -mt-6 sm:-mx-8 lg:-mx-10"><Photo src={imageFor(item.image_key)} alt={item.title} className="h-[46vh] min-h-[380px]"/><div className="absolute inset-x-5 top-6 flex items-center justify-between"><Button asChild variant="icon" size="icon"><Link to="/demandes" aria-label="Retour"><ChevronLeft/></Link></Button><div className="rounded-xl bg-card/20 p-3 text-primary-foreground backdrop-blur-md"><Logo inverse/></div></div><div className="absolute inset-x-5 bottom-7 text-primary-foreground"><StatusBadge status={item.status}/><h1 className="mt-4 font-display text-[38px] leading-tight">{item.title}</h1></div></section>
    <div className="mx-auto max-w-2xl">
      <section className="mt-7 rounded-card bg-card p-5"><p className="font-display text-xl text-primary">Votre demande a bien été transmise.</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description || "Votre concierge s’occupe de chaque détail et reviendra vers vous très prochainement."}</p></section>
      <section className="mt-5 rounded-card bg-card p-5"><h2 className="eyebrow">Détails</h2><div className="mt-5 grid gap-5 text-sm"><div className="flex items-center gap-4"><CalendarDays className="size-5 text-primary"/><span>{formatDate(item.scheduled_date)}</span></div><div className="flex items-center gap-4"><Clock3 className="size-5 text-primary"/><span>{item.scheduled_time ?? "Heure à définir"}</span></div><div className="flex items-center gap-4"><UserRound className="size-5 text-primary"/><span>{item.concierge}</span></div></div></section>
      <div className="mt-6 grid gap-3"><Button asChild size="lg"><Link to="/demandes/nouvelle">Faire une nouvelle demande</Link></Button></div>
    </div>
  </AppShell>;
}
