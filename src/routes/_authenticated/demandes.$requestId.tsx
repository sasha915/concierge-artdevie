import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, CalendarPlus, Download, FileText, PencilLine, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { getMemberFileUrl, sendMemberMessage, submitReview } from "@/lib/messages.functions";
import { proposalBanner } from "@/lib/planning-rules";
import { buildIcs, canAddToCalendar, canRenew, canRequestChange, canReview, changeKindLabel, FILE_TYPES, fileSizeLabel, REVIEW_RATINGS, type ReviewRating } from "@/lib/request-actions-rules";
import type { RequestItem } from "@/data/art-de-vie";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft } from "lucide-react";
import { AppShell, TopBar } from "@/components/art-de-vie/app-shell";
import { EmptyState, Photo, StatusBadge } from "@/components/art-de-vie/cards";
import { Button } from "@/components/ui/button";
import { PillAction, StatusTimeline, Title } from "@/components/art-de-vie/v3";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, imageFor, formatTime } from "@/data/art-de-vie";
import { requestChangesMemberQuery, requestFilesMemberQuery, requestProposalMemberQuery, requestMessagesQuery, requestReviewMemberQuery, requestsQuery, unreadRequestNotificationsQuery } from "@/lib/adv-queries";
import { getLang, locale, t } from "@/lib/i18n";

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
  const { data: requests = [], isLoading } = useQuery(requestsQuery);
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
            <Skeleton className="h-[452px] rounded-[28px] bg-primary/10" />
          ) : (
            <EmptyState>{t("Cette demande est introuvable.")}</EmptyState>
          )}
        </div>
      </AppShell>
    );
  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-[760px] lg:relative lg:grid lg:max-w-none lg:grid-cols-12 lg:gap-x-8">
        <section className="relative -mx-2 -mt-3 h-[452px] overflow-hidden rounded-[28px] text-foreground sm:mx-0 sm:mt-0 lg:col-span-12 lg:h-auto lg:min-h-[700px]">
          <Photo
            src={imageFor(item.image_key)}
            alt={item.title}
            category={item.category}
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between lg:hidden">
            <Button asChild variant="ghost" size="icon" className="dark-glass text-foreground hover:bg-primary-deep/70">
              <Link to="/demandes" aria-label={t("Retour")}>
                <ChevronLeft />
              </Link>
            </Button>
            <span className="dark-glass rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.13em]">
              {item.category}
            </span>
          </div>
          <div className="hidden lg:absolute lg:inset-x-6 lg:top-6 lg:block">
            <TopBar />
          </div>
          <div className="absolute inset-x-5 bottom-5 lg:inset-x-[clamp(20px,3.9vw,56px)] lg:bottom-10">
            <div className="hidden lg:mb-6 lg:flex lg:items-center lg:gap-2">
              <Button asChild variant="ghost" className="lg:dark-glass lg:h-11 lg:text-foreground">
                <Link to="/demandes">
                  <ChevronLeft />
                  {t("Mes demandes")}
                </Link>
              </Button>
              <span className="lg:dark-glass lg:rounded-full lg:px-4 lg:py-3 lg:text-[12px]">{item.category}</span>
            </div>
            <h1 className="v3-card-title max-w-[520px] text-[38px] lg:hidden">{item.title}</h1>
            <Title
              italic={item.title.split(" ").at(-1)}
              className="hidden lg:block lg:text-[clamp(52px,7.2vw,104px)] lg:leading-[0.96]"
            >
              {item.title.split(" ").slice(0, -1).join(" ")}{" "}
            </Title>
            <div className="lg:mt-8 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-6 lg:border-t lg:border-foreground/22 lg:pt-6">
              <p className="mt-3 text-[13px] lg:mt-0 lg:text-[18px]">
                {formatDate(item.scheduled_date)}
                {item.scheduled_time ? ` · ${formatTime(item.scheduled_time)}` : ""}
              </p>
              <PillAction asChild light className="hidden lg:inline-flex">
                <Link to="/demandes/nouvelle" search={{ offer: undefined }}>
                  {t("Faire une nouvelle demande")}
                </Link>
              </PillAction>
            </div>
          </div>
        </section>
        <section className="mt-3 rounded-[28px] bg-primary-deep p-5 text-foreground lg:dark-glass lg:absolute lg:right-[clamp(20px,3.9vw,56px)] lg:top-[160px] lg:mt-0 lg:w-[420px] lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="eyebrow text-foreground">{t("Suivi")}</h2>
            <StatusBadge status={item.status} onPhoto />
          </div>
          <div className="mt-5">
            <StatusTimeline status={item.status} dark />
          </div>
        </section>
        <ProposalBanner requestId={item.id} />
        <Exchanges requestId={item.id} description={item.description} cancelled={item.status === "Annulée"} />
        <Documents requestId={item.id} />
        <section className="mt-8 px-2 text-primary lg:col-span-5 lg:mr-[clamp(20px,3.9vw,56px)] lg:mt-16 lg:px-0">
          <h2 className="eyebrow text-primary">{t("Détails")}</h2>
          <dl className="mt-4 divide-y divide-primary/25 border-y border-primary/25 text-[14px]">
            <Detail label={t("Date")} value={formatDate(item.scheduled_date)} />
            <Detail label={t("Heure")} value={item.scheduled_time ? formatTime(item.scheduled_time) : t("À définir")} />
            {item.guests && (
              <Detail label={item.category === "Tables" ? t("Couverts") : t("Personnes")} value={String(item.guests)} />
            )}
            <Detail label={t("Concierge")} value={item.concierge} />
          </dl>
        </section>
        <RequestActions item={item} />
        <div className="mt-6 lg:hidden">
          <PillAction asChild className="w-full">
            <Link to="/demandes/nouvelle" search={{ offer: undefined }}>
              {t("Faire une nouvelle demande")}
            </Link>
          </PillAction>
        </div>
      </div>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 py-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-[16px] lg:text-[24px]">{value}</dd>
    </div>
  );
}

