import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, CalendarPlus, Download, FileText, PencilLine, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { cancelMyRequest, getMemberFileUrl, sendMemberMessage, submitReview } from "@/lib/messages.functions";
import { DEFAULT_REVIEW_TITLE, REVIEW_TITLES, proposalBanner } from "@/lib/planning-rules";
import { buildIcs, canAddToCalendar, canRenew, canRequestChange, canReview, changeKindLabel, FILE_TYPES, fileSizeLabel, REVIEW_RATINGS, type ReviewRating } from "@/lib/request-actions-rules";
import type { RequestItem } from "@/data/art-de-vie";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft } from "lucide-react";
import { AppShell, TopBar } from "@/components/art-de-vie/app-shell";
import { EmptyState, ErrorState, Photo, StatusBadge } from "@/components/art-de-vie/cards";
import { Button } from "@/components/ui/button";
import { PillAction, StatusTimeline, Title } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, imageFor, formatTime, requestPhoto } from "@/data/art-de-vie";
import { myDelegatesQuery, profileQuery, requestChangesMemberQuery, requestFilesMemberQuery, requestProposalMemberQuery, requestMessagesQuery, requestReviewMemberQuery, requestsQuery, unreadRequestNotificationsQuery } from "@/lib/adv-queries";
import { getLang, locale, t, tPair } from "@/lib/i18n";
import { useDelegation } from "@/components/art-de-vie/use-delegation";
import { DelegateRequestDetail } from "@/components/art-de-vie/delegate";

