import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check } from "lucide-react";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { EmptyState } from "@/components/art-de-vie/cards";
import { PillAction } from "@/components/art-de-vie/v3";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { requestChangesMemberQuery, requestsQuery } from "@/lib/adv-queries";
import { requestChange } from "@/lib/messages.functions";
import { canRequestChange, CHANGE_KINDS, type ChangeKind } from "@/lib/request-actions-rules";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/demandes/$requestId_/modifier")({
  head: () => ({
    meta: [
      { title: t("Modifier ma demande — Art de Vie") },
      { name: "description", content: t("Demandez-nous une modification de votre demande.") },
      { property: "og:title", content: t("Modifier ma demande — Art de Vie") },
      { property: "og:description", content: t("Demandez-nous une modification de votre demande.") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: requests = [], isLoading } = useQuery(requestsQuery);
  const { data: changes = [] } = useQuery(requestChangesMemberQuery(requestId));
  const send = useServerFn(requestChange);
  const item = requests.find((r) => r.id === requestId);
  const [kind, setKind] = useState<ChangeKind | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = changes.some((c) => c.status === "en attente");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) { setError(t("Choisissez le type de modification.")); return; }
    if (kind !== "annulation" && !body.trim()) { setError(t("Précisez votre souhait.")); return; }
    setBusy(true); setError(null);
    try {
      const res = await send({ data: { requestId, kind, body } });
      if (!res.ok) { setError(t(res.reason)); return; }
      await queryClient.invalidateQueries({ queryKey: ["requests", requestId, "changes"] });
      await navigate({ to: "/demandes/$requestId", params: { requestId } });
    } catch {
      setError(t("Votre demande n’a pas pu être envoyée. Réessayez dans un instant."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-3xl lg:max-w-none">
        <SubHeader title="Modifier ma demande" close backTo="/demandes" />
        {isLoading ? (
          <Skeleton className="h-[420px] rounded-[28px] bg-panel" />
        ) : !item ? (
          <EmptyState>{t("Cette demande est introuvable.")}</EmptyState>
        ) : !canRequestChange(item.status) || pending ? (
          <div className="lg:mx-4">
            <EmptyState>{pending ? t("Nous examinons déjà une demande de modification.") : t("Cette demande ne peut plus être modifiée.")}</EmptyState>
            <Link to="/demandes/$requestId" params={{ requestId }} className="mt-4 inline-block text-[14px] text-primary underline underline-offset-4">{t("Revenir à la demande")}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-[28px] bg-card p-5 text-primary sm:p-8 lg:mx-4 lg:p-10">
            <p className="eyebrow text-primary">{t(item.category)}</p>
            <p className="v3-card-title mt-3 text-[24px] lg:text-[34px]">{item.title}</p>
            <fieldset className="mt-6">
              <legend className="eyebrow text-primary">{t("Votre modification")}</legend>
              <div role="radiogroup" className="mt-3 grid gap-2 sm:grid-cols-2">
                {CHANGE_KINDS.filter((k) => k.value !== "annulation").map((k) => {
                  const active = kind === k.value;
                  return (
                    <button key={k.value} type="button" role="radio" aria-checked={active} onClick={() => setKind(k.value)}
                      className={`flex min-h-[56px] items-center justify-between gap-3 rounded-[18px] px-4 py-3 text-left text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary text-background" : "bg-panel hover:bg-primary/15"}`}>
                      {t(k.label)}
                      {active && <Check className="size-4 shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label htmlFor="change-body" className="eyebrow mt-6 block text-primary">{t("Précisions")}</label>
            <Textarea id="change-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={4} className="mt-3" placeholder={kind === "annulation" ? t("Un mot à notre intention (facultatif)") : t("Nouvelle date, nombre de couverts, précision…")} />
            <p className="mt-4 text-[13px] leading-5 text-muted-foreground">{t("Nous vous confirmerons la modification. D’ici là, votre demande reste telle qu’elle est.")}</p>
            {error && <p role="alert" className="mt-4 rounded-2xl bg-panel p-4 text-xs leading-5">{error}</p>}
            <PillAction type="submit" className="mt-6 w-full sm:max-w-sm" disabled={busy}>{busy ? t("Envoi en cours") : t("Envoyer la demande")}</PillAction>
          </form>
        )}
      </div>
    </AppShell>
  );
}
