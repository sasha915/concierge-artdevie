import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowUp, ChevronLeft, Download, FileText, LogOut } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Logo, NewRequestButton, TopBar } from "@/components/art-de-vie/app-shell";
import { EmptyState, ErrorState, Photo, RequestCard, StatusBadge } from "@/components/art-de-vie/cards";
import { PillAction, StatusTimeline, Title } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSignOut } from "@/components/art-de-vie/use-delegation";
import { formatDate, formatTime, imageFor, type RequestItem, requestPhoto } from "@/data/art-de-vie";
import { delegateRequestQuery, delegateRequestsQuery } from "@/lib/adv-queries";
import { firstName } from "@/lib/delegate-rules";
import { getDelegateFileUrl, sendDelegateMessage, type DelegationInfo } from "@/lib/delegates.functions";
import { FILE_TYPES, fileSizeLabel } from "@/lib/request-actions-rules";
import { getLang, locale, t, tPair } from "@/lib/i18n";

/** Compte sans profil ni délégation active (accès retiré, membre désactivé). */
export function InactiveAccess() {
  const signOut = useSignOut();
  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-[560px] pt-16 text-primary">
        <Logo inverse className="h-[22px] w-auto" />
        <Title italic={tPair("Accès", "inactif.")[1]} className="mt-10 text-[44px] lg:text-[64px]">{tPair("Accès", "inactif.")[0]} </Title>
        <p className="mt-5 text-[15px] leading-6 text-muted-foreground lg:text-[18px] lg:leading-7">
          {t("Ce compte n’a pas, ou plus, d’accès actif à l’espace Art de Vie. Pour toute question, écrivez-nous ou adressez-vous au membre qui vous l’avait ouvert.")}
        </p>
        <PillAction type="button" className="mt-8" onClick={() => void signOut()}>{t("Se déconnecter")}</PillAction>
      </div>
    </AppShell>
  );
}

function SignOutButton() {
  const signOut = useSignOut();
  return (
    <button type="button" onClick={() => void signOut()} className="flex h-[52px] w-full items-center justify-between gap-3 rounded-full border border-foreground/24 pl-6 pr-2 text-[15px] font-medium text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto lg:justify-start lg:px-6">
      <span className="lg:order-2">{t("Se déconnecter")}</span>
      <span className="flex size-9 items-center justify-center rounded-full border border-foreground/24 lg:order-1 lg:size-auto lg:border-0"><LogOut className="size-4" /></span>
    </button>
  );
}

function asItem(r: { status: string } & Omit<RequestItem, "status">): RequestItem {
  return r as RequestItem;
}