function stamp(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/** Lot 5.1 — fil d'échanges : messages du membre à droite, de la conciergerie à gauche dans la bulle violette. */
function Exchanges({ requestId, description, cancelled }: { requestId: string; description: string; cancelled: boolean }) {
  const queryClient = useQueryClient();
  const { data: messages = [], isLoading } = useQuery(requestMessagesQuery(requestId));
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
    <section aria-labelledby="exchanges-title" className="mt-3 rounded-[28px] bg-primary/10 p-5 text-primary lg:col-span-7 lg:ml-[clamp(20px,3.9vw,56px)] lg:mt-16 lg:self-start lg:p-8">
      <h2 id="exchanges-title" className="eyebrow text-primary">{t("Échanges")}</h2>
      <ol className="mt-5 grid gap-3" aria-live="polite">
        <li className="ml-auto max-w-[88%] lg:max-w-[78%]">
          <p className="whitespace-pre-line rounded-[18px] bg-card p-4 text-[14px] leading-6 lg:text-[16px] lg:leading-7">
            {description || t("Aucune précision complémentaire n’a été indiquée.")}
          </p>
        </li>
        {!isLoading && !hasTeamMessage && (
          <li className="mr-auto max-w-[88%] lg:max-w-[78%]">
            <p className="rounded-[18px] bg-primary p-4 text-[14px] text-background lg:text-[16px]">{t("Votre demande a bien été transmise.")}</p>
          </li>
        )}
        {messages.map((m) => {
          const mine = m.author_role === "membre";
          return (
            <li key={m.id} className={mine ? "ml-auto max-w-[88%] text-right lg:max-w-[78%]" : "mr-auto max-w-[88%] lg:max-w-[78%]"}>
              <p className={`whitespace-pre-line break-words rounded-[18px] p-4 text-left text-[14px] leading-6 lg:text-[16px] lg:leading-7 ${mine ? "bg-card" : "bg-primary text-background"}`}>{m.body}</p>
              <p className="mt-1 px-1 text-[11px] text-muted-foreground">{mine ? t("Vous") : t("Votre conciergerie")} · {stamp(m.created_at)}</p>
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
    <section aria-labelledby="documents-title" className="mt-3 rounded-[28px] bg-primary/10 p-5 text-primary lg:col-span-7 lg:col-start-1 lg:ml-[clamp(20px,3.9vw,56px)] lg:p-8">
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
    <section className="mt-3 grid gap-3 lg:col-span-5 lg:col-start-8 lg:mr-[clamp(20px,3.9vw,56px)] lg:self-start">
      {pending && (
        <p role="status" className="rounded-[22px] bg-primary/10 p-4 text-[13px] leading-5 text-primary">
          {t("Modification demandée · {type}. Votre conciergerie vous confirme la modification ; d’ici là, votre demande reste telle qu’elle est.", { type: t(changeKindLabel(pending.kind)) })}
        </p>
      )}
      {!pending && lastDecided && (
        <p className="rounded-[22px] bg-primary/10 p-4 text-[13px] leading-5 text-primary">
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
      {canReview(item.status) && <ReviewBlock requestId={item.id} />}
    </section>
  );
}

function ReviewBlock({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();
  const { data: review, isLoading } = useQuery(requestReviewMemberQuery(requestId));
  const send = useServerFn(submitReview);
  const [rating, setRating] = useState<ReviewRating | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  if (isLoading) return null;

  if (review)
    return (
      <div className="rounded-[22px] bg-primary/10 p-5 text-primary">
        <h2 className="eyebrow text-primary">{t("Votre avis")}</h2>
        <p className="mt-3 font-display text-[24px] italic">{t(review.rating)}</p>
        {review.comment && <p className="mt-2 whitespace-pre-line text-[14px] leading-6">{review.comment}</p>}
        <p className="mt-3 text-[12px] text-muted-foreground">{t("Merci, votre avis a été transmis à votre conciergerie.")}</p>
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
    <form onSubmit={submit} className="rounded-[22px] bg-primary/10 p-5 text-primary">
      <h2 className="eyebrow text-primary">{t("Votre avis")}</h2>
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
    <Link to="/demandes/$requestId/proposition" params={{ requestId }} className="mt-3 flex items-center justify-between gap-4 rounded-[28px] bg-primary p-5 text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:col-span-7 lg:col-start-1 lg:ml-[clamp(20px,3.9vw,56px)] lg:mt-16 lg:p-8">
      <span>
        <span className="eyebrow block text-background/80">{t("Votre conciergerie vous propose")}</span>
        <span className="mt-2 block text-[20px] lg:text-[26px]">{t(proposalBanner(proposal.options.length))}</span>
      </span>
      <ArrowUp className="size-5 rotate-45" aria-hidden="true" />
    </Link>
  );
}
