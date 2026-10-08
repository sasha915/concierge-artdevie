import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDate, imageFor, type Offer, type RequestItem, type RequestStatus } from "@/data/art-de-vie";

const statusClass: Record<RequestStatus, string> = {
  "Nouvelle": "bg-primary/10 text-primary",
  "En cours": "bg-primary-light text-primary-foreground",
  "Confirmée": "bg-primary text-primary-foreground",
  "Terminée": "bg-primary-deep text-primary-foreground",
  "Annulée": "border border-primary/25 bg-transparent text-muted-foreground",
};
export function StatusBadge({ status, onPhoto = false }: { status: RequestStatus; onPhoto?: boolean }) { return <span className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-medium", onPhoto ? "border border-primary-foreground/22 bg-primary-deep text-primary-foreground" : statusClass[status])}>{status}</span>; }

export function RequestCard({ item }: { item: RequestItem }) {
  return <Link to="/demandes/$requestId" params={{ requestId: item.id }} className="block rounded-card bg-card p-5 transition-transform hover:-translate-y-0.5">
    <div className="flex items-start justify-between gap-4"><span className="eyebrow">{item.category}</span><StatusBadge status={item.status} /></div>
    <h2 className="mt-5 font-display text-[23px] font-normal text-primary">{item.title}</h2>
    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
    <div className="mt-5 flex items-center gap-2 border-t border-primary/10 pt-4 text-xs text-muted-foreground"><CalendarDays className="size-4" />{formatDate(item.scheduled_date)}</div>
  </Link>;
}

export function Photo({ src, alt, category, hero = false, eager = false, className = "" }: { src?: string; alt: string; category?: string; hero?: boolean; eager?: boolean; className?: string }) {
  return <div className={cn("relative overflow-hidden bg-primary-deep", className)}>{src ? <img src={src} alt={alt} width={1024} height={1280} loading={eager ? "eager" : "lazy"} className="h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center px-5 text-center font-display text-[38px] italic text-primary-foreground/80">{category ?? alt}</span>}{src && <div className={cn("pointer-events-none absolute inset-0", hero ? "photo-hero-overlay" : "photo-card-overlay")} />}</div>;
}

export function OfferCard({ offer, compact = false }: { offer: Offer; compact?: boolean }) {
  if (compact) return <article className="min-w-[248px] overflow-hidden rounded-card bg-card sm:min-w-0"><Photo src={imageFor(offer.image_key)} alt={offer.title} className="aspect-[4/3]"/><div className="p-4"><span className="eyebrow">{offer.category}</span><h3 className="mt-2 font-display text-xl text-primary">{offer.title}</h3><p className="mt-1 text-xs text-muted-foreground">{offer.partner}</p></div></article>;
  return <article className="overflow-hidden rounded-card bg-card"><div className="relative"><Photo src={imageFor(offer.image_key)} alt={offer.title} className="aspect-[4/5]"/><span className="absolute left-4 top-4 rounded-full bg-card px-3 py-1.5 text-[10px] font-semibold text-primary">{offer.promo}</span></div><div className="p-5"><span className="eyebrow">{offer.category}</span><h2 className="mt-3 font-display text-2xl text-primary">{offer.title}</h2><p className="mt-1 text-sm font-medium text-foreground">{offer.partner}</p><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-4" />{offer.place}<span className="mx-1">·</span>{offer.validity}</div></div></article>;
}

export function Filters({ values, active, onChange, dark = false }: { values: string[]; active: string; onChange: (v: string) => void; dark?: boolean }) {
  return <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1">{values.map((value) => <Button key={value} type="button" variant="soft" aria-pressed={active === value} onClick={() => onChange(value)} className={cn("h-11 shrink-0 px-5 text-[15px] font-medium", active === value ? dark ? "bg-background text-primary hover:bg-background/90" : "bg-primary text-primary-foreground hover:bg-primary-deep" : dark ? "border border-primary-foreground/22 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20" : "border border-primary/25 bg-primary/10 text-primary")}>{value}</Button>)}</div>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card bg-card p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