/** Accueil du proche : pour qui il agit, ses demandes, une nouvelle demande. */
export function DelegateHome({ delegation }: { delegation: DelegationInfo }) {
  const { data: requests = [], isLoading } = useQuery(delegateRequestsQuery);
  const [head, tail] = tPair("Bonjour", `${firstName(delegation.delegateName)}.`);
  const open = requests.filter((r) => r.status !== "Terminée" && r.status !== "Annulée");
  return (
    <AppShell>
      <section className="relative isolate overflow-hidden rounded-[28px] bg-panel p-[14px] pb-[22px] text-foreground lg:p-8">
        <TopBar />
        <div className="px-1.5 pt-[34px] lg:px-4 lg:pt-12">
          <p className="eyebrow mb-3.5 text-muted-foreground">{t("Proche autorisé")}</p>
          <Title italic={tail} className="text-[46px] leading-[0.98] lg:text-[clamp(56px,6vw,96px)]">{head} </Title>
          <p className="mt-[22px] max-w-[620px] border-t border-foreground/24 pt-[18px] text-[15px] leading-[23px] text-muted-foreground lg:border-0 lg:pt-0 lg:text-[18px] lg:leading-7">
            {t("Vous faites des demandes au nom de {name}. Chacune lui est signalée et nous est transmise ; nous vous répondons ici.", { name: delegation.memberName })}
          </p>
          <NewRequestButton className="mt-7 w-full lg:w-fit" />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="eyebrow mx-2 mb-3.5 text-muted-foreground">{t("Vos demandes")}</h2>
        {isLoading ? (
          <Skeleton className="h-[220px] rounded-card bg-panel" />
        ) : requests.length === 0 ? (
          <EmptyState>{t("Vous n’avez pas encore fait de demande.")}</EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {[...open, ...requests.filter((r) => !open.includes(r))].map((r) => <RequestCard key={r.id} item={asItem(r)} />)}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-[24px] border border-foreground/16 bg-glass p-5 text-[14px] leading-6 text-muted-foreground lg:p-7 lg:text-[16px] lg:leading-7">
        {t("Les propositions, les paiements et le compte de {name} restent de son seul ressort.", { name: firstName(delegation.memberName) })}
      </section>
      <div className="mt-3"><SignOutButton /></div>
    </AppShell>
  );
}

/** Liste des demandes du proche. */
export function DelegateRequestsList() {
  const { data: requests = [], isLoading } = useQuery(delegateRequestsQuery);
  const [head, tail] = tPair("Mes", "demandes.");
  return (
    <AppShell>
      <section className="relative isolate overflow-hidden rounded-[28px] bg-panel p-[14px] pb-[22px] text-foreground lg:p-8">
        <TopBar />
        <div className="px-1.5 pt-[34px] lg:px-4 lg:pt-12">
          <p className="eyebrow mb-3.5 text-muted-foreground">{t("Demandes")}</p>
          <Title italic={tail} className="text-[46px] leading-[0.98] lg:text-[clamp(56px,6vw,96px)]">{head} </Title>
          <p className="mt-[22px] border-t border-foreground/24 pt-[18px] text-[15px] leading-[23px] text-muted-foreground lg:border-0 lg:pt-0 lg:text-[18px] lg:leading-7">{t("Les demandes que vous avez faites, et leur avancement.")}</p>
        </div>
      </section>
      {isLoading ? (
        <Skeleton className="mt-6 h-[220px] rounded-card bg-panel" />
      ) : requests.length === 0 ? (
        <div className="mt-6"><EmptyState>{t("Vous n’avez pas encore fait de demande.")}</EmptyState></div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">{requests.map((r) => <RequestCard key={r.id} item={asItem(r)} />)}</div>
      )}
    </AppShell>
  );
}

function stamp(iso: string) {
  return new Date(iso).toLocaleString(locale(), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/** Suivi d'une demande du proche : statut, échanges, documents ; jamais de proposition ni de montant. */
export function DelegateRequestDetail({ requestId, delegation }: { requestId: string; delegation: DelegationInfo }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery(delegateRequestQuery(requestId));
  const send = useServerFn(sendDelegateMessage);
  const fileUrl = useServerFn(getDelegateFileUrl);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!data) {
    return (
      <AppShell nav={false}>
        <div className="mx-auto max-w-2xl pt-10">
          {isLoading ? <Skeleton className="h-[452px] rounded-[28px] bg-panel" /> : isError ? <ErrorState onRetry={() => void refetch()} /> : <EmptyState>{t("Cette demande est introuvable.")}</EmptyState>}
        </div>
      </AppShell>
    );
  }
  const { request: item, messages, files, proposalPending } = data;
  const status = item.status as RequestItem["status"];
  const cancelled = item.status === "Annulée";
  const memberFirst = firstName(delegation.memberName);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await send({ data: { requestId, body: text } });
      if (!res.ok) { toast.error(t(res.reason)); return; }
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["delegate-requests", requestId] });
    } catch {
      toast.error(t("Votre message n’a pas pu être envoyé."));
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string) {
    setDownloading(id);
    try {
      const res = await fileUrl({ data: { id } });
      if (!res.ok) { toast.error(t(res.reason)); return; }
      window.location.href = res.url;
    } catch {
      toast.error(t("Le téléchargement n’a pas pu être préparé."));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <AppShell nav={false}>
      <div className="hidden lg:mb-5 lg:block"><TopBar /></div>
      <div className="mx-auto max-w-[760px] lg:grid lg:max-w-none lg:grid-cols-12 lg:items-start lg:gap-4">
        <div className="min-w-0 lg:col-span-8">
          <section className="relative -mx-2 -mt-3 h-[400px] overflow-hidden rounded-[28px] bg-panel text-foreground sm:mx-0 sm:mt-0 lg:h-[340px]">
            <Photo src={requestPhoto(item)} alt={item.title} category={item.category} hero className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-x-4 top-4 flex items-center justify-between lg:inset-x-5 lg:top-5">
              <Link to="/demandes" className="dark-glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px]">
                <ChevronLeft className="size-4" />
                {t("Mes demandes")}
              </Link>
              <span className="dark-glass inline-flex h-[30px] items-center rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.13em]">{t(item.category)}</span>
            </div>
            <div className="absolute inset-x-5 bottom-5 lg:inset-x-6 lg:bottom-6">
              <h1 className="v3-heading max-w-[620px] text-[40px] leading-[1.02] lg:text-[clamp(48px,4.6vw,68px)]">{item.title}</h1>
              <p className="mt-3 text-[15px] text-muted-foreground lg:text-[16px]">
                {formatDate(item.scheduled_date)}
                {item.scheduled_time ? ` · ${formatTime(item.scheduled_time)}` : ""}
              </p>
            </div>
          </section>

          <section className="mt-3 rounded-[24px] bg-panel p-5 text-foreground lg:rounded-[28px] lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="eyebrow text-muted-foreground">{t("Suivi")}</h2>
              <StatusBadge status={status} />
            </div>
            <div className="mt-[18px]"><StatusTimeline status={status} dark /></div>
          </section>

          {proposalPending && (
            <p className="mt-3 rounded-[24px] bg-primary p-5 text-[15px] leading-6 text-primary-foreground lg:rounded-[28px] lg:p-6">
              {t("Une proposition a été adressée à {name}. Lui seul peut y répondre.", { name: memberFirst })}
            </p>
          )}

          <section aria-labelledby="delegate-exchanges" className="mt-3 rounded-[24px] border border-foreground/16 bg-glass p-5 text-primary lg:rounded-[28px] lg:p-8">
            <h2 id="delegate-exchanges" className="eyebrow text-primary">{t("Échanges")}</h2>
            <ol className="mt-5 grid gap-3" aria-live="polite">
              <li className="ml-auto max-w-[88%] lg:max-w-[78%]">
                <p className="whitespace-pre-line rounded-[18px_18px_4px_18px] bg-primary px-4 py-3 text-[15px] leading-[22px] text-primary-foreground lg:text-[16px] lg:leading-7">
                  {item.description || t("Aucune précision complémentaire n’a été indiquée.")}
                </p>
              </li>
              {messages.map((m) => {
                const mine = m.from === "moi";
                const right = m.from !== "équipe";
                return (
                  <li key={m.id} className={right ? "ml-auto max-w-[88%] text-right lg:max-w-[78%]" : "mr-auto max-w-[88%] lg:max-w-[78%]"}>
                    <p className={`whitespace-pre-line break-words rounded-[18px] p-4 text-left text-[14px] leading-6 lg:text-[16px] lg:leading-7 ${right ? "rounded-br-[4px] bg-primary text-primary-foreground" : "rounded-bl-[4px] border border-foreground/24 bg-foreground/14"}`}>{m.body}</p>
                    <p className="mt-1 px-1 text-[11px] text-muted-foreground">{mine ? t("Vous") : m.from === "membre" ? memberFirst : t("Art de Vie")} · {stamp(m.created_at)}</p>
                  </li>
                );
              })}
            </ol>
            {!cancelled && (
              <form onSubmit={submit} className="mt-5 flex items-end gap-2">
                <label htmlFor="delegate-reply" className="sr-only">{t("Votre message")}</label>
                <Textarea id="delegate-reply" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={1} placeholder={t("Répondre…")} className="min-h-12 flex-1 resize-none rounded-[22px] bg-card py-3" />
                <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label={t("Envoyer")} className="size-12 shrink-0 rounded-full"><ArrowUp className="size-5" /></Button>
              </form>
            )}
          </section>

          {files.length > 0 && (
            <section aria-labelledby="delegate-documents" className="mt-3 rounded-[28px] bg-panel p-5 text-primary lg:p-8">
              <h2 id="delegate-documents" className="eyebrow text-primary">{t("Documents")}</h2>
              <ul className="mt-4 divide-y divide-primary/25">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-3">
                    <FileText className="size-5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium lg:text-[16px]">{f.name}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{t(FILE_TYPES[f.mime]?.label ?? "Fichier")} · {fileSizeLabel(f.size, getLang())}</p>
                    </div>
                    <Button type="button" variant="icon" size="icon" disabled={downloading === f.id} onClick={() => void download(f.id)} aria-label={t("Télécharger {name}", { name: f.name })}><Download /></Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="min-w-0 lg:col-span-4">
          <section className="mt-3 rounded-[24px] bg-panel px-5 pb-1.5 pt-5 text-primary lg:mt-0 lg:rounded-[28px] lg:px-7 lg:pt-7">
            <h2 className="eyebrow text-primary">{t("Détails")}</h2>
            <dl className="mt-3.5 divide-y divide-foreground/16 border-t border-foreground/16 text-[14px]">
              <Detail label={t("Pour")} value={delegation.memberName} />
              <Detail label={t("Date")} value={formatDate(item.scheduled_date)} />
              <Detail label={t("Heure")} value={item.scheduled_time ? formatTime(item.scheduled_time) : t("À définir")} />
              {item.guests ? <Detail label={item.category === "Tables" ? t("Couverts") : t("Personnes")} value={String(item.guests)} /> : null}
              <Detail label={t("Concierge")} value={item.concierge === "À attribuer" ? t("À attribuer") : item.concierge} />
            </dl>
          </section>
          <div className="mt-6 lg:mt-3"><NewRequestButton className="w-full" /></div>
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
