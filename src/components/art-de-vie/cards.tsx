import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { unreadRequestNotificationsQuery } from "@/lib/adv-queries";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime, imageFor, offerImage, type Offer, type RequestItem, type RequestStatus } from "@/data/art-de-vie";
import logoBeige from "@/assets/logo-beige.svg";
import { ArrowCircle, StatusTimeline } from "./v3";
import { t } from "@/lib/i18n";

const statusClass: Record<RequestStatus, string> = {
  Nouvelle: "border border-foreground/55 text-foreground",
  "En cours": "bg-foreground/18 text-foreground",
  Confirmée: "bg-status-confirmed text-background",
  Terminée: "bg-primary text-primary-foreground",
  Annulée: "border border-dashed border-foreground/24 text-muted-foreground",
};
export function StatusBadge({ status, onPhoto = false }: { status: RequestStatus; onPhoto?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] shrink-0 items-center whitespace-nowrap rounded-full px-[11px] text-[12px] font-medium",
        statusClass[status],
        onPhoto && (status === "Nouvelle" || status === "En cours") && "bg-background/55 backdrop-blur-md",
      )}
    >
      {t(status)}
    </span>
  );
}

/** Pastille discrète « Nouveau » : une notification non lue concerne cette demande. */
function NewMark({ onPhoto = false }: { onPhoto?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", onPhoto ? "border border-foreground/22 bg-primary-deep text-foreground" : "bg-primary text-background")}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", onPhoto ? "bg-foreground" : "bg-background")} />
      {t("Nouveau")}
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
  const { data: unread = [] } = useQuery(unreadRequestNotificationsQuery);
  const isNew = unread.includes(item.id);
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
          <span className="dark-glass inline-flex h-[30px] items-center rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.13em]">
            {t(item.category)}
          </span>
          <span className="flex shrink-0 items-center gap-2">{isNew && <NewMark onPhoto />}<StatusBadge status={item.status} onPhoto /></span>
        </div>
        <div
          className={cn(
            "dark-glass absolute inset-x-4 bottom-4 rounded-[20px] p-5",
            desktop && "lg:inset-x-6 lg:bottom-6 lg:max-w-[520px] lg:p-6",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">{formatRequestDate(item)}</p>
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
        "block rounded-[24px] p-3 text-primary transition-transform active:scale-[0.99]",
        item.status === "Annulée" ? "border border-dashed border-foreground/24 bg-transparent text-muted-foreground" : "bg-panel",
        desktop && "lg:p-5",
      )}
    >
      <div
        className={cn(
          "grid grid-cols-[88px_minmax(0,1fr)] gap-3.5",
          desktop && "lg:grid-cols-[104px_minmax(0,1fr)]",
        )}
      >
        <Photo
          src={imageFor(item.image_key)}
          alt={item.title}
          category={item.category}
          className={cn("h-[124px] rounded-[16px]", desktop && "lg:h-[140px]")}
        />
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="eyebrow text-primary">{t(item.category)}</span>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">{isNew && <NewMark />}<StatusBadge status={item.status} /></span>
          </div>
          <h2 className={cn("v3-card-title mt-2.5 text-[21px] leading-[1.14]", desktop && "lg:text-[26px]")}>{item.title}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{formatDate(item.scheduled_date)}</p>
          {item.status !== "Annulée" && (
            <div className="mt-3">
              <StatusTimeline status={item.status} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function formatRequestDate(item: RequestItem) {
  const time = formatTime(item.scheduled_time);
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
            {category ? t(category) : alt}
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
          <span className="eyebrow">{t(offer.category)}</span>
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
        <span className="eyebrow">{t(offer.category)}</span>
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

const OFFER_TO_REQUEST: Record<string, string> = { Restaurant: "Tables", "Bien-être": "Soins", Voyage: "Séjours", Culture: "Sur mesure" };

export function EditorialOfferCard({ offer, variant }: { offer: Offer; variant: "hero" | "tile" | "feature" }) {
  // La demande reprend l'offre et la catégorie de prestation correspondante.
  const search = { offer: offer.title, category: OFFER_TO_REQUEST[offer.category] ?? "Sur mesure", partner: `${offer.partner} · ${offer.place}` };
  if (variant === "feature")
    return (
      <Link
        to="/demandes/nouvelle"
        search={search}
        className="block rounded-[28px] bg-primary p-3 text-primary-foreground transition-transform active:scale-[0.99] lg:grid lg:h-[440px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6 lg:p-4"
      >
        <Photo
          src={offerImage(offer)}
          alt={offer.title}
          category={offer.category}
          className="h-[244px] rounded-[18px] lg:h-full lg:min-h-0"
        />
        <div className="px-3 pb-2 pt-6 lg:flex lg:min-w-0 lg:flex-col lg:justify-center lg:px-0 lg:py-6">
          <span className="eyebrow text-ink-soft">
            {t(offer.category)} · {offer.promo}
          </span>
          <h2 className="v3-card-title mt-5 text-[32px] lg:text-[clamp(26px,2.8vw,40px)]">{offer.title}</h2>
          <p className="mt-4 text-[14px] leading-6 lg:text-[16px]">
            {offer.partner} · {offer.place} · {offer.validity}
          </p>
          <div className="mt-6 flex h-[52px] items-center justify-between rounded-full bg-primary-foreground pl-6 pr-2 text-primary">
            <span className="text-[15px] font-medium">{t("Demander cette offre")}</span>
            <ArrowCircle className="size-9" />
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
        "rounded-[24px] bg-panel lg:rounded-[28px]",
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
          {t(offer.category)}
          {variant === "hero" ? ` · ${offer.promo}` : ""}
        </span>
        {variant === "hero" && <ArrowCircle diagonal />}
      </div>
      <div className={cn("absolute inset-x-3 bottom-3 lg:inset-x-6 lg:bottom-6", variant === "hero" && "dark-glass rounded-[20px] p-5 lg:max-w-[560px] lg:p-6")}>
        <h2
          className={cn(
            "v3-card-title",
            variant === "hero" ? "text-[30px] lg:text-[40px]" : "text-[23px] lg:text-[30px]",
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
        desktop && "lg:flex-wrap lg:overflow-visible lg:pb-0",
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
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
              : dark
                ? "border border-foreground/24 bg-foreground/8 text-foreground hover:bg-foreground/15"
                : "border border-foreground/24 bg-foreground/8 text-foreground hover:bg-foreground/15",
            desktopDark &&
              (active === value
                ? "lg:bg-primary lg:text-primary-foreground lg:hover:bg-primary/90"
                : "lg:border-foreground/24 lg:bg-foreground/8 lg:text-foreground lg:hover:bg-foreground/15"),
          )}
        >
          {t(value)}
        </Button>
      ))}
    </div>
  );
}

/** Échec de chargement : message explicite et nouvel essai, plutôt qu'une liste vide trompeuse. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-card bg-card p-8 text-center text-sm text-muted-foreground">
      <p>{t("Le chargement n’a pas abouti. Vérifiez votre connexion.")}</p>
      <button type="button" onClick={onRetry} className="mt-4 inline-flex h-11 items-center rounded-full border border-foreground/24 px-5 text-[14px] font-medium text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {t("Réessayer")}
      </button>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card bg-card p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