export const Route = createFileRoute("/_authenticated/demandes/$requestId")({
  head: () => ({
    meta: [
      { title: t("Détail de la demande — Art de Vie") },
      { name: "description", content: t("Détails et suivi de votre demande.") },
      { property: "og:title", content: t("Détail de la demande — Art de Vie") },
      { property: "og:description", content: t("Détails et suivi de votre demande.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { requestId } = Route.useParams();
  const { delegation } = useDelegation();
  if (delegation) return <DelegateRequestDetail requestId={requestId} delegation={delegation} />;
  return <MemberPage requestId={requestId} />;
}

function MemberPage({ requestId }: { requestId: string }) {
  const { data: requests = [], isLoading, isError, refetch } = useQuery(requestsQuery);
  const item = requests.find((r) => r.id === requestId);
  const queryClient = useQueryClient();
  const { data: unread = [] } = useQuery(unreadRequestNotificationsQuery);
  const hasUnread = unread.includes(requestId);
  useEffect(() => {
    if (!hasUnread) return;
    // Ouvrir la demande vaut lecture de ses notifications.
    void supabase.rpc("mark_request_notifications_read", { _request_id: requestId }).then(() =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    );
  }, [hasUnread, requestId, queryClient]);
  if (!item)
    return (
      <AppShell nav={false}>
        <div className="mx-auto max-w-2xl pt-10">
          {isLoading ? (
            <Skeleton className="h-[452px] rounded-[28px] bg-panel" />
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : (
            <EmptyState>{t("Cette demande est introuvable.")}</EmptyState>
          )}
        </div>
      </AppShell>
    );
  return (
    <AppShell nav={false}>
      <div className="hidden lg:mb-5 lg:block">
        <TopBar />
      </div>
      <div className="mx-auto max-w-[760px] lg:grid lg:max-w-none lg:grid-cols-12 lg:items-start lg:gap-4">
        <div className="min-w-0 lg:col-span-8">
        <section className="relative -mx-2 -mt-3 h-[452px] overflow-hidden rounded-[28px] bg-panel text-foreground sm:mx-0 sm:mt-0 lg:h-[340px]">
          <Photo
            src={requestPhoto(item)}
            alt={item.title}
            category={item.category}
            hero
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between lg:inset-x-5 lg:top-5">
            <Button asChild variant="ghost" size="icon" className="dark-glass text-foreground hover:bg-primary-deep/70 lg:hidden">
              <Link to="/demandes" aria-label={t("Retour")}>
                <ChevronLeft />
              </Link>
            </Button>
            <Link to="/demandes" className="dark-glass hidden h-10 items-center gap-2 rounded-full px-4 text-[14px] lg:inline-flex">
              <ChevronLeft className="size-4" />
              {t("Mes demandes")}
            </Link>
            <span className="dark-glass inline-flex h-[30px] items-center rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.13em]">
              {t(item.category)}
            </span>
          </div>
          <div className="absolute inset-x-5 bottom-5 lg:inset-x-6 lg:bottom-6">
            <h1 className="v3-heading max-w-[620px] text-[43px] leading-[1.02] lg:text-[clamp(48px,4.6vw,68px)]">{item.title.split(" ").slice(0, -1).join(" ")}{" "}<em className="font-display font-normal">{item.title.split(" ").at(-1)}</em></h1>
            <p className="mt-3 text-[15px] text-muted-foreground lg:text-[16px]">
              {formatDate(item.scheduled_date)}
              {item.scheduled_time ? ` · ${formatTime(item.scheduled_time)}` : ""}
            </p>
          </div>
        </section>
        <section className="mt-3 rounded-[24px] bg-panel p-5 text-foreground lg:rounded-[28px] lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="eyebrow text-muted-foreground">{t("Suivi")}</h2>
            <StatusBadge status={item.status} />
          </div>
          <div className="mt-[18px]">
            <StatusTimeline status={item.status} dark />
          </div>
        </section>
        <ProposalBanner requestId={item.id} />
        <Exchanges requestId={item.id} description={item.description} cancelled={item.status === "Annulée"} />
        <Documents requestId={item.id} />
        </div>
        <div className="min-w-0 lg:col-span-4">
        <section className="mt-3 rounded-[24px] bg-panel px-5 pb-1.5 pt-5 text-primary lg:mt-0 lg:rounded-[28px] lg:px-7 lg:pt-7">
          <h2 className="eyebrow text-primary">{t("Détails")}</h2>
          <dl className="mt-3.5 divide-y divide-foreground/16 border-t border-foreground/16 text-[14px]">
            <Detail label={t("Date")} value={formatDate(item.scheduled_date)} />
            <Detail label={t("Heure")} value={item.scheduled_time ? formatTime(item.scheduled_time) : t("À définir")} />
            {item.guests && (
              <Detail label={item.category === "Tables" ? t("Couverts") : t("Personnes")} value={String(item.guests)} />
            )}
            <Detail label={t("Concierge")} value={item.concierge === "À attribuer" ? t("À attribuer") : item.concierge} />
            {item.delegate?.full_name && <Detail label={t("Demandée par")} value={item.delegate.full_name} />}
          </dl>
        </section>
        <RequestActions item={item} />
        <div className="mt-6 lg:mt-3">
          <PillAction asChild className="w-full">
            <Link to="/demandes/nouvelle" search={{ offer: undefined }}>
              {t("Faire une nouvelle demande")}
            </Link>
          </PillAction>
        </div>
      </div>
      </div>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[15px]">
      <dt className="text-[14px] text-muted-foreground">{label}</dt>
      <dd className="text-right text-[18px] tracking-[-0.02em] lg:text-[22px]">{value}</dd>
    </div>
  );
}

function stamp(iso: string) {
  return new Date(iso).toLocaleString(locale(), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/** Lot 5.1 — fil d'échanges : messages du membre à droite, de la conciergerie à gauche dans la bulle violette. */
function Exchanges({ requestId, description, cancelled }: { requestId: string; description: string; cancelled: boolean }) {
  const queryClient = useQueryClient();
  const { data: messages = [], isLoading } = useQuery(requestMessagesQuery(requestId));
  const { data: profile } = useQuery(profileQuery);
  const { data: delegates = [] } = useQuery(myDelegatesQuery);
  const send = useServerFn(sendMemberMessage);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const hasTeamMessage = messages.some((m) => m.author_role === "équipe");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await send({ data: { requestId, body: text } });
      if (!res.ok) { toast.error(t(res.reason)); return; }
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["requests", requestId, "messages"] });
    } catch {
      toast.error(t("Votre message n’a pas pu être envoyé."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="exchanges-title" className="mt-3 rounded-[24px] border border-foreground/16 bg-glass p-5 text-primary lg:mt-3 lg:rounded-[28px] lg:p-8">
      <h2 id="exchanges-title" className="eyebrow text-primary">{t("Échanges")}</h2>
      <ol className="mt-5 grid gap-3" aria-live="polite">
        <li className="ml-auto max-w-[88%] lg:max-w-[78%]">
          <p className="whitespace-pre-line rounded-[18px_18px_4px_18px] bg-primary px-4 py-3 text-[15px] leading-[22px] text-primary-foreground lg:text-[16px] lg:leading-7">
            {description || t("Aucune précision complémentaire n’a été indiquée.")}
          </p>
        </li>
        {!isLoading && !hasTeamMessage && (
          <li className="mr-auto max-w-[88%] lg:max-w-[78%]">
            <p className="rounded-[18px_18px_18px_4px] border border-foreground/24 bg-foreground/14 px-4 py-3 text-[15px] leading-[22px] lg:text-[16px]">{t("Votre demande a bien été transmise.")}</p>
          </li>
        )}
        {messages.map((m) => {
          // Lot 5.4 : un message côté membre écrit par l'un de ses proches porte le nom du proche.
          const fromClient = m.author_role === "membre";
          const mine = fromClient && (!m.author_id || m.author_id === profile?.id);
          const delegateName = fromClient && !mine ? delegates.find((d) => d.delegate_id === m.author_id)?.full_name ?? t("Votre proche") : null;
          return (
            <li key={m.id} className={fromClient ? "ml-auto max-w-[88%] text-right lg:max-w-[78%]" : "mr-auto max-w-[88%] lg:max-w-[78%]"}>
              <p className={`whitespace-pre-line break-words rounded-[18px] p-4 text-left text-[14px] leading-6 lg:text-[16px] lg:leading-7 ${fromClient ? "rounded-br-[4px] bg-primary text-primary-foreground" : "rounded-bl-[4px] border border-foreground/24 bg-foreground/14"}`}>{m.body}</p>
              <p className="mt-1 px-1 text-[11px] text-muted-foreground">{mine ? t("Vous") : delegateName ?? t("Votre conciergerie")} · {stamp(m.created_at)}</p>
            </li>
          );
        })}
      </ol>
      {!cancelled && (
        <form onSubmit={submit} className="mt-5 flex items-end gap-2">
          <label htmlFor="member-reply" className="sr-only">{t("Répondre à votre conciergerie")}</label>
          <Textarea id="member-reply" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={1} placeholder={t("Répondre…")} className="min-h-12 flex-1 resize-none rounded-[22px] bg-card py-3" />
          <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label={t("Envoyer")} className="size-12 shrink-0 rounded-full">
            <ArrowUp className="size-5" />
          </Button>
        </form>
      )}
    </section>
  );
}

/** Lot 5.2 — documents visibles par le membre ; la section n'apparaît que s'il y en a. */
function Documents({ requestId }: { requestId: string }) {
  const { data: files = [] } = useQuery(requestFilesMemberQuery(requestId));
  const fileUrl = useServerFn(getMemberFileUrl);
  const [busy, setBusy] = useState<string | null>(null);
  if (files.length === 0) return null;

  async function download(id: string) {
    setBusy(id);
    try {
      const res = await fileUrl({ data: { id } });
      if (!res.ok) { toast.error(t(res.reason)); return; }
      window.location.href = res.url;
    } catch {
      toast.error(t("Le téléchargement n’a pas pu être préparé."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="documents-title" className="mt-3 rounded-[28px] bg-panel p-5 text-primary lg:p-8">
      <h2 id="documents-title" className="eyebrow text-primary">{t("Documents")}</h2>
      <ul className="mt-4 divide-y divide-primary/25">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 py-3">
            <FileText className="size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium lg:text-[16px]">{f.name}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{t(FILE_TYPES[f.mime]?.label ?? "Fichier")} · {fileSizeLabel(f.size, getLang())} · {new Date(f.created_at).toLocaleDateString(locale(), { day: "numeric", month: "long" })}</p>
            </div>
            <Button type="button" variant="icon" size="icon" disabled={busy === f.id} onClick={() => download(f.id)} aria-label={t("Télécharger {name}", { name: f.name })}>
              <Download />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Lot 5.3 — modification, calendrier, renouvellement et avis, selon le statut de la demande. */
function RequestActions({ item }: { item: RequestItem }) {
  const { data: changes = [] } = useQuery(requestChangesMemberQuery(item.id));
  const pending = changes.find((c) => c.status === "en attente");
  const lastDecided = changes.find((c) => c.status !== "en attente");
  const showChange = canRequestChange(item.status);
  const showCalendar = canAddToCalendar(item);
  const showRenew = canRenew(item.status);

  function downloadIcs() {
    if (!item.scheduled_date) return;
    const blob = new Blob([buildIcs({ id: item.id, title: item.title, category: t(item.category), description: item.description, scheduled_date: item.scheduled_date, scheduled_time: item.scheduled_time })], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `art-de-vie-${item.scheduled_date}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!showChange && !showCalendar && !showRenew && !canReview(item.status) && !lastDecided) return null;

  return (
    <section className="mt-3 grid gap-3">
      {pending && (
        <p role="status" className="rounded-[22px] bg-panel p-4 text-[13px] leading-5 text-primary">
          {t("Modification demandée · {type}. Nous vous confirmerons la modification ; d’ici là, votre demande reste telle qu’elle est.", { type: t(changeKindLabel(pending.kind)) })}
        </p>
      )}
      {!pending && lastDecided && (
        <p className="rounded-[22px] bg-panel p-4 text-[13px] leading-5 text-primary">
          {lastDecided.status === "acceptée"
            ? t("Votre dernière demande de modification ({type}) a été acceptée.", { type: t(changeKindLabel(lastDecided.kind)).toLowerCase() })
            : t("Votre dernière demande de modification ({type}) a été examinée et n’a pas pu être retenue.", { type: t(changeKindLabel(lastDecided.kind)).toLowerCase() })}
        </p>
      )}
      {showChange && !pending && (
        <Button asChild variant="soft" size="lg" className="w-full justify-start">
          <Link to="/demandes/$requestId/modifier" params={{ requestId: item.id }}>
            <PencilLine />
            {t("Demander une modification")}
          </Link>
        </Button>
      )}
      {showChange && !pending && <CancelBlock item={item} />}
      {showCalendar && (
        <Button type="button" variant="soft" size="lg" className="w-full justify-start" onClick={downloadIcs}>
          <CalendarPlus />
          {t("Ajouter à mon calendrier")}
        </Button>
      )}
      {showRenew && (
        <Button asChild variant="soft" size="lg" className="w-full justify-start">
          <Link to="/demandes/nouvelle" search={{ renew: item.id }}>
            <RotateCcw />
            {t("Renouveler cette demande")}
          </Link>
        </Button>
      )}
      {canReview(item.status) && <ReviewBlock requestId={item.id} category={item.category} />}
    </section>
  );
}

/** Annulation : immédiate tant que la demande est « Nouvelle », soumise à notre équipe ensuite. */
function CancelBlock({ item }: { item: RequestItem }) {
  const queryClient = useQueryClient();
  const cancel = useServerFn(cancelMyRequest);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const immediate = item.status === "Nouvelle";

  async function confirm() {
    setBusy(true);
    try {
      const res = await cancel({ data: { requestId: item.id } });
      if (!res.ok) { toast.error(t(res.reason)); return; }
      toast.success(res.mode === "annulée" ? t("Votre demande est annulée.") : t("Votre demande d’annulation nous est transmise."));
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["requests"] });
    } catch {
      toast.error(t("Votre demande n’a pas pu être envoyée."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="soft" size="lg" className="w-full justify-start" onClick={() => setOpen(true)}>
        <X />
        {t("Annuler la demande")}
      </Button>
    );
  }
  return (
    <div role="alertdialog" aria-labelledby={`cancel-${item.id}`} className="rounded-[22px] bg-panel p-4 text-primary">
      <p id={`cancel-${item.id}`} className="text-[14px] leading-6">
        {immediate
          ? t("Annuler « {title} » ? Rien n’ayant encore été engagé, l’annulation est immédiate.", { title: item.title })
          : t("Annuler « {title} » ? La demande étant déjà prise en charge, nous vous confirmerons l’annulation et vous informerons d’éventuels frais.", { title: item.title })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void confirm()}>{immediate ? t("Annuler la demande") : t("Demander l’annulation")}</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setOpen(false)}>{t("Conserver la demande")}</Button>
      </div>
    </div>
  );
}

function ReviewBlock({ requestId, category }: { requestId: string; category: string }) {
  const reviewTitle = tPair(...(REVIEW_TITLES[category] ?? DEFAULT_REVIEW_TITLE));
  const queryClient = useQueryClient();
  const { data: review, isLoading } = useQuery(requestReviewMemberQuery(requestId));
  const send = useServerFn(submitReview);
  const [rating, setRating] = useState<ReviewRating | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  if (isLoading) return null;

  if (review)
    return (
      <div className="rounded-[22px] bg-panel p-5 text-primary">
        <h2 className="eyebrow text-primary">{t("Votre avis")}</h2>
        <p className="mt-3 font-display text-[24px] italic">{t(review.rating)}</p>
        {review.comment && <p className="mt-2 whitespace-pre-line text-[14px] leading-6">{review.comment}</p>}
        <p className="mt-3 text-[12px] text-muted-foreground">{t("Merci, votre avis nous a été transmis.")}</p>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setBusy(true);
    try {
      const res = await send({ data: { requestId, rating, comment } });
      if (!res.ok) { toast.error(t(res.reason)); return; }
      await queryClient.invalidateQueries({ queryKey: ["requests", requestId, "review"] });
    } catch {
      toast.error(t("Votre avis n’a pas pu être enregistré."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[22px] bg-panel p-5 text-primary">
      <p className="eyebrow text-muted-foreground">{t("Votre avis")}</p>
      <h2 className="v3-heading mt-3 text-[30px] leading-[1.06]">{reviewTitle[0]}{" "}<em className="font-display font-normal">{reviewTitle[1]}</em></h2>
      <div role="radiogroup" aria-label={t("Votre avis sur la prestation")} className="mt-4 flex flex-wrap gap-2">
        {REVIEW_RATINGS.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={rating === r} onClick={() => setRating(r)}
            className={`h-11 rounded-full px-5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${rating === r ? "bg-primary text-background" : "border border-primary/25 hover:bg-primary/10"}`}>
            {t(r)}
          </button>
        ))}
      </div>
      <label htmlFor="review-comment" className="mt-4 block text-[13px] text-muted-foreground">{t("Un mot (facultatif)")}</label>
      <Textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={2} className="mt-2 min-h-[64px] bg-card" />
      <Button type="submit" disabled={busy || !rating} className="mt-4 w-full">{t("Envoyer mon avis")}</Button>
    </form>
  );
}

/** Lot 6.1 — bandeau vers la proposition en attente ; n'apparaît que s'il y en a une. */
function ProposalBanner({ requestId }: { requestId: string }) {
  const { data: proposal } = useQuery(requestProposalMemberQuery(requestId));
  if (!proposal || proposal.status !== "en attente" || proposal.options.length === 0) return null;
  return (
    <Link to="/demandes/$requestId/proposition" params={{ requestId }} className="mt-3 flex items-center justify-between gap-4 rounded-[28px] bg-primary p-5 text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:mt-3 lg:p-8">
      <span>
        <span className="eyebrow block text-background/80">{t("Votre conciergerie vous propose")}</span>
        <span className="mt-2 block text-[20px] lg:text-[26px]">{t(proposalBanner(proposal.options.length))}</span>
      </span>
      <ArrowUp className="size-5 rotate-45" aria-hidden="true" />
    </Link>
  );
}
