import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check } from "lucide-react";
import { AppShell } from "@/components/art-de-vie/app-shell";
import { SubHeader } from "@/components/art-de-vie/page-header";
import { EmptyState } from "@/components/art-de-vie/cards";
import { PillAction } from "@/components/art-de-vie/v3";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount } from "@/data/art-de-vie";
import { requestProposalMemberQuery, requestsQuery } from "@/lib/adv-queries";
import { answerProposal } from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/demandes/$requestId_/proposition")({
  head: () => ({
    meta: [
      { title: "Votre conciergerie vous propose — Art de Vie" },
      { name: "description", content: "Choisissez l’option qui vous convient." },
      { property: "og:title", content: "Votre conciergerie vous propose — Art de Vie" },
      { property: "og:description", content: "Choisissez l’option qui vous convient." },
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
  const { data: requests = [] } = useQuery(requestsQuery);
  const { data: proposal, isLoading } = useQuery(requestProposalMemberQuery(requestId));
  const answer = useServerFn(answerProposal);
  const item = requests.find((r) => r.id === requestId);
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(optionId: string | null) {
    if (!proposal) return;
    if (optionId === null && !window.confirm("Aucune option ne vous convient ? Votre conciergerie en sera prévenue.")) return;
    setBusy(true); setError(null);
    try {
      const res = await answer({ data: { proposalId: proposal.id, optionId } });
      if (!res.ok) { setError(res.reason); return; }
      await queryClient.invalidateQueries({ queryKey: ["requests"] });
      await navigate({ to: "/demandes/$requestId", params: { requestId } });
    } catch {
      setError("Votre réponse n’a pas pu être envoyée. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell nav={false}>
      <div className="mx-auto max-w-3xl lg:max-w-none">
        <SubHeader title="Votre conciergerie vous propose" close backTo="/demandes" />
        {isLoading ? (
          <Skeleton className="h-[420px] rounded-[28px] bg-primary/10" />
        ) : !proposal || proposal.status !== "en attente" ? (
          <div className="lg:mx-[clamp(20px,3.9vw,56px)]">
            <EmptyState>{proposal ? "Vous avez déjà répondu à cette proposition." : "Aucune proposition en attente."}</EmptyState>
            <Link to="/demandes/$requestId" params={{ requestId }} className="mt-4 inline-block text-[14px] text-primary underline underline-offset-4">Revenir à la demande</Link>
          </div>
        ) : (
          <div className="text-primary lg:mx-[clamp(20px,3.9vw,56px)]">
            {item && <p className="mb-4 text-[14px] text-muted-foreground lg:text-[18px]">{item.category} · {item.title}</p>}
            <div role="radiogroup" aria-label="Options proposées" className="grid gap-3 lg:grid-cols-2">
              {proposal.options.map((o) => {
                const active = choice === o.id;
                return (
                  <button key={o.id} type="button" role="radio" aria-checked={active} onClick={() => setChoice(o.id)}
                    className={`rounded-[28px] p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:p-8 ${active ? "bg-primary text-background" : "bg-card hover:bg-primary/10"}`}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="v3-card-title text-[22px] lg:text-[30px]">{o.label}</span>
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${active ? "border-background" : "border-primary/40"}`}>{active && <Check className="size-4" />}</span>
                    </span>
                    {o.detail && <span className="mt-3 block whitespace-pre-line text-[14px] leading-6 lg:text-[16px]">{o.detail}</span>}
                    {o.estimate_cents !== null && <span className="mt-4 block font-display text-[26px]">≈ {formatAmount(o.estimate_cents)}</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-5 text-[13px] leading-5 text-muted-foreground lg:text-[15px]">Les montants sont estimatifs. Le montant définitif figure sur votre relevé.</p>
            {error && <p role="alert" className="mt-4 rounded-2xl bg-primary/10 p-4 text-xs leading-5">{error}</p>}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
              <PillAction type="button" className="w-full sm:max-w-sm" disabled={busy || !choice} onClick={() => void respond(choice)}>Valider ce choix</PillAction>
              <Button type="button" variant="link" disabled={busy} onClick={() => void respond(null)}>Aucune ne me convient</Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
