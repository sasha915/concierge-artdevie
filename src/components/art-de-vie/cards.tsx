import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDate, imageFor, offerImage, type Offer, type RequestItem, type RequestStatus } from "@/data/art-de-vie";
import logoBeige from "@/assets/logo-beige.svg";
import { ArrowCircle, StatusTimeline } from "./v3";

const statusClass: Record<RequestStatus, string> = {
  Nouvelle: "bg-primary/10 text-primary",
  "En cours": "bg-primary-light text-foreground",
  Confirmée: "bg-primary text-background",
  Terminée: "bg-primary-deep text-foreground",
  Annulée: "border border-primary/25 bg-transparent text-muted-foreground",
};
export function StatusBadge({ status, onPhoto = false }: { status: RequestStatus; onPhoto?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium",
        onPhoto ? "border border-foreground/22 bg-primary-deep text-foreground" : statusClass[status],
      )}
    >
      {status}
    </span>
  );
}

export function RequestCard({
  item,
  featured = false,
  desktop = false,
}: {
  item: RequestItem;
  featured?: boolean;
  desktop?: boolean;
}) {
  if (featured && item.status !== "Annulée")
    return (
      <Link
        to="/demandes/$requestId"
        params={{ requestId: item.id }}
        className={cn(
          "relative block h-[404px] overflow-hidden rounded-card text-foreground transition-transform active:scale-[0.99] lg:h-[430px]",
          desktop && "lg:h-full lg:min-h-[620px]",
        )}
      >
        <Photo
          src={imageFor(item.image_key)}
          alt={item.title}
          category={item.category}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <span className="dark-glass rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.13em]">
            {item.category}
          </span>
          <ArrowCircle diagonal />
        </div>
        <div
          className={cn(
            "dark-glass absolute inset-x-4 bottom-4 rounded-[20px] p-5",
            desktop && "lg:inset-x-6 lg:bottom-6 lg:max-w-[520px] lg:p-6",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px]">{formatRequestDate(item)}</p>
            <StatusBadge status={item.status} onPhoto />
          </div>
          <h2 className={cn("v3-card-title mt-5 text-[29px]", desktop && "lg:text-[40px]")}>{item.title}</h2>
          <div className="mt-5">
            <StatusTimeline status={item.status} dark />
          </div>
        </div>
      </Link>
    );
  return (
    <Link
      to="/demandes/$requestId"
      params={{ requestId: item.id }}
      className={cn(
        "block rounded-card p-4 text-primary transition-transform active:scale-[0.99]",
        item.status === "Annulée" ? "border border-primary/25 bg-transparent" : "bg-primary/10",
        desktop && "lg:p-5",
      )}
    >
      <div
        className={cn(
          "grid grid-cols-[116px_minmax(0,1fr)] gap-4 lg:grid-cols-[92px_minmax(0,1fr)]",
          desktop && "lg:grid-cols-[104px_minmax(0,1fr)]",
        )}
      >
        <Photo
          src={imageFor(item.image_key)}
          alt={item.title}
          category={item.category}
          className={cn("h-[116px] rounded-[16px]", desktop && "lg:h-[128px]")}
        />
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="eyebrow text-primary">{item.category}</span>
            <StatusBadge status={item.status} />
          </div>
          <h2 className={cn("v3-card-title mt-4 text-[22px]", desktop && "lg:text-[26px]")}>{item.title}</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">{formatDate(item.scheduled_date)}</p>
        </div>
      </div>
      {item.status !== "Annulée" && (
        <div className="mt-4">
          <StatusTimeline status={item.status} />
        </div>
      )}
    </Link>
  );
}

function formatRequestDate(item: RequestItem) {
  const time = item.scheduled_time?.slice(0, 5).replace(":", " h ");
  return `${formatDate(item.scheduled_date)}${time ? ` · ${time}` : ""}`;
}

export function Photo({
  src,
  alt,
  category,
  hero = false,
  eager = false,
  className = "",
}: {
  src?: string | undefined;
  alt: string;
  category?: string;
  hero?: boolean;
  eager?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-primary-deep", className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          width={1024}
          height={1280}
          loading={eager ? "eager" : "lazy"}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          {category === "Sur mesure" && (
            <img
              src={logoBeige}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-6 -right-6 h-[70%] w-auto max-w-none opacity-[0.06]"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center px-5 text-center font-display text-[38px] italic text-foreground/80">
            {category ?? alt}
          </span>
        </>
      )}
      {src && (
        <div
          className={cn("pointer-events-none absolute inset-0", hero ? "photo-hero-overlay" : "photo-card-overlay")}
        />
      )}
    </div>
  );
}

export function OfferCard({ offer, compact = false }: { offer: Offer; compact?: boolean }) {
  if (compact)
    return (
      <article className="min-w-[248px] overflow-hidden rounded-card bg-card sm:min-w-0">
        <Photo src={offerImage(offer)} alt={offer.title} className="aspect-[4/3]" />
        <div className="p-4">
          <span className="eyebrow">{offer.category}</span>
          <h3 className="mt-2 font-display text-xl text-primary">{offer.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{offer.partner}</p>
        </div>
      </article>
    );
  return (
    <article className="overflow-hidden rounded-card bg-card">
      <div className="relative">
        <Photo src={offerImage(offer)} alt={offer.title} className="aspect-[4/5]" />
        <span className="absolute left-4 top-4 rounded-full bg-card px-3 py-1.5 text-[10px] font-semibold text-primary">
          {offer.promo}
        </span>
      </div>
      <div className="p-5">
        <span className="eyebrow">{offer.category}</span>
        <h2 className="mt-3 font-display text-2xl text-primary">{offer.title}</h2>
        <p className="mt-1 text-sm font-medium text-foreground">{offer.partner}</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="size-4" />
          {offer.place}
          <span className="mx-1">·</span>
          {offer.validity}
        </div>
      </div>
    </article>
  );
}

export function EditorialOfferCard({ offer, variant }: { offer: Offer; variant: "hero" | "tile" | "feature" }) {
  const search = { offer: offer.title };
  if (variant === "feature")
    return (
      <Link
        to="/demandes/nouvelle"
        search={search}
        className="block rounded-[28px] bg-primary/10 p-4 text-primary transition-transform active:scale-[0.99] lg:grid lg:h-[440px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6 lg:p-6"
      >
        <Photo
          src={offerImage(offer)}
          alt={offer.title}
          category={offer.category}
          className="h-[244px] rounded-[18px] lg:h-full lg:min-h-0"
        />
        <div className="px-3 pb-2 pt-6 lg:flex lg:min-w-0 lg:flex-col lg:justify-center lg:px-0 lg:py-6">
          <span className="eyebrow text-primary">
            {offer.category} · {offer.promo}
          </span>
          <h2 className="v3-card-title mt-5 text-[32px] lg:text-[clamp(26px,2.8vw,40px)]">{offer.title}</h2>
          <p className="mt-4 text-[14px] leading-6 lg:text-[16px]">
            {offer.partner} · {offer.place} · {offer.validity}
          </p>
          <div className="mt-7 flex items-center justify-between border-t border-primary/25 pt-4">
            <span className="text-[14px] font-medium">Demander cette offre</span>
            <ArrowCircle inverse />
          </div>
        </div>
      </Link>
    );
  return (
    <Link
      to="/demandes/nouvelle"
      search={search}
      className={cn(
        "relative block overflow-hidden rounded-card text-foreground transition-transform active:scale-[0.99]",
        variant === "hero" ? "h-[412px] lg:h-[520px]" : "h-[268px] lg:h-full lg:min-h-[440px]",
      )}
    >
      <Photo
        src={offerImage(offer)}
        alt={offer.title}
        category={offer.category}
        className="absolute inset-0 h-full w-full"
      />
      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
        <span className="dark-glass rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.13em]">
          {offer.category}
          {variant === "hero" ? ` · ${offer.promo}` : ""}
        </span>
        {variant === "hero" && <ArrowCircle diagonal />}
      </div>
      <div className="absolute inset-x-5 bottom-5 lg:inset-x-8 lg:bottom-8">
        <h2
          className={cn(
            "v3-card-title",
            variant === "hero" ? "text-[36px] lg:text-[52px]" : "text-[23px] lg:text-[36px]",
          )}
        >
          {offer.title}
        </h2>
        <p className="mt-3 text-[13px] leading-5 lg:text-[16px] lg:leading-6">
          {offer.partner} · {offer.place}
        </p>
      </div>
    </Link>
  );
}

export function Filters({
  values,
  active,
  onChange,
  dark = false,
  desktop = false,
  desktopDark = false,
}: {
  desktop?: boolean;
  desktopDark?: boolean;
  values: string[];
  active: string;
  onChange: (v: string) => void;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "no-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1",
        desktop && "lg:max-w-[720px] lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0",
      )}
    >
      {values.map((value) => (
        <Button
          key={value}
          type="button"
          variant="soft"
          aria-pressed={active === value}
          onClick={() => onChange(value)}
          className={cn(
            "h-11 shrink-0 px-5 text-[15px] font-medium",
            active === value
              ? dark
                ? "bg-background text-primary hover:bg-background/90"
                : "bg-primary text-background hover:bg-primary/90"
              : dark
                ? "border border-foreground/22 bg-foreground/10 text-foreground hover:bg-foreground/20"
                : "border border-primary/25 bg-primary/10 text-primary",
            desktopDark &&
              (active === value
                ? "lg:bg-background lg:text-primary lg:hover:bg-background/90"
                : "lg:border-foreground/22 lg:bg-foreground/10 lg:text-foreground lg:hover:bg-foreground/20"),
          )}
        >
          {value}
        </Button>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card bg-card p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
